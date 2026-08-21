import { createHash } from 'node:crypto';
import { normalizeToeicMediaSource } from '../mediaPath.ts';
import { getConfiguredToeicExternalMediaHosts, ToeicMediaSourceError } from '../mediaSource.ts';
import { toVocabularyContent, parseVocabularyContent } from './vocabulary.ts';
import type {
  ImportValidationIssue,
  JsonValue,
  NormalizedToeicImport,
  NormalizedToeicPassageRow,
  NormalizedToeicQuestionRow,
  RawToeicQuestion,
  RawToeicTestFile,
  ToeicMediaManifestEntry,
} from './types.ts';

function stableValue(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record).sort().map((key) => [key, stableValue(record[key])])
    );
  }
  return value as JsonValue;
}

export function sha256CanonicalJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
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

function consensus(
  questions: RawToeicQuestion[],
  field: keyof RawToeicQuestion,
  path: string,
  issues: ImportValidationIssue[],
  severity: 'warning' | 'error' = 'error'
): string | null {
  const values = questions
    .map((question) => question[field])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim());
  const unique = [...new Set(values)];
  if (unique.length > 1) {
    addIssue(issues, severity, 'passage_field_conflict', path, `Questions in one passage have conflicting ${String(field)} values.`);
  }
  return unique[0] ?? null;
}

function mediaConsensus(
  questions: RawToeicQuestion[],
  field: 'audio_url' | 'image_url',
  mediaFolder: string,
  path: string,
  errors: ImportValidationIssue[],
  allowedExternalMediaHosts: ReadonlySet<string>,
): string | null {
  const paths = questions
    .map((question) => question[field])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => {
      try {
        return normalizeToeicMediaSource(mediaFolder, value, allowedExternalMediaHosts)?.value ?? null;
      } catch (error) {
        addIssue(
          errors,
          'error',
          'invalid_media_source',
          `${path}.${field}`,
          error instanceof ToeicMediaSourceError ? error.message : 'Media source is invalid.',
        );
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));
  const unique = [...new Set(paths)];
  if (unique.length > 1) {
    addIssue(errors, 'error', 'passage_media_conflict', path, `Questions in one passage have conflicting ${field} paths.`);
  }
  return unique[0] ?? null;
}

function normalizeQuestionMedia(
  mediaFolder: string,
  source: string | null | undefined,
  path: string,
  errors: ImportValidationIssue[],
  allowedExternalMediaHosts: ReadonlySet<string>,
): string | null {
  if (!source?.trim()) return null;
  try {
    return normalizeToeicMediaSource(mediaFolder, source, allowedExternalMediaHosts)?.value ?? null;
  } catch (error) {
    addIssue(
      errors,
      'error',
      'invalid_media_source',
      path,
      error instanceof ToeicMediaSourceError ? error.message : 'Media source is invalid.',
    );
    return null;
  }
}

function passageDocuments(group: RawToeicQuestion[], errors: ImportValidationIssue[], path: string) {
  const textFields: Array<keyof RawToeicQuestion> = ['passage_text', 'passage_text_2', 'passage_text_3'];
  const type = consensus(group, 'passage_type', `${path}.passage_type`, errors) ?? 'text';
  const title = consensus(group, 'passage_title', `${path}.passage_title`, errors);
  return textFields.flatMap((field, index) => {
    const body = consensus(group, field, `${path}.${String(field)}`, errors);
    return body
      ? [{ type, title: index === 0 ? title : null, body }]
      : [];
  });
}

function manifestEntry(
  manifest: Map<string, ToeicMediaManifestEntry>,
  path: string,
  kind: 'audio' | 'image',
  questionNumbers: number[],
  passageId: string | null,
  warnings: ImportValidationIssue[],
  errors: ImportValidationIssue[]
): void {
  const extensionMatch = path.split(/[?#]/, 1)[0].match(/\.([^.\/]+)$/);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '';
  if (!['.mp3', '.webp'].includes(extension)) {
    addIssue(warnings, 'warning', 'unsupported_media_extension', path, `Media extension ${extension || '(none)'} is outside the source allowlist.`);
  }

  const existing = manifest.get(path);
  if (existing && existing.kind !== kind) {
    addIssue(errors, 'error', 'media_kind_conflict', path, 'The same object path is used as both audio and image.');
    return;
  }
  if (existing) {
    existing.usedByQuestionNumbers = [...new Set([...existing.usedByQuestionNumbers, ...questionNumbers])].sort((a, b) => a - b);
    if (existing.passageId !== passageId) existing.passageId = null;
    return;
  }

  manifest.set(path, {
    path,
    kind,
    extension,
    usedByQuestionNumbers: [...new Set(questionNumbers)].sort((a, b) => a - b),
    passageId,
  });
}

export function normalizeToeicImport(
  raw: RawToeicTestFile,
  initialWarnings: ImportValidationIssue[] = [],
  initialErrors: ImportValidationIssue[] = [],
  sourceHash = sha256CanonicalJson(raw),
  options: { allowedExternalMediaHosts?: ReadonlySet<string> } = {},
): NormalizedToeicImport {
  const warnings = [...initialWarnings];
  const errors = [...initialErrors];
  const allowedExternalMediaHosts = options.allowedExternalMediaHosts ?? getConfiguredToeicExternalMediaHosts();
  addIssue(warnings, 'warning', 'duration_defaulted', 'test.duration_seconds', 'Source JSON has no duration; importer default 7200 seconds was used.');
  const sortedQuestions = [...raw.questions].sort((a, b) => a.question_number - b.question_number);
  const groups = new Map<string, RawToeicQuestion[]>();
  for (const question of sortedQuestions) {
    if (question.passage_id) {
      const group = groups.get(question.passage_id) ?? [];
      group.push(question);
      groups.set(question.passage_id, group);
    }
  }

  const passages: NormalizedToeicPassageRow[] = [];
  const passageMedia = new Map<string, { audio: string | null; image: string | null }>();
  for (const [passageId, group] of groups.entries()) {
    const sortedGroup = [...group].sort((a, b) => a.question_number - b.question_number);
    const parts = new Set(sortedGroup.map((question) => question.part));
    if (parts.size > 1) {
      addIssue(errors, 'error', 'passage_crosses_parts', `passages.${passageId}`, 'A passage group cannot cross Parts.');
    }
    const part = sortedGroup[0].part;
    const audio = mediaConsensus(sortedGroup, 'audio_url', raw.test.media_folder, `passages.${passageId}.audio`, errors, allowedExternalMediaHosts);
    const image = mediaConsensus(sortedGroup, 'image_url', raw.test.media_folder, `passages.${passageId}.image`, errors, allowedExternalMediaHosts);
    passageMedia.set(passageId, { audio, image });
    passages.push({
      id: passageId,
      test_id: raw.test.id,
      part,
      passage_type: consensus(sortedGroup, 'passage_type', `passages.${passageId}.passage_type`, errors),
      title: consensus(sortedGroup, 'passage_title', `passages.${passageId}.title`, errors),
      content: { documents: passageDocuments(sortedGroup, errors, `passages.${passageId}.content`) },
      transcript: consensus(sortedGroup, 'transcript', `passages.${passageId}.transcript`, errors),
      translation: consensus(sortedGroup, 'dich_nghia', `passages.${passageId}.translation`, warnings, 'warning'),
      audio_path: audio,
      image_path: image,
      position: sortedGroup[0].question_number - 1,
    });
  }

  const answerKeys = sortedQuestions.map((question) => ({
    question_id: question.id,
    correct_answer: question.correct_answer as 'A' | 'B' | 'C' | 'D',
  }));
  const questions: NormalizedToeicQuestionRow[] = sortedQuestions.map((question, index) => {
    const sharedMedia = question.passage_id ? passageMedia.get(question.passage_id) : null;
    const audioPath = normalizeQuestionMedia(
      raw.test.media_folder,
      question.audio_url,
      `questions.${question.question_number}.audio_url`,
      errors,
      allowedExternalMediaHosts,
    );
    const imagePath = normalizeQuestionMedia(
      raw.test.media_folder,
      question.image_url,
      `questions.${question.question_number}.image_url`,
      errors,
      allowedExternalMediaHosts,
    );
    const parsedVocabulary = parseVocabularyContent(question.tu_vung);
    if (parsedVocabulary && parsedVocabulary.unparsedLineCount > 0) {
      addIssue(warnings, 'warning', 'vocabulary_partial_parse', `questions.${question.question_number}.tu_vung`, `${parsedVocabulary.unparsedLineCount} vocabulary line(s) were preserved in raw only.`);
    }
    if (parsedVocabulary && parsedVocabulary.items.length === 0) {
      addIssue(warnings, 'warning', 'vocabulary_raw_only', `questions.${question.question_number}.tu_vung`, 'Vocabulary was preserved as raw text because no item could be parsed.');
    }

    return {
      id: question.id,
      test_id: raw.test.id,
      passage_id: question.passage_id ?? null,
      part: question.part,
      section: question.section as 'listening' | 'reading',
      question_number: question.question_number,
      question_text: question.question_text ?? null,
      options: {
        A: typeof question.options.A === 'string' ? question.options.A.trim() : null,
        B: typeof question.options.B === 'string' ? question.options.B.trim() : null,
        C: typeof question.options.C === 'string' ? question.options.C.trim() : null,
        D: typeof question.options.D === 'string' ? question.options.D.trim() : null,
      },
      explanation_en: question.explanation_en ?? null,
      explanation_vi: question.explanation_vi ?? null,
      ai_explanation: question.ai_explanation ?? null,
      vocabulary_content: toVocabularyContent(question.tu_vung),
      audio_path: sharedMedia?.audio === audioPath ? null : audioPath,
      image_path: sharedMedia?.image === imagePath ? null : imagePath,
      position: index,
    };
  });

  const manifest = new Map<string, ToeicMediaManifestEntry>();
  for (const passage of passages) {
    const group = groups.get(passage.id) ?? [];
    if (passage.audio_path) manifestEntry(manifest, passage.audio_path, 'audio', group.map((q) => q.question_number), passage.id, warnings, errors);
    if (passage.image_path) manifestEntry(manifest, passage.image_path, 'image', group.map((q) => q.question_number), passage.id, warnings, errors);
  }
  for (const question of questions) {
    if (question.audio_path) manifestEntry(manifest, question.audio_path, 'audio', [question.question_number], question.passage_id, warnings, errors);
    if (question.image_path) manifestEntry(manifest, question.image_path, 'image', [question.question_number], question.passage_id, warnings, errors);
  }

  const sortedManifest = [...manifest.values()].sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
  return {
    test: {
      id: raw.test.id,
      name: raw.test.name,
      set_name: raw.test.set_name,
      year: raw.test.year,
      source: raw.test.source,
      description: null,
      is_free: raw.test.is_free,
      status: 'draft',
      media_folder: raw.test.media_folder,
      total_questions: raw.test.total_questions,
      duration_seconds: 7200,
    },
    passages: passages.sort((a, b) => a.position - b.position),
    questions,
    answerKeys,
    mediaManifest: sortedManifest,
    warnings,
    errors,
    sourceHash,
  };
}
