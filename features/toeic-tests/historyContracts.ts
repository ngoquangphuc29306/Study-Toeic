import type { ToeicTestMode, ToeicTestPart } from './types';

export type ToeicHistoryAttemptStatus = 'submitted' | 'abandoned' | 'expired';

export interface ToeicAttemptHistoryItem {
  attemptId: string;
  testId: string;
  testName: string;
  setName: string;
  source: string;
  mode: ToeicTestMode;
  status: ToeicHistoryAttemptStatus;
  selectedParts: ReadonlyArray<ToeicTestPart>;
  startedAt: string;
  submittedAt: string | null;
  totalQuestions: number;
  answeredQuestions: number | null;
  correctQuestions: number | null;
  listeningCorrect: number | null;
  listeningTotal: number | null;
  readingCorrect: number | null;
  readingTotal: number | null;
}

export interface ToeicAttemptHistoryPage {
  items: ReadonlyArray<ToeicAttemptHistoryItem>;
  limit: number;
  offset: number;
  total: number;
}

export interface ToeicTestProgressSummary {
  testId: string;
  totalAttempts: number;
  submittedAttempts: number;
  abandonedAttempts: number;
  expiredAttempts: number;
  latestAttemptId: string | null;
  latestSubmittedAt: string | null;
  bestCorrectQuestions: number | null;
  bestTotalQuestions: number | null;
  bestMode: ToeicTestMode | null;
  bestExamCorrectQuestions: number | null;
  bestExamTotalQuestions: number | null;
  bestPracticeCorrectQuestions: number | null;
  bestPracticeTotalQuestions: number | null;
  latestCorrectQuestions: number | null;
  latestTotalQuestions: number | null;
  completedParts: ReadonlyArray<ToeicTestPart>;
  hasActiveAttempt: boolean;
  hiddenFromProgress: boolean;
}

export interface ToeicAttemptHistoryFilters {
  testId?: string | null;
  mode?: ToeicTestMode | null;
  status?: ToeicHistoryAttemptStatus | null;
  limit?: number;
  offset?: number;
}

export interface StartToeicWrongQuestionAttemptInput {
  sourceAttemptId: string;
  idempotencyKey: string;
}

export type ToeicHistoryErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'ATTEMPT_NOT_FOUND'
  | 'ATTEMPT_NOT_OWNED'
  | 'ATTEMPT_NOT_SUBMITTED'
  | 'NO_WRONG_QUESTIONS'
  | 'DUPLICATE_ACTIVE_ATTEMPT'
  | 'TEST_NOT_FOUND'
  | 'SAVE_FAILED'
  | 'READ_FAILED'
  | 'INVALID_RESPONSE';

export class ToeicHistoryError extends Error {
  readonly code: ToeicHistoryErrorCode;

  constructor(code: ToeicHistoryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToeicHistoryError';
    this.code = code;
  }
}
