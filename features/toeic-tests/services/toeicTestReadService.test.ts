import { describe, expect, it } from 'vitest';
import { createToeicTestReadService, type ToeicRpcClient } from './toeicTestReadService';

const testId = 'ad780150-f675-42b9-8ced-246862b0d0a8';

function createClient(response: { data: unknown; error: { message: string } | null }): ToeicRpcClient {
  return { rpc: async () => response };
}

describe('TOEIC test read service', () => {
  it('calls the catalog RPC with bounded, explicit arguments', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: ToeicRpcClient = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { items: [] }, error: null };
      },
    };

    await createToeicTestReadService(client).listPublishedToeicTests({ source: 'official', limit: 10 });
    expect(calls).toEqual([{
      name: 'list_published_toeic_tests',
      args: {
        p_year: null,
        p_set_name: null,
        p_source: 'official',
        p_limit: 10,
        p_offset: 0,
      },
    }]);
  });

  it('maps server auth errors without exposing raw database errors', async () => {
    const service = createToeicTestReadService(createClient({
      data: null,
      error: { message: 'UNAUTHENTICATED' },
    }));
    await expect(service.listPublishedToeicTests()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(service.listPublishedToeicTests()).rejects.not.toHaveProperty('message', 'UNAUTHENTICATED');
  });

  it('validates the test id before making a request', async () => {
    const rpc = async () => ({ data: { items: [] }, error: null });
    const service = createToeicTestReadService({ rpc });
    await expect(service.getPublishedToeicTestPart('not-a-uuid', 5)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('uses the part RPC and returns a safe mapped payload', async () => {
    const service = createToeicTestReadService(createClient({
      data: {
        test: { id: testId, name: 'Test', set_name: 'Set 1', year: 2026, source: 'official', duration_seconds: 7200 },
        part: 5,
        passages: [],
        questions: [],
      },
      error: null,
    }));
    const result = await service.getPublishedToeicTestPart(testId, 5);
    expect(result.part).toBe(5);
    expect(result.questions).toEqual([]);
  });
});
