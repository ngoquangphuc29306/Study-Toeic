import { describe, expect, it, vi } from 'vitest';
import { createToeicLookupService, createToeicToolService } from './toeicToolService';

const ids = { test: '11111111-1111-4111-8111-111111111111', note: '22222222-2222-4222-8222-222222222222' };
const date = '2026-08-05T00:00:00Z';

describe('toeic tool service', () => {
  it('validates note input before RPC', async () => { const rpc = vi.fn(); const service = createToeicToolService({ rpc }); await expect(service.upsertToeicNote({ testId: 'bad', questionId: null, content: 'note' })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(rpc).not.toHaveBeenCalled(); });
  it('maps stable RPC errors without exposing raw SQL text', async () => { const service = createToeicToolService({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'TARGET_NOT_FOUND internal detail' } }) }); await expect(service.listToeicNotes(ids.test)).rejects.toMatchObject({ code: 'TARGET_NOT_FOUND' }); });
  it('maps successful note response', async () => { const service = createToeicToolService({ rpc: vi.fn().mockResolvedValue({ data: { id: ids.note, testId: ids.test, questionId: null, content: 'note', createdAt: date, updatedAt: date }, error: null }) }); await expect(service.upsertToeicNote({ testId: ids.test, questionId: null, content: 'note' })).resolves.toMatchObject({ id: ids.note }); });
  it('rejects lookup inputs before the fetcher', async () => { const fetcher = vi.fn(); await expect(createToeicLookupService(fetcher).lookup('')).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(fetcher).not.toHaveBeenCalled(); });
});
