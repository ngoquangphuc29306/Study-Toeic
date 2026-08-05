import type { ToeicOptionKey, ToeicTestPart } from '../types';
import {
  ToeicLearningError,
  type ToeicAttemptReviewLearningContent,
  type ToeicLearningVocabularyContent,
  type ToeicLearningVocabularyItem,
  type ToeicPracticeFeedback,
  type ToeicReviewLearningPassage,
  type ToeicReviewLearningQuestion,
} from '../learningContracts';

type RecordLike = Record<string, unknown>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTION_KEYS: ReadonlyArray<ToeicOptionKey> = ['A', 'B', 'C', 'D'];

function fail(message: string): never {
  throw new ToeicLearningError('INVALID_RESPONSE', message);
}

function asRecord(value: unknown, path: string): RecordLike {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Invalid learning response at ${path}`);
  return value as RecordLike;
}

function assertExactKeys(record: RecordLike, keys: ReadonlyArray<string>, path: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`Unexpected learning field at ${path}.${key}`);
  }
}

function assertRequiredKeys(record: RecordLike, keys: ReadonlyArray<string>, path: string): void {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) fail(`Missing learning field at ${path}.${key}`);
  }
}

function requiredString(record: RecordLike, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') fail(`Invalid learning field at ${path}.${key}`);
  return value;
}

function nullableString(record: RecordLike, key: string, path: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') fail(`Invalid learning field at ${path}.${key}`);
  return value;
}

function requiredUuid(record: RecordLike, key: string, path: string): string {
  const value = requiredString(record, key, path);
  if (!UUID_PATTERN.test(value)) fail(`Invalid learning UUID at ${path}.${key}`);
  return value;
}

function nullableUuid(record: RecordLike, key: string, path: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) fail(`Invalid learning UUID at ${path}.${key}`);
  return value;
}

function requiredInteger(record: RecordLike, key: string, path: string): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 0) fail(`Invalid learning integer at ${path}.${key}`);
  return value as number;
}

function partOf(record: RecordLike, key: string, path: string): ToeicTestPart {
  const value = requiredInteger(record, key, path);
  if (value < 1 || value > 7) fail(`Invalid learning Part at ${path}.${key}`);
  return value as ToeicTestPart;
}

function option(record: RecordLike, key: string, path: string): ToeicOptionKey {
  const value = record[key];
  if (typeof value !== 'string' || !OPTION_KEYS.includes(value as ToeicOptionKey)) fail(`Invalid learning option at ${path}.${key}`);
  return value as ToeicOptionKey;
}

function nullableBoolean(record: RecordLike, key: string, path: string): boolean | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') fail(`Invalid learning boolean at ${path}.${key}`);
  return value;
}

function mapVocabulary(value: unknown, path: string): ToeicLearningVocabularyContent | null {
  if (value === null || value === undefined) return null;
  const record = asRecord(value, path);
  assertExactKeys(record, ['items', 'raw'], path);
  assertRequiredKeys(record, ['items', 'raw'], path);
  if (!Array.isArray(record.items)) fail(`Invalid learning vocabulary items at ${path}.items`);
  const items: ToeicLearningVocabularyItem[] = record.items.map((item, index) => {
    const itemPath = `${path}.items[${index}]`;
    const itemRecord = asRecord(item, itemPath);
    assertExactKeys(itemRecord, ['word', 'partOfSpeech', 'meaningVi'], itemPath);
    assertRequiredKeys(itemRecord, ['word', 'partOfSpeech', 'meaningVi'], itemPath);
    return {
      word: requiredString(itemRecord, 'word', itemPath),
      partOfSpeech: nullableString(itemRecord, 'partOfSpeech', itemPath),
      meaningVi: nullableString(itemRecord, 'meaningVi', itemPath),
    };
  });
  return { items, raw: nullableString(record, 'raw', path) };
}

const PRACTICE_KEYS = [
  'attemptId', 'questionId', 'passageId', 'questionNumber', 'part',
  'selectedAnswer', 'correctAnswer', 'isCorrect', 'explanationEn',
  'explanationVi', 'aiExplanation', 'transcript', 'translation', 'vocabulary',
];

function mapPractice(value: unknown, path = 'response'): ToeicPracticeFeedback {
  const record = asRecord(value, path);
  assertExactKeys(record, PRACTICE_KEYS, path);
  assertRequiredKeys(record, PRACTICE_KEYS, path);
  const selectedAnswer = option(record, 'selectedAnswer', path);
  const isCorrect = record.isCorrect;
  if (typeof isCorrect !== 'boolean') fail(`Invalid learning correctness at ${path}.isCorrect`);
  return {
    attemptId: requiredUuid(record, 'attemptId', path),
    questionId: requiredUuid(record, 'questionId', path),
    passageId: nullableUuid(record, 'passageId', path),
    questionNumber: requiredInteger(record, 'questionNumber', path),
    part: partOf(record, 'part', path),
    selectedAnswer,
    correctAnswer: option(record, 'correctAnswer', path),
    isCorrect,
    explanationEn: nullableString(record, 'explanationEn', path),
    explanationVi: nullableString(record, 'explanationVi', path),
    aiExplanation: nullableString(record, 'aiExplanation', path),
    transcript: nullableString(record, 'transcript', path),
    translation: nullableString(record, 'translation', path),
    vocabulary: mapVocabulary(record.vocabulary, `${path}.vocabulary`),
  };
}

const REVIEW_QUESTION_KEYS = [
  ...PRACTICE_KEYS, 'isFlagged',
];

function mapReviewQuestion(value: unknown, index: number): ToeicReviewLearningQuestion {
  const path = `questions[${index}]`;
  const record = asRecord(value, path);
  assertExactKeys(record, REVIEW_QUESTION_KEYS, path);
  assertRequiredKeys(record, REVIEW_QUESTION_KEYS, path);
  const selectedAnswer = record.selectedAnswer === null ? null : option(record, 'selectedAnswer', path);
  const isCorrect = nullableBoolean(record, 'isCorrect', path);
  if (selectedAnswer === null && isCorrect !== null) fail(`Unanswered learning question must not have correctness at ${path}`);
  if (typeof record.isFlagged !== 'boolean') fail(`Invalid learning flag at ${path}.isFlagged`);
  return {
    attemptId: requiredUuid(record, 'attemptId', path),
    questionId: requiredUuid(record, 'questionId', path),
    passageId: nullableUuid(record, 'passageId', path),
    questionNumber: requiredInteger(record, 'questionNumber', path),
    part: partOf(record, 'part', path),
    selectedAnswer,
    correctAnswer: option(record, 'correctAnswer', path),
    isCorrect,
    explanationEn: nullableString(record, 'explanationEn', path),
    explanationVi: nullableString(record, 'explanationVi', path),
    aiExplanation: nullableString(record, 'aiExplanation', path),
    transcript: nullableString(record, 'transcript', path),
    translation: nullableString(record, 'translation', path),
    vocabulary: mapVocabulary(record.vocabulary, `${path}.vocabulary`),
    isFlagged: record.isFlagged === true,
  };
}

function mapPassage(value: unknown, index: number): ToeicReviewLearningPassage {
  const path = `passages[${index}]`;
  const record = asRecord(value, path);
  assertExactKeys(record, ['passageId', 'transcript', 'translation'], path);
  assertRequiredKeys(record, ['passageId', 'transcript', 'translation'], path);
  return {
    passageId: requiredUuid(record, 'passageId', path),
    transcript: nullableString(record, 'transcript', path),
    translation: nullableString(record, 'translation', path),
  };
}

export function mapToeicPracticeFeedbackResponse(value: unknown): ToeicPracticeFeedback {
  return mapPractice(value);
}

export function mapToeicAttemptReviewLearningResponse(value: unknown): ToeicAttemptReviewLearningContent {
  const record = asRecord(value, 'response');
  assertExactKeys(record, ['attemptId', 'testId', 'status', 'questions', 'passages'], 'response');
  assertRequiredKeys(record, ['attemptId', 'testId', 'status', 'questions', 'passages'], 'response');
  if (record.status !== 'submitted' || !Array.isArray(record.questions) || !Array.isArray(record.passages)) fail('Invalid learning review response');
  const questions = record.questions.map(mapReviewQuestion);
  const passages = record.passages.map(mapPassage);
  if (new Set(questions.map((item) => item.questionId)).size !== questions.length) fail('Duplicate learning review question');
  if (new Set(passages.map((item) => item.passageId)).size !== passages.length) fail('Duplicate learning review passage');
  const passageIds = new Set(passages.map((item) => item.passageId));
  const attemptId = requiredUuid(record, 'attemptId', 'response');
  for (const question of questions) {
    if (question.passageId !== null && !passageIds.has(question.passageId)) fail('Learning question references an unknown passage');
    if (question.attemptId !== attemptId) fail('Learning question attempt mismatch');
  }
  return {
    attemptId,
    testId: requiredUuid(record, 'testId', 'response'),
    status: 'submitted',
    questions,
    passages,
  };
}
