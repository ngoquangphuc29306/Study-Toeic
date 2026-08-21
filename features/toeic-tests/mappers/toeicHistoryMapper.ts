import type { ToeicTestMode, ToeicTestPart } from '../types';
import {
  ToeicHistoryError,
  type ToeicAttemptHistoryItem,
  type ToeicAttemptHistoryPage,
  type ToeicTestProgressSummary,
} from '../historyContracts';

type RecordLike = Record<string, unknown>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARTS: ReadonlyArray<ToeicTestPart> = [1, 2, 3, 4, 5, 6, 7];
const FORBIDDEN_KEYS = new Set([
  'user_id', 'userId', 'submit_idempotency_key', 'submission_idempotency_key',
  'correct_answer', 'correctAnswer', 'is_correct', 'isCorrect', 'answer_key', 'answerKey',
  'question_text', 'questionText', 'transcript', 'translation', 'explanation_en',
  'explanationEn', 'explanation_vi', 'explanationVi', 'vocabulary_content', 'vocabularyContent',
]);

function asRecord(value: unknown, path: string): RecordLike {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC history response at ${path}`);
  }
  return value as RecordLike;
}

function assertSafeKeys(value: unknown, path = 'response'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as RecordLike).forEach(([key, child]) => {
    if (FORBIDDEN_KEYS.has(key)) throw new ToeicHistoryError('INVALID_RESPONSE', `Forbidden TOEIC history field at ${path}.${key}`);
    assertSafeKeys(child, `${path}.${key}`);
  });
}

function requiredString(record: RecordLike, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC history field at ${path}.${key}`);
  return value;
}

function requiredUuid(record: RecordLike, key: string, path: string): string {
  const value = requiredString(record, key, path);
  if (!UUID_PATTERN.test(value)) throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC history UUID at ${path}.${key}`);
  return value;
}

function nullableUuid(record: RecordLike, key: string, path: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC history UUID at ${path}.${key}`);
  return value;
}

function requiredInteger(record: RecordLike, key: string, path: string): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 0) throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC history count at ${path}.${key}`);
  return value as number;
}

function nullableInteger(record: RecordLike, key: string, path: string): number | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return requiredInteger(record, key, path);
}

function requiredDate(record: RecordLike, key: string, path: string): string {
  const value = requiredString(record, key, path);
  if (Number.isNaN(Date.parse(value))) throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC history date at ${path}.${key}`);
  return value;
}

function nullableDate(record: RecordLike, key: string, path: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return requiredDate(record, key, path);
}

function mapParts(value: unknown, path: string, allowEmpty = false): ReadonlyArray<ToeicTestPart> {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((part) => !Number.isInteger(part) || !PARTS.includes(part as ToeicTestPart)) || new Set(value).size !== value.length) {
    throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC Parts at ${path}`);
  }
  return [...value].sort((left, right) => (left as number) - (right as number)) as ToeicTestPart[];
}

function mapMode(value: unknown, path: string): ToeicTestMode {
  if (value !== 'exam' && value !== 'practice') throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC mode at ${path}`);
  return value;
}

function mapHistoryItem(value: unknown, index: number): ToeicAttemptHistoryItem {
  const record = asRecord(value, `items[${index}]`);
  const status = record.status;
  if (status !== 'submitted' && status !== 'abandoned' && status !== 'expired') throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid TOEIC history status at items[${index}]`);
  const item = {
    attemptId: requiredUuid(record, 'attemptId', `items[${index}]`),
    testId: requiredUuid(record, 'testId', `items[${index}]`),
    testName: requiredString(record, 'testName', `items[${index}]`),
    setName: requiredString(record, 'setName', `items[${index}]`),
    source: requiredString(record, 'source', `items[${index}]`),
    mode: mapMode(record.mode, `items[${index}].mode`),
    status,
    selectedParts: mapParts(record.selectedParts, `items[${index}].selectedParts`),
    startedAt: requiredDate(record, 'startedAt', `items[${index}]`),
    submittedAt: nullableDate(record, 'submittedAt', `items[${index}]`),
    totalQuestions: requiredInteger(record, 'totalQuestions', `items[${index}]`),
    answeredQuestions: nullableInteger(record, 'answeredQuestions', `items[${index}]`),
    correctQuestions: nullableInteger(record, 'correctQuestions', `items[${index}]`),
    listeningCorrect: nullableInteger(record, 'listeningCorrect', `items[${index}]`),
    listeningTotal: nullableInteger(record, 'listeningTotal', `items[${index}]`),
    readingCorrect: nullableInteger(record, 'readingCorrect', `items[${index}]`),
    readingTotal: nullableInteger(record, 'readingTotal', `items[${index}]`),
  } satisfies ToeicAttemptHistoryItem;
  if (item.status === 'submitted' && (item.submittedAt === null || item.correctQuestions === null)) throw new ToeicHistoryError('INVALID_RESPONSE', `Submitted history item is incomplete at items[${index}]`);
  if (item.correctQuestions !== null && item.answeredQuestions !== null && item.correctQuestions > item.answeredQuestions) throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid history totals at items[${index}]`);
  return item;
}

function mapProgressItem(value: unknown, index: number): ToeicTestProgressSummary {
  const record = asRecord(value, `items[${index}]`);
  const path = `items[${index}]`;
  const bestMode = record.bestMode;
  if (bestMode !== null && bestMode !== 'exam' && bestMode !== 'practice') throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid best mode at ${path}`);
  if (typeof record.hasActiveAttempt !== 'boolean' || typeof record.hiddenFromProgress !== 'boolean') throw new ToeicHistoryError('INVALID_RESPONSE', `Invalid progress flags at ${path}`);
  return {
    testId: requiredUuid(record, 'testId', path),
    totalAttempts: requiredInteger(record, 'totalAttempts', path),
    submittedAttempts: requiredInteger(record, 'submittedAttempts', path),
    abandonedAttempts: requiredInteger(record, 'abandonedAttempts', path),
    expiredAttempts: requiredInteger(record, 'expiredAttempts', path),
    latestAttemptId: nullableUuid(record, 'latestAttemptId', path),
    latestSubmittedAt: nullableDate(record, 'latestSubmittedAt', path),
    bestCorrectQuestions: nullableInteger(record, 'bestCorrectQuestions', path),
    bestTotalQuestions: nullableInteger(record, 'bestTotalQuestions', path),
    bestMode,
    bestExamCorrectQuestions: nullableInteger(record, 'bestExamCorrectQuestions', path),
    bestExamTotalQuestions: nullableInteger(record, 'bestExamTotalQuestions', path),
    bestPracticeCorrectQuestions: nullableInteger(record, 'bestPracticeCorrectQuestions', path),
    bestPracticeTotalQuestions: nullableInteger(record, 'bestPracticeTotalQuestions', path),
    latestCorrectQuestions: nullableInteger(record, 'latestCorrectQuestions', path),
    latestTotalQuestions: nullableInteger(record, 'latestTotalQuestions', path),
    completedParts: record.completedParts === null ? [] : mapParts(record.completedParts, `${path}.completedParts`, true),
    hasActiveAttempt: record.hasActiveAttempt,
    hiddenFromProgress: record.hiddenFromProgress,
  };
}

export function mapToeicAttemptHistoryResponse(value: unknown): ToeicAttemptHistoryPage {
  assertSafeKeys(value);
  const record = asRecord(value, 'response');
  const historyKeys = new Set(['items', 'limit', 'offset', 'total']);
  if (Object.keys(record).some((key) => !historyKeys.has(key))) throw new ToeicHistoryError('INVALID_RESPONSE', 'Unexpected TOEIC history response field');
  if (!Array.isArray(record.items)) throw new ToeicHistoryError('INVALID_RESPONSE', 'Invalid TOEIC history items');
  const limit = requiredInteger(record, 'limit', 'response');
  const offset = requiredInteger(record, 'offset', 'response');
  const total = requiredInteger(record, 'total', 'response');
  const items = record.items.map(mapHistoryItem);
  if (limit < 1 || limit > 50 || offset > 100000 || items.length > limit || total < items.length) throw new ToeicHistoryError('INVALID_RESPONSE', 'Invalid TOEIC history pagination');
  return { items, limit, offset, total };
}

export function mapToeicTestProgressResponse(value: unknown): ReadonlyArray<ToeicTestProgressSummary> {
  assertSafeKeys(value);
  const record = asRecord(value, 'response');
  if (Object.keys(record).some((key) => key !== 'items')) throw new ToeicHistoryError('INVALID_RESPONSE', 'Unexpected TOEIC progress response field');
  if (!Array.isArray(record.items)) throw new ToeicHistoryError('INVALID_RESPONSE', 'Invalid TOEIC progress items');
  const items = record.items.map(mapProgressItem);
  if (new Set(items.map((item) => item.testId)).size !== items.length) throw new ToeicHistoryError('INVALID_RESPONSE', 'Duplicate TOEIC progress test');
  return items;
}
