import type { ToeicRichNoteDocument } from './services/toeicRichNote';

export type ToeicAnnotationStyle = 'highlight' | 'underline';

export interface ToeicNote {
  id: string;
  testId: string;
  questionId: string | null;
  content: string;
  document: ToeicRichNoteDocument;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertToeicNoteInput {
  testId: string;
  questionId: string | null;
  content: string;
}

export interface ToeicTextAnnotation {
  id: string;
  testId: string;
  questionId: string | null;
  passageId: string | null;
  documentIndex: number | null;
  startOffset: number;
  endOffset: number;
  quote: string;
  style: ToeicAnnotationStyle;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateToeicAnnotationInput {
  testId: string;
  questionId: string | null;
  passageId: string | null;
  documentIndex: number | null;
  startOffset: number;
  endOffset: number;
  quote: string;
  style: ToeicAnnotationStyle;
  comment: string | null;
}

export interface DictionaryLookupResult {
  term: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  definitions: ReadonlyArray<string>;
  examples: ReadonlyArray<string>;
}

export type ToeicToolErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'TEST_NOT_FOUND'
  | 'NOTE_NOT_FOUND'
  | 'ANNOTATION_NOT_FOUND'
  | 'TARGET_NOT_FOUND'
  | 'LOOKUP_UNAVAILABLE'
  | 'LOOKUP_RATE_LIMITED'
  | 'READ_FAILED'
  | 'SAVE_FAILED'
  | 'INVALID_RESPONSE';

export class ToeicToolError extends Error {
  readonly code: ToeicToolErrorCode;

  constructor(code: ToeicToolErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToeicToolError';
    this.code = code;
  }
}
