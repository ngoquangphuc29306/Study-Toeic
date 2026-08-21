import { buildToeicMediaPath } from '../mediaPath.ts';
import {
  getConfiguredToeicExternalMediaHosts,
  redactToeicMediaUrl,
  validateToeicMediaSource,
  ToeicMediaSourceError,
} from '../mediaSource.ts';
import type {
  ImportValidationIssue,
  RawMediaCheck,
  RawToeicQuestion,
  RawToeicTestFile,
  RawToeicTestMetadata,
} from './types.ts';

export interface RawValidationResult {
  value: RawToeicTestFile | null;
  warnings: ImportValidationIssue[];
  errors: ImportValidationIssue[];
}

export interface RawValidationOptions {
  allowedExternalMediaHosts?: ReadonlySet<string>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOP_LEVEL_KEYS = new Set([
  'test',
  'scrapedAt',
  'questionCount',
  'passageCount',
  'aiExplanationCount',
  'mediaCheck',
  'questions',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(
  target: ImportValidationIssue[],
  severity: 'warning' | 'error',
  code: string,
  path: string,
  message: string
): void {
  target.push({ severity, code, path, message });
}

function readNonEmptyString(
  value: unknown,
  path: string,
  errors: ImportValidationIssue[],
  allowNull = false
): string | null {
  if (allowNull && value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    addIssue(errors, 'error', 'invalid_string', path, 'Expected a non-empty string.');
    return null;
  }
  return value.trim();
}

function readOptionalString(
  value: unknown,
  path: string,
  errors: ImportValidationIssue[]
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    addIssue(errors, 'error', 'invalid_optional_string', path, 'Expected a string or null.');
    return null;
  }
  return value;
}

function readInteger(value: unknown, path: string, errors: ImportValidationIssue[]): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    addIssue(errors, 'error', 'invalid_integer', path, 'Expected an integer.');
    return null;
  }
  return value;
}

function readBoolean(value: unknown, path: string, errors: ImportValidationIssue[]): boolean | null {
  if (typeof value !== 'boolean') {
    addIssue(errors, 'error', 'invalid_boolean', path, 'Expected a boolean.');
    return null;
  }
  return value;
}

function readUuid(value: unknown, path: string, errors: ImportValidationIssue[]): string | null {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    addIssue(errors, 'error', 'invalid_uuid', path, 'Expected a UUID.');
    return null;
  }
  return value;
}

function validateMediaValue(
  value: string | null,
  path: string,
  mediaFolder: string,
  errors: ImportValidationIssue[],
  allowedExternalMediaHosts: ReadonlySet<string>,
): void {
  if (value === null) return;
  try {
    const source = validateToeicMediaSource(value, allowedExternalMediaHosts);
    if (source.type === 'storage_path' && !buildToeicMediaPath(mediaFolder, source.value)) {
      addIssue(errors, 'error', 'unsafe_media_path', path, 'Media path is missing or contains unsafe traversal.');
    }
  } catch (error) {
    const reason = error instanceof ToeicMediaSourceError ? error.message : 'Media value is invalid.';
    addIssue(errors, 'error', 'invalid_media_source', path, `${reason} Value: ${redactToeicMediaUrl(value)}`);
  }
}

function validateOptions(
  value: unknown,
  path: string,
  errors: ImportValidationIssue[]
): Record<string, unknown> {
  if (!isRecord(value)) {
    addIssue(errors, 'error', 'invalid_options', path, 'Options must be an object.');
    return {};
  }

  for (const key of Object.keys(value)) {
    if (!['A', 'B', 'C', 'D'].includes(key)) {
      addIssue(errors, 'error', 'unknown_option_key', `${path}.${key}`, 'Only A, B, C and D are allowed.');
    }
  }

  for (const key of ['A', 'B', 'C']) {
    if (typeof value[key] !== 'string' || value[key].trim() === '') {
      addIssue(errors, 'error', 'invalid_required_option', `${path}.${key}`, 'Option A, B and C must be strings.');
    }
  }

  if (!(typeof value.D === 'string' || value.D === null)) {
    addIssue(errors, 'error', 'invalid_optional_option', `${path}.D`, 'Option D must be a string or null.');
  }

  return value;
}

function validateQuestion(
  value: unknown,
  index: number,
  mediaFolder: string,
  errors: ImportValidationIssue[],
  allowedExternalMediaHosts: ReadonlySet<string>,
): RawToeicQuestion | null {
  const path = `questions[${index}]`;
  if (!isRecord(value)) {
    addIssue(errors, 'error', 'invalid_question', path, 'Question must be an object.');
    return null;
  }

  const id = readUuid(value.id, `${path}.id`, errors);
  const part = readInteger(value.part, `${path}.part`, errors);
  const section = readNonEmptyString(value.section, `${path}.section`, errors);
  const questionNumber = readInteger(value.question_number, `${path}.question_number`, errors);
  const passageId = value.passage_id === undefined || value.passage_id === null
    ? null
    : readUuid(value.passage_id, `${path}.passage_id`, errors);
  const options = validateOptions(value.options, `${path}.options`, errors);
  const correctAnswer = readNonEmptyString(value.correct_answer, `${path}.correct_answer`, errors);
  const audioUrl = readOptionalString(value.audio_url, `${path}.audio_url`, errors);
  const imageUrl = readOptionalString(value.image_url, `${path}.image_url`, errors);

  if (part !== null && (part < 1 || part > 7)) {
    addIssue(errors, 'error', 'invalid_part', `${path}.part`, 'Part must be between 1 and 7.');
  }
  if (part !== null && section !== null) {
    const expected = part <= 4 ? 'listening' : 'reading';
    if (section !== expected) {
      addIssue(errors, 'error', 'section_part_mismatch', `${path}.section`, `Part ${part} must use ${expected}.`);
    }
  }
  if (questionNumber !== null && questionNumber <= 0) {
    addIssue(errors, 'error', 'invalid_question_number', `${path}.question_number`, 'Question number must be positive.');
  }
  if (correctAnswer !== null && !['A', 'B', 'C', 'D'].includes(correctAnswer)) {
    addIssue(errors, 'error', 'invalid_correct_answer', `${path}.correct_answer`, 'Correct answer must be A, B, C or D.');
  } else if (correctAnswer !== null && options[correctAnswer] === null) {
    addIssue(errors, 'error', 'correct_answer_is_null', `${path}.correct_answer`, 'Correct answer cannot point to a null option.');
  }

  validateMediaValue(audioUrl, `${path}.audio_url`, mediaFolder, errors, allowedExternalMediaHosts);
  validateMediaValue(imageUrl, `${path}.image_url`, mediaFolder, errors, allowedExternalMediaHosts);

  const optionalFields = [
    'transcript',
    'passage_text',
    'passage_text_2',
    'passage_text_3',
    'passage_title',
    'passage_type',
    'dich_nghia',
    'dich_nghia_dap_an',
    'explanation_en',
    'explanation_vi',
    'ai_explanation',
    'tu_vung',
  ];
  for (const field of optionalFields) {
    readOptionalString(value[field], `${path}.${field}`, errors);
  }

  if (id === null || part === null || section === null || questionNumber === null || correctAnswer === null) {
    return null;
  }

  return {
    id,
    part,
    section,
    question_number: questionNumber,
    passage_id: passageId,
    audio_url: audioUrl,
    image_url: imageUrl,
    question_text: readOptionalString(value.question_text, `${path}.question_text`, errors),
    options,
    correct_answer: correctAnswer,
    transcript: readOptionalString(value.transcript, `${path}.transcript`, errors),
    passage_text: readOptionalString(value.passage_text, `${path}.passage_text`, errors),
    passage_text_2: readOptionalString(value.passage_text_2, `${path}.passage_text_2`, errors),
    passage_text_3: readOptionalString(value.passage_text_3, `${path}.passage_text_3`, errors),
    passage_title: readOptionalString(value.passage_title, `${path}.passage_title`, errors),
    passage_type: readOptionalString(value.passage_type, `${path}.passage_type`, errors),
    dich_nghia: readOptionalString(value.dich_nghia, `${path}.dich_nghia`, errors),
    dich_nghia_dap_an: readOptionalString(value.dich_nghia_dap_an, `${path}.dich_nghia_dap_an`, errors),
    explanation_en: readOptionalString(value.explanation_en, `${path}.explanation_en`, errors),
    explanation_vi: readOptionalString(value.explanation_vi, `${path}.explanation_vi`, errors),
    ai_explanation: readOptionalString(value.ai_explanation, `${path}.ai_explanation`, errors),
    tu_vung: readOptionalString(value.tu_vung, `${path}.tu_vung`, errors),
  };
}

function validateMediaCheck(value: unknown, errors: ImportValidationIssue[]): RawMediaCheck | null {
  if (!isRecord(value)) {
    addIssue(errors, 'error', 'invalid_media_check', 'mediaCheck', 'mediaCheck must be an object.');
    return null;
  }
  const total = readInteger(value.total, 'mediaCheck.total', errors);
  const ok = readInteger(value.ok, 'mediaCheck.ok', errors);
  const fixed = Array.isArray(value.fixed) && value.fixed.every((entry) => typeof entry === 'string')
    ? value.fixed
    : null;
  const broken = Array.isArray(value.broken) && value.broken.every((entry) => typeof entry === 'string')
    ? value.broken
    : null;
  if (!fixed) addIssue(errors, 'error', 'invalid_media_fixed', 'mediaCheck.fixed', 'Expected an array of strings.');
  if (!broken) addIssue(errors, 'error', 'invalid_media_broken', 'mediaCheck.broken', 'Expected an array of strings.');
  if (total === null || ok === null || !fixed || !broken) return null;
  return { total, ok, fixed, broken };
}

export function validateRawToeicTestFile(
  input: unknown,
  options: RawValidationOptions = {},
): RawValidationResult {
  const warnings: ImportValidationIssue[] = [];
  const errors: ImportValidationIssue[] = [];

  if (!isRecord(input)) {
    addIssue(errors, 'error', 'invalid_root', '$', 'Root JSON value must be an object.');
    return { value: null, warnings, errors };
  }

  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      addIssue(warnings, 'warning', 'unknown_top_level_field', key, 'Unknown top-level field was ignored.');
    }
  }

  if (!isRecord(input.test)) {
    addIssue(errors, 'error', 'invalid_test_metadata', 'test', 'test must be an object.');
    return { value: null, warnings, errors };
  }

  const metadata = input.test;
  const id = readUuid(metadata.id, 'test.id', errors);
  const name = readNonEmptyString(metadata.name, 'test.name', errors);
  const setName = readNonEmptyString(metadata.set_name, 'test.set_name', errors);
  const year = readInteger(metadata.year, 'test.year', errors);
  const source = readNonEmptyString(metadata.source, 'test.source', errors);
  const isFree = readBoolean(metadata.is_free, 'test.is_free', errors);
  const mediaFolder = readNonEmptyString(metadata.media_folder, 'test.media_folder', errors);
  const totalQuestions = readInteger(metadata.total_questions, 'test.total_questions', errors);

  if (year !== null && (year < 2000 || year > 2100)) {
    addIssue(errors, 'error', 'invalid_year', 'test.year', 'Year must be between 2000 and 2100.');
  }
  if (mediaFolder && !buildToeicMediaPath(mediaFolder, mediaFolder)) {
    addIssue(errors, 'error', 'unsafe_media_folder', 'test.media_folder', 'media_folder must be a safe relative path.');
  }
  if (totalQuestions !== null && totalQuestions <= 0) {
    addIssue(errors, 'error', 'invalid_total_questions', 'test.total_questions', 'total_questions must be positive.');
  }
  if (setName && year !== null && setName !== String(year)) {
    addIssue(warnings, 'warning', 'metadata_year_mismatch', 'test', `set_name (${setName}) differs from year (${year}); source value was preserved.`);
  }

  const scrapedAt = readNonEmptyString(input.scrapedAt, 'scrapedAt', errors);
  const questionCount = readInteger(input.questionCount, 'questionCount', errors);
  const passageCount = readInteger(input.passageCount, 'passageCount', errors);
  const aiExplanationCount = readInteger(input.aiExplanationCount, 'aiExplanationCount', errors);
  const mediaCheck = validateMediaCheck(input.mediaCheck, errors);
  const questionsInput = Array.isArray(input.questions) ? input.questions : null;
  if (!questionsInput) addIssue(errors, 'error', 'invalid_questions', 'questions', 'questions must be an array.');

  if (id === null || name === null || setName === null || year === null || source === null || isFree === null || mediaFolder === null || totalQuestions === null || scrapedAt === null || questionCount === null || passageCount === null || aiExplanationCount === null || mediaCheck === null || !questionsInput) {
    return { value: null, warnings, errors };
  }

  const allowedExternalMediaHosts = options.allowedExternalMediaHosts ?? getConfiguredToeicExternalMediaHosts();
  const questions: RawToeicQuestion[] = [];
  for (const [index, question] of questionsInput.entries()) {
    const validated = validateQuestion(question, index, mediaFolder, errors, allowedExternalMediaHosts);
    if (validated) questions.push(validated);
  }

  if (questionCount !== questionsInput.length || totalQuestions !== questionsInput.length) {
    addIssue(errors, 'error', 'question_count_mismatch', 'questions', `Expected ${totalQuestions} questions, received ${questionsInput.length}.`);
  }
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    addIssue(errors, 'error', 'duplicate_question_id', 'questions', 'Question IDs must be unique.');
  }
  if (new Set(questions.map((question) => question.question_number)).size !== questions.length) {
    addIssue(errors, 'error', 'duplicate_question_number', 'questions', 'Question numbers must be unique.');
  }
  const passageIds = new Set(questions.flatMap((question) => question.passage_id ? [question.passage_id] : []));
  if (passageCount !== passageIds.size) {
    addIssue(errors, 'error', 'passage_count_mismatch', 'passageCount', `Expected ${passageCount} passages, found ${passageIds.size}.`);
  }
  const aiCount = questions.filter((question) => question.ai_explanation !== null).length;
  if (aiExplanationCount !== aiCount) {
    addIssue(errors, 'error', 'ai_explanation_count_mismatch', 'aiExplanationCount', `Expected ${aiExplanationCount} explanations, found ${aiCount}.`);
  }
  const mediaPaths = new Set(
    questions.flatMap((question) => [question.audio_url, question.image_url].filter((value): value is string => Boolean(value)))
  );
  if (mediaCheck.total !== mediaPaths.size) {
    addIssue(errors, 'error', 'media_count_mismatch', 'mediaCheck.total', `Expected ${mediaCheck.total} unique media URLs, found ${mediaPaths.size}.`);
  }

  const typedMetadata: RawToeicTestMetadata = {
    id,
    name,
    set_name: setName,
    year,
    source,
    is_free: isFree,
    media_folder: mediaFolder,
    total_questions: totalQuestions,
  };
  return {
    value: { test: typedMetadata, scrapedAt, questionCount, passageCount, aiExplanationCount, mediaCheck, questions },
    warnings,
    errors,
  };
}
