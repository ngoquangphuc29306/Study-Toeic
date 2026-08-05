import type { ToeicOptionMap, ToeicSection, ToeicTestPart } from '../types';
import {
  TOEIC_FORBIDDEN_READ_KEYS,
  TOEIC_OPTION_KEYS,
  ToeicReadError,
  type ToeicTestCatalogItem,
  type ToeicTestPartPayload,
  type ToeicTestTakingQuestion,
  type ToeicTestTakingPassage,
} from '../readContracts';

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown, path: string): RecordLike {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}`);
  }
  return value as RecordLike;
}

function requiredString(record: RecordLike, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.${key}`);
  }
  return value;
}

function nullableString(record: RecordLike, key: string, path: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.${key}`);
  }
  return value;
}

function requiredInteger(record: RecordLike, key: string, path: string, minimum = 0): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.${key}`);
  }
  return value as number;
}

function requiredBoolean(record: RecordLike, key: string, path: string): boolean {
  if (typeof record[key] !== 'boolean') {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.${key}`);
  }
  return record[key] as boolean;
}

function requiredPart(record: RecordLike, key: string, path: string): ToeicTestPart {
  const value = requiredInteger(record, key, path, 1);
  if (value < 1 || value > 7) {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.${key}`);
  }
  return value as ToeicTestPart;
}

function requiredSection(record: RecordLike, key: string, path: string): ToeicSection {
  const value = record[key];
  if (value !== 'listening' && value !== 'reading') {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.${key}`);
  }
  return value;
}

function assertSafeKeys(value: unknown, path = 'response'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  Object.entries(value as RecordLike).forEach(([key, child]) => {
    if (TOEIC_FORBIDDEN_READ_KEYS.has(key)) {
      throw new ToeicReadError('INVALID_RESPONSE', `Forbidden TOEIC response field at ${path}.${key}`);
    }
    assertSafeKeys(child, `${path}.${key}`);
  });
}

function mapCatalogItem(value: unknown, index: number): ToeicTestCatalogItem {
  const record = asRecord(value, `items[${index}]`);
  const path = `items[${index}]`;
  return {
    id: requiredString(record, 'id', path),
    name: requiredString(record, 'name', path),
    setName: requiredString(record, 'set_name', path),
    year: requiredInteger(record, 'year', path, 2000),
    source: requiredString(record, 'source', path),
    description: nullableString(record, 'description', path),
    isFree: requiredBoolean(record, 'is_free', path),
    totalQuestions: requiredInteger(record, 'total_questions', path, 1),
    durationSeconds: requiredInteger(record, 'duration_seconds', path, 1),
  };
}

export function mapCatalogRpcResponse(value: unknown): ReadonlyArray<ToeicTestCatalogItem> {
  assertSafeKeys(value);
  const response = asRecord(value, 'response');
  if (!Array.isArray(response.items)) {
    throw new ToeicReadError('INVALID_RESPONSE', 'Invalid TOEIC catalog response');
  }
  return response.items.map(mapCatalogItem);
}

function mapOptions(value: unknown, path: string): ToeicOptionMap {
  const record = asRecord(value, path);
  const options = {} as Record<keyof ToeicOptionMap, string | null>;
  TOEIC_OPTION_KEYS.forEach((key) => {
    const option = record[key];
    if (option !== null && typeof option !== 'string') {
      throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.${key}`);
    }
    options[key] = option as string | null;
  });
  return options;
}

function mapPassage(value: unknown, index: number): ToeicTestTakingPassage {
  const record = asRecord(value, `passages[${index}]`);
  const path = `passages[${index}]`;
  const content = asRecord(record.content, `${path}.content`);
  if (!Array.isArray(content.documents)) {
    throw new ToeicReadError('INVALID_RESPONSE', `Invalid TOEIC response at ${path}.content.documents`);
  }
  return {
    id: requiredString(record, 'id', path),
    part: requiredPart(record, 'part', path),
    passageType: nullableString(record, 'passage_type', path),
    title: nullableString(record, 'title', path),
    content: {
      documents: content.documents.map((document, documentIndex) => {
        const documentRecord = asRecord(document, `${path}.content.documents[${documentIndex}]`);
        const documentPath = `${path}.content.documents[${documentIndex}]`;
        return {
          type: requiredString(documentRecord, 'type', documentPath),
          title: nullableString(documentRecord, 'title', documentPath),
          body: requiredString(documentRecord, 'body', documentPath),
        };
      }),
    },
    audioPath: nullableString(record, 'audio_path', path),
    imagePath: nullableString(record, 'image_path', path),
    position: requiredInteger(record, 'position', path),
  };
}

function mapQuestion(value: unknown, index: number): ToeicTestTakingQuestion {
  const record = asRecord(value, `questions[${index}]`);
  const path = `questions[${index}]`;
  return {
    id: requiredString(record, 'id', path),
    passageId: nullableString(record, 'passage_id', path),
    part: requiredPart(record, 'part', path),
    section: requiredSection(record, 'section', path),
    questionNumber: requiredInteger(record, 'question_number', path, 1),
    questionText: nullableString(record, 'question_text', path),
    options: mapOptions(record.options, `${path}.options`),
    audioPath: nullableString(record, 'audio_path', path),
    imagePath: nullableString(record, 'image_path', path),
    position: requiredInteger(record, 'position', path),
  };
}

export function mapPartRpcResponse(value: unknown): ToeicTestPartPayload {
  assertSafeKeys(value);
  const response = asRecord(value, 'response');
  const test = asRecord(response.test, 'test');
  if (!Array.isArray(response.passages) || !Array.isArray(response.questions)) {
    throw new ToeicReadError('INVALID_RESPONSE', 'Invalid TOEIC part response');
  }

  const part = requiredPart(response, 'part', 'response');
  const mapped = {
    test: {
      id: requiredString(test, 'id', 'test'),
      name: requiredString(test, 'name', 'test'),
      setName: requiredString(test, 'set_name', 'test'),
      year: requiredInteger(test, 'year', 'test', 2000),
      source: requiredString(test, 'source', 'test'),
      durationSeconds: requiredInteger(test, 'duration_seconds', 'test', 1),
    },
    part,
    passages: response.passages.map(mapPassage),
    questions: response.questions.map(mapQuestion),
  } satisfies ToeicTestPartPayload;

  return mapped;
}
