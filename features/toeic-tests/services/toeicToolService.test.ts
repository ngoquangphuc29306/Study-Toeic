import { describe, expect, it, vi } from 'vitest';
import { createToeicLookupService, createToeicToolService } from './toeicToolService';

const ids = { test: '11111111-1111-4111-8111-111111111111', note: '22222222-2222-4222-8222-222222222222' };
const date = '2026-08-05T00:00:00Z';

describe('toeic tool service', () => {
  it('validates note input before RPC', async () => { const rpc = vi.fn(); const service = createToeicToolService({ rpc }); await expect(service.upsertToeicNote({ testId: 'bad', questionId: null, content: 'note' })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(rpc).not.toHaveBeenCalled(); });
  it('maps stable RPC errors without exposing raw SQL text', async () => { const service = createToeicToolService({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'TARGET_NOT_FOUND internal detail' } }) }); await expect(service.listToeicNotes(ids.test)).rejects.toMatchObject({ code: 'TARGET_NOT_FOUND' }); });
  it('maps successful note response and sends canonical JSON content', async () => { const rpc = vi.fn().mockResolvedValue({ data: { id: ids.note, testId: ids.test, questionId: null, content: '{"version":1,"blocks":[{"type":"paragraph","children":[{"text":"note","marks":[]}]}]}', createdAt: date, updatedAt: date }, error: null }); const service = createToeicToolService({ rpc }); await expect(service.upsertToeicNote({ testId: ids.test, questionId: null, content: 'note' })).resolves.toMatchObject({ id: ids.note }); expect(rpc).toHaveBeenCalledWith('upsert_toeic_note', expect.objectContaining({ p_content: expect.stringContaining('"version":1') })); });
  it('rejects lookup inputs before the fetcher', async () => { const fetcher = vi.fn(); await expect(createToeicLookupService(fetcher).lookup('')).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(fetcher).not.toHaveBeenCalled(); });
  it('validates rich annotator geometry before the RPC and maps a saved shape', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: ids.note, testId: ids.test, questionId: ids.note, passageId: null, documentIndex: null, startOffset: 0, endOffset: 1, quote: '[annotation]', style: 'highlight', annotationType: 'rectangle', color: '#F472B6', strokeWidth: 2, geometry: { kind: 'box', x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, textContent: null, comment: null, createdAt: date, updatedAt: date }, error: null });
    const service = createToeicToolService({ rpc });
    await expect(service.createToeicAnnotatorAnnotation({ testId: ids.test, questionId: ids.note, passageId: null, documentIndex: null, startOffset: 0, endOffset: 1, quote: '[annotation]', annotationType: 'rectangle', color: '#F472B6', strokeWidth: 2, geometry: { kind: 'box', x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, textContent: null, comment: null })).resolves.toMatchObject({ annotationType: 'rectangle' });
    expect(rpc).toHaveBeenCalledWith('create_toeic_annotator_annotation', expect.objectContaining({ p_annotation_type: 'rectangle' }));
    await expect(service.createToeicAnnotatorAnnotation({ testId: ids.test, questionId: ids.note, passageId: null, documentIndex: null, startOffset: 0, endOffset: 1, quote: '[annotation]', annotationType: 'rectangle', color: 'red', strokeWidth: 2, geometry: { kind: 'box', x: 0, y: 0, width: 0.2, height: 0.2 }, textContent: null, comment: null })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
