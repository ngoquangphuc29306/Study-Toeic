export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface RawToeicTestMetadata {
  id: string;
  name: string;
  set_name: string;
  year: number;
  source: string;
  is_free: boolean;
  media_folder: string;
  total_questions: number;
}

export interface RawToeicQuestion {
  id: string;
  part: number;
  section: string;
  question_number: number;
  passage_id?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  question_text?: string | null;
  options: Record<string, unknown>;
  correct_answer: string;
  transcript?: string | null;
  passage_text?: string | null;
  passage_text_2?: string | null;
  passage_text_3?: string | null;
  passage_title?: string | null;
  passage_type?: string | null;
  dich_nghia?: string | null;
  dich_nghia_dap_an?: string | null;
  explanation_en?: string | null;
  explanation_vi?: string | null;
  ai_explanation?: string | null;
  tu_vung?: string | null;
}

export interface RawMediaCheck {
  total: number;
  ok: number;
  fixed: string[];
  broken: string[];
}

export interface RawToeicTestFile {
  test: RawToeicTestMetadata;
  scrapedAt: string;
  questionCount: number;
  passageCount: number;
  aiExplanationCount: number;
  mediaCheck: RawMediaCheck;
  questions: RawToeicQuestion[];
}

export type ImportIssueSeverity = 'warning' | 'error';

export interface ImportValidationIssue {
  severity: ImportIssueSeverity;
  code: string;
  path: string;
  message: string;
}

export interface ToeicPassageDocumentRow {
  type: string;
  title: string | null;
  body: string;
}

export interface NormalizedToeicTestRow {
  id: string;
  name: string;
  set_name: string;
  year: number;
  source: string;
  description: string | null;
  is_free: boolean;
  status: 'draft';
  media_folder: string;
  total_questions: number;
  duration_seconds: number;
}

export interface NormalizedToeicPassageRow {
  id: string;
  test_id: string;
  part: number;
  passage_type: string | null;
  title: string | null;
  content: { documents: ToeicPassageDocumentRow[] };
  transcript: string | null;
  translation: string | null;
  audio_path: string | null;
  image_path: string | null;
  position: number;
}

export interface NormalizedToeicQuestionRow {
  id: string;
  test_id: string;
  passage_id: string | null;
  part: number;
  section: 'listening' | 'reading';
  question_number: number;
  question_text: string | null;
  options: { A: string | null; B: string | null; C: string | null; D: string | null };
  explanation_en: string | null;
  explanation_vi: string | null;
  ai_explanation: string | null;
  vocabulary_content: JsonObject | null;
  audio_path: string | null;
  image_path: string | null;
  position: number;
}

export interface NormalizedToeicAnswerKeyRow {
  question_id: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
}

export interface ToeicMediaManifestEntry {
  path: string;
  kind: 'audio' | 'image';
  extension: string;
  usedByQuestionNumbers: number[];
  passageId: string | null;
}

export interface MediaVerificationSummary {
  expected: string[];
  found: string[];
  missing: string[];
  extra: string[];
  duplicateBasenames: string[];
  zeroSize: string[];
}

export interface NormalizedToeicImport {
  test: NormalizedToeicTestRow;
  passages: NormalizedToeicPassageRow[];
  questions: NormalizedToeicQuestionRow[];
  answerKeys: NormalizedToeicAnswerKeyRow[];
  mediaManifest: ToeicMediaManifestEntry[];
  warnings: ImportValidationIssue[];
  errors: ImportValidationIssue[];
  sourceHash: string;
}

export interface ToeicImportReport {
  mode: 'dry-run' | 'apply';
  testId: string;
  sourceHash: string;
  inputFilename: string;
  counts: {
    questions: number;
    passages: number;
    answerKeys: number;
    audioObjects: number;
    imageObjects: number;
  };
  warnings: ImportValidationIssue[];
  errors: ImportValidationIssue[];
  mediaVerification: MediaVerificationSummary | null;
  databaseApplied: boolean;
  databaseResult: {
    replacedDraft: boolean;
    counts: { questions: number; passages: number; answerKeys: number };
  } | null;
  generatedAt: string;
}
