import type {
  ToeicOptionKey,
  ToeicOptionMap,
  ToeicSection,
  ToeicTestPart,
} from './types';

export interface ToeicTestCatalogItem {
  id: string;
  name: string;
  setName: string;
  year: number;
  source: string;
  description: string | null;
  isFree: boolean;
  totalQuestions: number;
  durationSeconds: number;
}

export interface ToeicTestCatalogFilters {
  year?: number | null;
  setName?: string | null;
  source?: string | null;
  limit?: number;
  offset?: number;
}

export interface ToeicTestTakingMetadata {
  id: string;
  name: string;
  setName: string;
  year: number;
  source: string;
  durationSeconds: number;
}

export interface ToeicTestTakingPassage {
  id: string;
  part: ToeicTestPart;
  passageType: string | null;
  title: string | null;
  content: {
    documents: ReadonlyArray<{
      type: string;
      title: string | null;
      body: string;
    }>;
  };
  audioPath: string | null;
  imagePath: string | null;
  position: number;
}

export interface ToeicTestTakingQuestion {
  id: string;
  passageId: string | null;
  part: ToeicTestPart;
  section: ToeicSection;
  questionNumber: number;
  questionText: string | null;
  options: ToeicOptionMap;
  audioPath: string | null;
  imagePath: string | null;
  position: number;
}

export interface ToeicTestPartPayload {
  test: ToeicTestTakingMetadata;
  part: ToeicTestPart;
  passages: ReadonlyArray<ToeicTestTakingPassage>;
  questions: ReadonlyArray<ToeicTestTakingQuestion>;
}

export interface ToeicSignedMediaResult {
  path: string;
  signedUrl: string;
  expiresAt: string;
}

export type ToeicReadErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'TEST_NOT_FOUND'
  | 'TEST_NOT_PUBLISHED'
  | 'MEDIA_NOT_FOUND'
  | 'MEDIA_SIGNING_FAILED'
  | 'INVALID_RESPONSE'
  | 'READ_FAILED';

export class ToeicReadError extends Error {
  readonly code: ToeicReadErrorCode;

  constructor(code: ToeicReadErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToeicReadError';
    this.code = code;
  }
}

export const TOEIC_OPTION_KEYS: ReadonlyArray<ToeicOptionKey> = ['A', 'B', 'C', 'D'];

/** Keys that must never cross the test-taking read boundary. */
export const TOEIC_FORBIDDEN_READ_KEYS = new Set([
  'correct_answer',
  'correctAnswer',
  'is_correct',
  'isCorrect',
  'transcript',
  'translation',
  'explanation_en',
  'explanationEn',
  'explanation_vi',
  'explanationVi',
  'ai_explanation',
  'aiExplanation',
  'vocabulary_content',
  'vocabularyContent',
]);
