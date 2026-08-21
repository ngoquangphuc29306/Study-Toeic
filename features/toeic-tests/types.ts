/**
 * Production-facing domain vocabulary for the future TOEIC test module.
 *
 * These types intentionally keep answer keys separate from question content.
 * A client exam payload should use ToeicQuestionContent and never receive the
 * ToeicQuestionAnswerKey shape.
 */

export type ToeicTestPart = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ToeicSection = 'listening' | 'reading';
export type ToeicTestStatus = 'draft' | 'published' | 'archived';
export type ToeicTestMode = 'exam' | 'practice';
export type ToeicAttemptStatus = 'in_progress' | 'submitted' | 'abandoned' | 'expired';
export type ToeicOptionKey = 'A' | 'B' | 'C' | 'D';

export type ToeicOptionMap = Readonly<Record<ToeicOptionKey, string | null>>;

export interface ToeicTest {
  id: string;
  name: string;
  setName: string;
  year: number;
  source: string;
  description: string | null;
  isFree: boolean;
  mediaFolder: string;
  totalQuestions: number;
  status: ToeicTestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ToeicPassage {
  id: string;
  testId: string;
  part: ToeicTestPart;
  passageType: string | null;
  title: string | null;
  content: ToeicPassageContent;
  audioPath: string | null;
  imagePath: string | null;
  transcript: string | null;
  translation: string | null;
}

export interface ToeicQuestionContent {
  id: string;
  testId: string;
  passageId: string | null;
  part: ToeicTestPart;
  section: ToeicSection;
  questionNumber: number;
  questionText: string | null;
  options: ToeicOptionMap;
  audioPath: string | null;
  imagePath: string | null;
  transcript: string | null;
  explanationEn: string | null;
  explanationVi: string | null;
  aiExplanation: string | null;
  vocabularyContent: Readonly<Record<string, unknown>> | null;
}

export interface ToeicPassageContent {
  documents: ReadonlyArray<ToeicPassageDocument>;
}

export interface ToeicPassageDocument {
  type: string;
  title: string | null;
  body: string;
}

export interface ToeicQuestionAnswerKey {
  questionId: string;
  correctAnswer: ToeicOptionKey;
}

export interface ToeicVocabularyNote {
  word: string;
  meaningVi: string | null;
  partOfSpeech: string | null;
  example: string | null;
}

export interface ToeicAttempt {
  id: string;
  userId: string;
  testId: string;
  mode: ToeicTestMode;
  status: ToeicAttemptStatus;
  selectedParts: ReadonlyArray<ToeicTestPart>;
  startedAt: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  submitIdempotencyKey: string | null;
  submissionResult: Readonly<Record<string, unknown>> | null;
}

export interface ToeicAttemptQuestion {
  attemptId: string;
  testId: string;
  questionId: string;
  part: ToeicTestPart;
  position: number;
}

export interface ToeicAttemptAnswer {
  attemptId: string;
  questionId: string;
  selectedAnswer: ToeicOptionKey | null;
  isFlagged: boolean;
  answeredAt: string | null;
  timeSpentSeconds: number | null;
  isCorrect: boolean | null;
}

export interface ToeicAttemptResult {
  attemptId: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctQuestions: number;
  listeningCorrect: number;
  readingCorrect: number;
  submittedAt: string;
  scaledScore: number | null;
}
