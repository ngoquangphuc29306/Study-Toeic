import { ToeicToolError, type CreateToeicAnnotationInput, type CreateToeicAnnotatorAnnotationInput, type DictionaryLookupResult, type ToeicNote, type ToeicTextAnnotation, type UpsertToeicNoteInput } from '../toolContracts';
import { mapDictionaryLookupResponse, mapToeicAnnotationsResponse, mapToeicNotesResponse } from '../mappers/toeicToolMapper';
import { getToeicRichNotePlainText, parseStoredToeicNoteContent, serializeToeicRichNoteDocument, TOEIC_NOTE_MAX_SERIALIZED_LENGTH } from './toeicRichNote';
import { validateToeicAnnotatorInput } from './toeicAnnotator';

export interface ToeicToolRpcError { code?: string; message?: string; }
export interface ToeicToolRpcClient { rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: ToeicToolRpcError | null }>; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODES: ReadonlyArray<ToeicToolError['code']> = ['UNAUTHENTICATED','INVALID_INPUT','TEST_NOT_FOUND','NOTE_NOT_FOUND','ANNOTATION_NOT_FOUND','TARGET_NOT_FOUND','LOOKUP_UNAVAILABLE','LOOKUP_RATE_LIMITED','SAVE_FAILED','READ_FAILED'];

function checkUuid(value: string, field: string): void { if (!UUID.test(value)) throw new ToeicToolError('INVALID_INPUT', `Invalid TOEIC ${field}`); }
function mapRpcError(error: ToeicToolRpcError): ToeicToolError { const marker = `${error.code ?? ''} ${error.message ?? ''}`.toUpperCase(); const code = CODES.find((candidate) => marker.includes(candidate)) ?? 'READ_FAILED'; return new ToeicToolError(code, code === 'READ_FAILED' ? 'Không thể tải công cụ học.' : `TOEIC tool ${code.toLowerCase().replaceAll('_', ' ')}`, { cause: error }); }
function validateContent(content: string): string {
  const document = parseStoredToeicNoteContent(content);
  const plainText = getToeicRichNotePlainText(document);
  if (plainText.trim().length < 1 || plainText.length > 5000) throw new ToeicToolError('INVALID_INPUT', 'Nội dung ghi chú phải từ 1 đến 5000 ký tự.');
  try {
    const canonical = serializeToeicRichNoteDocument(document);
    if (canonical.length > TOEIC_NOTE_MAX_SERIALIZED_LENGTH) throw new ToeicToolError('INVALID_INPUT', 'Ghi chú có định dạng quá lớn.');
    return canonical;
  } catch (cause) {
    if (cause instanceof ToeicToolError) throw cause;
    throw new ToeicToolError('INVALID_INPUT', 'Định dạng ghi chú không hợp lệ.', { cause });
  }
}

export function createToeicToolService(client: ToeicToolRpcClient) {
  const call = async (name: string, args: Record<string, unknown>) => { const { data, error } = await client.rpc(name, args); if (error) throw mapRpcError(error); return data; };
  return {
    async listToeicNotes(testId: string): Promise<ReadonlyArray<ToeicNote>> { checkUuid(testId, 'test id'); return mapToeicNotesResponse(await call('get_toeic_notes', { p_test_id: testId })); },
    async upsertToeicNote(input: UpsertToeicNoteInput): Promise<ToeicNote> { checkUuid(input.testId, 'test id'); if (input.questionId) checkUuid(input.questionId, 'question id'); const content = validateContent(input.content); const value = mapToeicNotesResponse([await call('upsert_toeic_note', { p_test_id: input.testId, p_question_id: input.questionId, p_content: content })]); return value[0]; },
    async deleteToeicNote(noteId: string): Promise<void> { checkUuid(noteId, 'note id'); await call('delete_toeic_note', { p_note_id: noteId }); },
    async listToeicAnnotations(testId: string): Promise<ReadonlyArray<ToeicTextAnnotation>> { checkUuid(testId, 'test id'); return mapToeicAnnotationsResponse(await call('get_toeic_annotations', { p_test_id: testId, p_question_id: null, p_passage_id: null })); },
    async createToeicAnnotation(input: CreateToeicAnnotationInput): Promise<ToeicTextAnnotation> { checkUuid(input.testId, 'test id'); if ((input.questionId === null) === (input.passageId === null)) throw new ToeicToolError('INVALID_INPUT', 'Annotation phải thuộc question hoặc passage.'); if (input.questionId) checkUuid(input.questionId, 'question id'); if (input.passageId) checkUuid(input.passageId, 'passage id'); if (input.quote.trim().length < 1 || input.quote.length > 1000 || input.startOffset < 0 || input.endOffset <= input.startOffset || !Number.isInteger(input.startOffset) || !Number.isInteger(input.endOffset)) throw new ToeicToolError('INVALID_INPUT', 'Đoạn đánh dấu không hợp lệ.'); const value = mapToeicAnnotationsResponse([await call('create_toeic_annotation', { p_test_id: input.testId, p_question_id: input.questionId, p_passage_id: input.passageId, p_document_index: input.documentIndex, p_start_offset: input.startOffset, p_end_offset: input.endOffset, p_quote: input.quote, p_style: input.style, p_comment: input.comment })]); return value[0]; },
    async createToeicAnnotatorAnnotation(input: CreateToeicAnnotatorAnnotationInput): Promise<ToeicTextAnnotation> {
      checkUuid(input.testId, 'test id');
      if ((input.questionId === null) === (input.passageId === null)) throw new ToeicToolError('INVALID_INPUT', 'Annotation phải thuộc question hoặc passage.');
      if (input.questionId) checkUuid(input.questionId, 'question id');
      if (input.passageId) checkUuid(input.passageId, 'passage id');
      try { validateToeicAnnotatorInput(input); } catch (cause) { throw new ToeicToolError('INVALID_INPUT', cause instanceof Error ? cause.message : 'Annotation không hợp lệ.', { cause }); }
      const value = mapToeicAnnotationsResponse([await call('create_toeic_annotator_annotation', {
        p_test_id: input.testId, p_question_id: input.questionId, p_passage_id: input.passageId,
        p_document_index: input.documentIndex, p_start_offset: input.startOffset, p_end_offset: input.endOffset,
        p_quote: input.quote, p_annotation_type: input.annotationType, p_color: input.color,
        p_stroke_width: input.strokeWidth, p_geometry: input.geometry, p_text_content: input.textContent, p_comment: input.comment,
      })]);
      return value[0];
    },
    async updateToeicAnnotation(annotationId: string, input: Pick<CreateToeicAnnotationInput, 'startOffset' | 'endOffset' | 'quote' | 'style' | 'comment'>): Promise<ToeicTextAnnotation> { checkUuid(annotationId, 'annotation id'); const value = mapToeicAnnotationsResponse([await call('update_toeic_annotation', { p_annotation_id: annotationId, p_start_offset: input.startOffset, p_end_offset: input.endOffset, p_quote: input.quote, p_style: input.style, p_comment: input.comment })]); return value[0]; },
    async deleteToeicAnnotation(annotationId: string): Promise<void> { checkUuid(annotationId, 'annotation id'); await call('delete_toeic_annotation', { p_annotation_id: annotationId }); },
  };
}

export interface ToeicLookupFetcher { (term: string, context?: string): Promise<DictionaryLookupResult>; }
export function createToeicLookupService(fetcher: ToeicLookupFetcher) { return { lookup(term: string, context?: string) { const normalized = term.trim(); if (normalized.length < 1 || normalized.length > 80 || (context && context.length > 500)) return Promise.reject(new ToeicToolError('INVALID_INPUT', 'Từ tra cứu không hợp lệ.')); return fetcher(normalized, context?.trim()); } }; }

async function browserTools() { const { createClient } = await import('@/lib/supabase/client'); return createToeicToolService(createClient()); }
export async function listToeicNotes(testId: string) { return (await browserTools()).listToeicNotes(testId); }
export async function upsertToeicNote(input: UpsertToeicNoteInput) { return (await browserTools()).upsertToeicNote(input); }
export async function deleteToeicNote(noteId: string) { return (await browserTools()).deleteToeicNote(noteId); }
export async function listToeicAnnotations(testId: string) { return (await browserTools()).listToeicAnnotations(testId); }
export async function createToeicAnnotation(input: CreateToeicAnnotationInput) { return (await browserTools()).createToeicAnnotation(input); }
export async function createToeicAnnotatorAnnotation(input: CreateToeicAnnotatorAnnotationInput) { return (await browserTools()).createToeicAnnotatorAnnotation(input); }
export async function deleteToeicAnnotation(annotationId: string) { return (await browserTools()).deleteToeicAnnotation(annotationId); }
export async function lookupToeicTerm(term: string, context?: string) { return createToeicLookupService(async (normalizedTerm, normalizedContext) => { const response = await fetch('/api/toeic-tools/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ term: normalizedTerm, context: normalizedContext }) }); const body: unknown = await response.json().catch(() => null); if (!response.ok) { const code = body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string' ? (body as { code: string }).code : 'LOOKUP_UNAVAILABLE'; throw new ToeicToolError(CODES.includes(code as ToeicToolError['code']) ? code as ToeicToolError['code'] : 'LOOKUP_UNAVAILABLE', 'Không thể tra từ lúc này.'); } return mapDictionaryLookupResponse(body); }).lookup(term, context); }
