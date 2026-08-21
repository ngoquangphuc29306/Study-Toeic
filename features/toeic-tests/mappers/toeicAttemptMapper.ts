import type { ToeicOptionKey, ToeicTestMode, ToeicTestPart } from '../types';
import { TOEIC_FORBIDDEN_READ_KEYS } from '../readContracts';
import {
  ToeicAttemptError,
  type SaveToeicAttemptAnswersResult,
  type ToeicAttemptAnswerState,
  type ToeicAttemptQuestionRef,
  type ToeicAttemptSession,
} from '../attemptContracts';

type RecordLike = Record<string, unknown>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTION_KEYS: ReadonlyArray<ToeicOptionKey> = ['A', 'B', 'C', 'D'];

function asRecord(value: unknown, path: string): RecordLike {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt response at ${path}`);
  }
  return value as RecordLike;
}

function requiredString(record: RecordLike, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt response at ${path}.${key}`);
  }
  return value;
}

function requiredUuid(record: RecordLike, key: string, path: string): string {
  const value = requiredString(record, key, path);
  if (!UUID_PATTERN.test(value)) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt UUID at ${path}.${key}`);
  }
  return value;
}

function nullableString(record: RecordLike, key: string, path: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt response at ${path}.${key}`);
  }
  return value;
}

function requiredInteger(record: RecordLike, key: string, path: string, minimum = 0): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt response at ${path}.${key}`);
  }
  return value as number;
}

function nullableInteger(record: RecordLike, key: string, path: string, minimum = 0): number | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt response at ${path}.${key}`);
  }
  return value as number;
}

function requiredBoolean(record: RecordLike, key: string, path: string): boolean {
  if (typeof record[key] !== 'boolean') {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt response at ${path}.${key}`);
  }
  return record[key] as boolean;
}

function requiredDateString(record: RecordLike, key: string, path: string): string {
  const value = requiredString(record, key, path);
  if (Number.isNaN(Date.parse(value))) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt timestamp at ${path}.${key}`);
  }
  return value;
}

function nullableDateString(record: RecordLike, key: string, path: string): string | null {
  const value = nullableString(record, key, path);
  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt timestamp at ${path}.${key}`);
  }
  return value;
}

function requiredPart(record: RecordLike, key: string, path: string): ToeicTestPart {
  const value = requiredInteger(record, key, path, 1);
  if (value > 7) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid TOEIC attempt part at ${path}.${key}`);
  }
  return value as ToeicTestPart;
}

function assertSafeKeys(value: unknown, path = 'response'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as RecordLike).forEach(([key, child]) => {
    if (TOEIC_FORBIDDEN_READ_KEYS.has(key)) {
      throw new ToeicAttemptError('INVALID_RESPONSE', `Forbidden TOEIC attempt field at ${path}.${key}`);
    }
    assertSafeKeys(child, `${path}.${key}`);
  });
}

function mapAnswer(value: unknown, index: number): ToeicAttemptAnswerState {
  const record = asRecord(value, `answers[${index}]`);
  const path = `answers[${index}]`;
  const selectedAnswer = nullableString(record, 'selectedAnswer', path);
  if (selectedAnswer !== null && !OPTION_KEYS.includes(selectedAnswer as ToeicOptionKey)) {
    throw new ToeicAttemptError('INVALID_RESPONSE', `Invalid selected answer at ${path}.selectedAnswer`);
  }
  return {
    questionId: requiredUuid(record, 'questionId', path),
    selectedAnswer: selectedAnswer as ToeicOptionKey | null,
    isFlagged: requiredBoolean(record, 'isFlagged', path),
    answeredAt: nullableDateString(record, 'answeredAt', path),
    timeSpentSeconds: nullableInteger(record, 'timeSpentSeconds', path),
    updatedAt: requiredDateString(record, 'updatedAt', path),
  };
}

function mapQuestionRef(value: unknown, index: number): ToeicAttemptQuestionRef {
  const record = asRecord(value, `questions[${index}]`);
  const path = `questions[${index}]`;
  return {
    questionId: requiredUuid(record, 'questionId', path),
    part: requiredPart(record, 'part', path),
    position: requiredInteger(record, 'position', path),
  };
}

function mapSession(value: unknown): ToeicAttemptSession {
  const record = asRecord(value, 'response');
  const mode = record.mode;
  const status = record.status;
  if (mode !== 'exam' && mode !== 'practice') {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Invalid TOEIC attempt mode');
  }
  if (!['in_progress', 'submitted', 'abandoned', 'expired'].includes(status as string)) {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Invalid TOEIC attempt status');
  }

  const selectedParts = record.selectedParts;
  if (!Array.isArray(selectedParts) || selectedParts.length === 0 ||
      selectedParts.some((part) => !Number.isInteger(part) || (part as number) < 1 || (part as number) > 7) ||
      new Set(selectedParts).size !== selectedParts.length) {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Invalid TOEIC selected parts');
  }
  const questions = record.questions;
  const answers = record.answers;
  if (!Array.isArray(questions) || !Array.isArray(answers)) {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Invalid TOEIC attempt arrays');
  }
  const mappedQuestions = questions.map(mapQuestionRef);
  const questionIds = new Set(mappedQuestions.map((question) => question.questionId));
  if (questionIds.size !== mappedQuestions.length) {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Duplicate TOEIC attempt question');
  }
  const mappedAnswers = answers.map(mapAnswer);
  if (new Set(mappedAnswers.map((answer) => answer.questionId)).size !== mappedAnswers.length ||
      mappedAnswers.some((answer) => !questionIds.has(answer.questionId))) {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Invalid TOEIC attempt answer membership');
  }

  const totalQuestions = requiredInteger(record, 'totalQuestions', 'response');
  if (totalQuestions !== mappedQuestions.length) {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Invalid TOEIC attempt question count');
  }
  const remainingSeconds = nullableInteger(record, 'remainingSeconds', 'response');
  return {
    attemptId: requiredUuid(record, 'attemptId', 'response'),
    testId: requiredUuid(record, 'testId', 'response'),
    mode: mode as ToeicTestMode,
    status: status as ToeicAttemptSession['status'],
    selectedParts: selectedParts as ToeicTestPart[],
    startedAt: requiredDateString(record, 'startedAt', 'response'),
    deadlineAt: nullableDateString(record, 'deadlineAt', 'response'),
    totalQuestions,
    questions: mappedQuestions,
    answers: mappedAnswers,
    serverNow: requiredDateString(record, 'serverNow', 'response'),
    remainingSeconds,
  };
}

export function mapToeicAttemptSessionResponse(value: unknown): ToeicAttemptSession {
  assertSafeKeys(value);
  return mapSession(value);
}

export function mapSaveToeicAttemptAnswersResponse(value: unknown): SaveToeicAttemptAnswersResult {
  assertSafeKeys(value);
  const record = asRecord(value, 'response');
  if (!Array.isArray(record.saved)) {
    throw new ToeicAttemptError('INVALID_RESPONSE', 'Invalid TOEIC autosave response');
  }
  return {
    attemptId: requiredUuid(record, 'attemptId', 'response'),
    saved: record.saved.map(mapAnswer),
    serverNow: requiredDateString(record, 'serverNow', 'response'),
  };
}
