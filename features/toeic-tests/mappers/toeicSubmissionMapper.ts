import type { ToeicOptionKey, ToeicTestMode, ToeicTestPart } from '../types';
import {
  ToeicSubmissionError,
  type ToeicAttemptResultSummary,
  type ToeicAttemptReview,
  type ToeicReviewQuestion,
} from '../submissionContracts';

type RecordLike = Record<string, unknown>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTION_KEYS: ReadonlyArray<ToeicOptionKey> = ['A', 'B', 'C', 'D'];
const FORBIDDEN_REVIEW_KEYS = new Set([
  'correct_answer', 'is_correct', 'transcript', 'translation',
  'explanation_en', 'explanation_vi', 'ai_explanation', 'vocabulary_content',
]);

function asRecord(value: unknown, path: string): RecordLike {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC submission response at ${path}`);
  }
  return value as RecordLike;
}

function assertSafeKeys(value: unknown, path: string, forbiddenKeys: ReadonlySet<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeKeys(item, `${path}[${index}]`, forbiddenKeys));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as RecordLike).forEach(([key, child]) => {
    if (forbiddenKeys.has(key)) throw new ToeicSubmissionError('INVALID_RESPONSE', `Forbidden TOEIC submission field at ${path}.${key}`);
    assertSafeKeys(child, `${path}.${key}`, forbiddenKeys);
  });
}

function requiredString(record: RecordLike, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC submission field at ${path}.${key}`);
  return value;
}

function requiredUuid(record: RecordLike, key: string, path: string): string {
  const value = requiredString(record, key, path);
  if (!UUID_PATTERN.test(value)) throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC submission UUID at ${path}.${key}`);
  return value;
}

function nullableUuid(record: RecordLike, key: string, path: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC submission UUID at ${path}.${key}`);
  return value;
}

function requiredInteger(record: RecordLike, key: string, path: string): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 0) throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC submission count at ${path}.${key}`);
  return value as number;
}

function requiredDate(record: RecordLike, key: string, path: string): string {
  const value = requiredString(record, key, path);
  if (Number.isNaN(Date.parse(value))) throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC submission timestamp at ${path}.${key}`);
  return value;
}

function mapMode(record: RecordLike, path: string): ToeicTestMode {
  const mode = record.mode;
  if (mode !== 'exam' && mode !== 'practice') throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC submission mode at ${path}.mode`);
  return mode;
}

function mapSummary(value: unknown): ToeicAttemptResultSummary {
  assertSafeKeys(value, 'response', FORBIDDEN_REVIEW_KEYS);
  const record = asRecord(value, 'response');
  if (record.status !== 'submitted' || record.scaledScore !== null) throw new ToeicSubmissionError('INVALID_RESPONSE', 'Invalid TOEIC result status or scaled score');
  const totalQuestions = requiredInteger(record, 'totalQuestions', 'response');
  const answeredQuestions = requiredInteger(record, 'answeredQuestions', 'response');
  const unansweredQuestions = requiredInteger(record, 'unansweredQuestions', 'response');
  const correctQuestions = requiredInteger(record, 'correctQuestions', 'response');
  const incorrectQuestions = requiredInteger(record, 'incorrectQuestions', 'response');
  if (answeredQuestions + unansweredQuestions !== totalQuestions || correctQuestions + incorrectQuestions !== answeredQuestions) {
    throw new ToeicSubmissionError('INVALID_RESPONSE', 'Inconsistent TOEIC result totals');
  }
  return {
    attemptId: requiredUuid(record, 'attemptId', 'response'),
    testId: requiredUuid(record, 'testId', 'response'),
    mode: mapMode(record, 'response'),
    status: 'submitted',
    totalQuestions,
    answeredQuestions,
    unansweredQuestions,
    correctQuestions,
    incorrectQuestions,
    listeningTotal: requiredInteger(record, 'listeningTotal', 'response'),
    listeningCorrect: requiredInteger(record, 'listeningCorrect', 'response'),
    readingTotal: requiredInteger(record, 'readingTotal', 'response'),
    readingCorrect: requiredInteger(record, 'readingCorrect', 'response'),
    submittedAt: requiredDate(record, 'submittedAt', 'response'),
    scaledScore: null,
  };
}

function nullableOption(record: RecordLike, key: string, path: string): ToeicOptionKey | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !OPTION_KEYS.includes(value as ToeicOptionKey)) throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC review option at ${path}.${key}`);
  return value as ToeicOptionKey;
}

function requiredOption(record: RecordLike, key: string, path: string): ToeicOptionKey {
  const value = nullableOption(record, key, path);
  if (!value) throw new ToeicSubmissionError('INVALID_RESPONSE', `Missing TOEIC review option at ${path}.${key}`);
  return value;
}

function mapReviewItem(value: unknown, index: number): ToeicReviewQuestion {
  const record = asRecord(value, `items[${index}]`);
  const path = `items[${index}]`;
  const isCorrect = record.isCorrect;
  if (isCorrect !== null && typeof isCorrect !== 'boolean') throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC review correctness at ${path}.isCorrect`);
  if (typeof record.isFlagged !== 'boolean') throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC review flag at ${path}.isFlagged`);
  const selectedAnswer = nullableOption(record, 'selectedAnswer', path);
  if (selectedAnswer === null && isCorrect !== null) throw new ToeicSubmissionError('INVALID_RESPONSE', `Unanswered TOEIC review item must not be correct at ${path}`);
  return {
    questionId: requiredUuid(record, 'questionId', path),
    questionNumber: requiredInteger(record, 'questionNumber', path),
    part: (() => { const part = requiredInteger(record, 'part', path); if (part < 1 || part > 7) throw new ToeicSubmissionError('INVALID_RESPONSE', `Invalid TOEIC review Part at ${path}`); return part as ToeicTestPart; })(),
    passageId: nullableUuid(record, 'passageId', path),
    selectedAnswer,
    correctAnswer: requiredOption(record, 'correctAnswer', path),
    isCorrect,
    isFlagged: record.isFlagged,
  };
}

export function mapToeicAttemptResultResponse(value: unknown): ToeicAttemptResultSummary {
  return mapSummary(value);
}

export function mapToeicAttemptReviewResponse(value: unknown): ToeicAttemptReview {
  assertSafeKeys(value, 'response', FORBIDDEN_REVIEW_KEYS);
  const record = asRecord(value, 'response');
  if (record.status !== 'submitted' || !Array.isArray(record.items)) throw new ToeicSubmissionError('INVALID_RESPONSE', 'Invalid TOEIC review response');
  const items = record.items.map(mapReviewItem);
  if (new Set(items.map((item) => item.questionId)).size !== items.length) throw new ToeicSubmissionError('INVALID_RESPONSE', 'Duplicate TOEIC review question');
  return {
    attemptId: requiredUuid(record, 'attemptId', 'response'),
    testId: requiredUuid(record, 'testId', 'response'),
    status: 'submitted',
    items,
  };
}
