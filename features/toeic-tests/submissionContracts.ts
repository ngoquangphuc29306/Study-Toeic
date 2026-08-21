import type { ToeicOptionKey, ToeicTestMode, ToeicTestPart } from './types';

export interface SubmitToeicAttemptInput {
  attemptId: string;
  idempotencyKey: string;
}

export interface ToeicAttemptResultSummary {
  attemptId: string;
  testId: string;
  mode: ToeicTestMode;
  status: 'submitted';
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  correctQuestions: number;
  incorrectQuestions: number;
  listeningTotal: number;
  listeningCorrect: number;
  readingTotal: number;
  readingCorrect: number;
  submittedAt: string;
  scaledScore: null;
}

export interface ToeicReviewQuestion {
  questionId: string;
  questionNumber: number;
  part: ToeicTestPart;
  passageId: string | null;
  selectedAnswer: ToeicOptionKey | null;
  correctAnswer: ToeicOptionKey;
  isCorrect: boolean | null;
  isFlagged: boolean;
}

export interface ToeicAttemptReview {
  attemptId: string;
  testId: string;
  status: 'submitted';
  items: ReadonlyArray<ToeicReviewQuestion>;
}

export type ToeicSubmissionErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'ATTEMPT_NOT_FOUND'
  | 'ATTEMPT_NOT_OWNED'
  | 'ATTEMPT_NOT_SUBMITTABLE'
  | 'ATTEMPT_ALREADY_SUBMITTED'
  | 'ATTEMPT_NOT_SUBMITTED'
  | 'ANSWER_KEY_INCOMPLETE'
  | 'SUBMIT_IDEMPOTENCY_CONFLICT'
  | 'SUBMIT_FAILED'
  | 'READ_FAILED'
  | 'INVALID_RESPONSE';

export class ToeicSubmissionError extends Error {
  readonly code: ToeicSubmissionErrorCode;

  constructor(code: ToeicSubmissionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToeicSubmissionError';
    this.code = code;
  }
}
