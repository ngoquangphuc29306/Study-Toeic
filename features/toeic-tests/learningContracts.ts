import type { ToeicOptionKey, ToeicTestPart } from './types';

export interface ToeicLearningVocabularyItem {
  word: string;
  partOfSpeech: string | null;
  meaningVi: string | null;
}

export interface ToeicLearningVocabularyContent {
  items: ReadonlyArray<ToeicLearningVocabularyItem>;
  raw: string | null;
}

export interface ToeicPracticeAnswerInput {
  attemptId: string;
  questionId: string;
}

export interface ToeicPracticeFeedback {
  attemptId: string;
  questionId: string;
  passageId: string | null;
  questionNumber: number;
  part: ToeicTestPart;
  selectedAnswer: ToeicOptionKey;
  correctAnswer: ToeicOptionKey;
  isCorrect: boolean;
  explanationEn: string | null;
  explanationVi: string | null;
  aiExplanation: string | null;
  transcript: string | null;
  translation: string | null;
  vocabulary: ToeicLearningVocabularyContent | null;
}

export interface ToeicReviewLearningQuestion {
  attemptId: string;
  questionId: string;
  passageId: string | null;
  questionNumber: number;
  part: ToeicTestPart;
  selectedAnswer: ToeicOptionKey | null;
  correctAnswer: ToeicOptionKey;
  isCorrect: boolean | null;
  explanationEn: string | null;
  explanationVi: string | null;
  aiExplanation: string | null;
  transcript: string | null;
  translation: string | null;
  vocabulary: ToeicLearningVocabularyContent | null;
  isFlagged: boolean;
}

export interface ToeicReviewLearningPassage {
  passageId: string;
  transcript: string | null;
  translation: string | null;
}

export interface ToeicAttemptReviewLearningContent {
  attemptId: string;
  testId: string;
  status: 'submitted';
  questions: ReadonlyArray<ToeicReviewLearningQuestion>;
  passages: ReadonlyArray<ToeicReviewLearningPassage>;
}

export type ToeicLearningErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'ATTEMPT_NOT_FOUND'
  | 'ATTEMPT_NOT_OWNED'
  | 'PRACTICE_ONLY'
  | 'ATTEMPT_NOT_ACTIVE'
  | 'ANSWER_NOT_SAVED'
  | 'ATTEMPT_NOT_SUBMITTED'
  | 'ANSWER_KEY_INCOMPLETE'
  | 'READ_FAILED'
  | 'INVALID_RESPONSE';

export class ToeicLearningError extends Error {
  readonly code: ToeicLearningErrorCode;

  constructor(code: ToeicLearningErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToeicLearningError';
    this.code = code;
  }
}
