import type { ToeicOptionKey, ToeicTestMode, ToeicTestPart } from './types';

export interface StartToeicAttemptInput {
  testId: string;
  mode: ToeicTestMode;
  selectedParts: ReadonlyArray<ToeicTestPart>;
  idempotencyKey: string;
}

export interface GetActiveToeicAttemptInput {
  testId: string;
  mode: ToeicTestMode;
  selectedParts: ReadonlyArray<ToeicTestPart>;
}

export interface ToeicAttemptQuestionRef {
  questionId: string;
  part: ToeicTestPart;
  position: number;
}

export interface ToeicAttemptAnswerState {
  questionId: string;
  selectedAnswer: ToeicOptionKey | null;
  isFlagged: boolean;
  answeredAt: string | null;
  timeSpentSeconds: number | null;
  updatedAt: string;
}

export interface ToeicAttemptSession {
  attemptId: string;
  testId: string;
  mode: ToeicTestMode;
  status: 'in_progress' | 'submitted' | 'abandoned' | 'expired';
  selectedParts: ReadonlyArray<ToeicTestPart>;
  startedAt: string;
  deadlineAt: string | null;
  totalQuestions: number;
  questions: ReadonlyArray<ToeicAttemptQuestionRef>;
  answers: ReadonlyArray<ToeicAttemptAnswerState>;
  serverNow: string;
  remainingSeconds: number | null;
}

export interface ToeicAttemptAnswerMutation {
  questionId: string;
  selectedAnswer: ToeicOptionKey | null;
  isFlagged: boolean;
  answeredAt: string | null;
  timeSpentSeconds: number | null;
  clientMutationId: string;
}

export interface SaveToeicAttemptAnswersInput {
  attemptId: string;
  answers: ReadonlyArray<ToeicAttemptAnswerMutation>;
  mutationKey: string;
}

export interface SaveToeicAttemptAnswersResult {
  attemptId: string;
  saved: ReadonlyArray<ToeicAttemptAnswerState>;
  serverNow: string;
}

export type ToeicAttemptErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'TEST_NOT_FOUND'
  | 'TEST_NOT_PUBLISHED'
  | 'ATTEMPT_NOT_FOUND'
  | 'ATTEMPT_NOT_OWNED'
  | 'ATTEMPT_NOT_ACTIVE'
  | 'ATTEMPT_EXPIRED'
  | 'QUESTION_NOT_IN_ATTEMPT'
  | 'DUPLICATE_ACTIVE_ATTEMPT'
  | 'SAVE_FAILED'
  | 'READ_FAILED'
  | 'INVALID_RESPONSE';

export class ToeicAttemptError extends Error {
  readonly code: ToeicAttemptErrorCode;

  constructor(code: ToeicAttemptErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToeicAttemptError';
    this.code = code;
  }
}
