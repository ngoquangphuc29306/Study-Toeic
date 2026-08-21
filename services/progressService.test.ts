import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProgressForVocabularies, ProgressRecord } from './progressService';

const mocks = vi.hoisted(() => ({
  inFn: vi.fn(),
  selectFn: vi.fn(),
  fromFn: vi.fn(),
  throwIfUnauthorized: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mocks.fromFn,
  }),
}));

vi.mock('@/lib/supabase/authRetry', () => ({
  throwIfUnauthorized: mocks.throwIfUnauthorized,
  isUnauthorizedError: () => false,
}));

describe('getProgressForVocabularies', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.fromFn.mockImplementation((table: string) => {
      if (table === 'user_vocab_progress') {
        return { select: mocks.selectFn };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    mocks.selectFn.mockImplementation(() => ({
      in: mocks.inFn,
    }));
  });

  it('TEST 1: returns empty Map and makes 0 queries when vocabularyIds is empty', async () => {
    const result = await getProgressForVocabularies([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mocks.fromFn).not.toHaveBeenCalled();
  });

  it('TEST 2: sends 1 request for 100 IDs', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `vocab-${i}`);
    mocks.inFn.mockResolvedValue({ data: [], error: null });

    const result = await getProgressForVocabularies(ids);

    expect(result).toBeInstanceOf(Map);
    expect(mocks.inFn).toHaveBeenCalledTimes(1);
    expect(mocks.inFn).toHaveBeenCalledWith('vocabulary_id', ids);
  });

  it('TEST 3: sends 1 request for 150 IDs', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `vocab-${i}`);
    mocks.inFn.mockResolvedValue({ data: [], error: null });

    await getProgressForVocabularies(ids);

    expect(mocks.inFn).toHaveBeenCalledTimes(1);
    expect(mocks.inFn).toHaveBeenCalledWith('vocabulary_id', ids);
  });

  it('TEST 4: sends 2 requests for 151 IDs (150 and 1)', async () => {
    const ids = Array.from({ length: 151 }, (_, i) => `vocab-${i}`);
    mocks.inFn.mockResolvedValue({ data: [], error: null });

    await getProgressForVocabularies(ids);

    expect(mocks.inFn).toHaveBeenCalledTimes(2);
    expect(mocks.inFn).toHaveBeenNthCalledWith(1, 'vocabulary_id', ids.slice(0, 150));
    expect(mocks.inFn).toHaveBeenNthCalledWith(2, 'vocabulary_id', ids.slice(150, 151));
  });

  it('TEST 5: sends 3 requests for 350 IDs with batch sizes 150, 150, 50', async () => {
    const ids = Array.from({ length: 350 }, (_, i) => `vocab-${i}`);
    mocks.inFn.mockResolvedValue({ data: [], error: null });

    await getProgressForVocabularies(ids);

    expect(mocks.inFn).toHaveBeenCalledTimes(3);
    expect(mocks.inFn).toHaveBeenNthCalledWith(1, 'vocabulary_id', ids.slice(0, 150));
    expect(mocks.inFn).toHaveBeenNthCalledWith(2, 'vocabulary_id', ids.slice(150, 300));
    expect(mocks.inFn).toHaveBeenNthCalledWith(3, 'vocabulary_id', ids.slice(300, 350));
  });

  it('TEST 6: sends 4 requests for 600 IDs', async () => {
    const ids = Array.from({ length: 600 }, (_, i) => `vocab-${i}`);
    mocks.inFn.mockResolvedValue({ data: [], error: null });

    await getProgressForVocabularies(ids);

    expect(mocks.inFn).toHaveBeenCalledTimes(4);
    for (let b = 0; b < 4; b++) {
      expect(mocks.inFn).toHaveBeenNthCalledWith(b + 1, 'vocabulary_id', ids.slice(b * 150, (b + 1) * 150));
    }
  });

  it('TEST 7: removes duplicate IDs before splitting into batches', async () => {
    const uniqueIds = Array.from({ length: 100 }, (_, i) => `vocab-${i}`);
    const duplicatedIds = [...uniqueIds, ...uniqueIds, ...uniqueIds];

    mocks.inFn.mockResolvedValue({ data: [], error: null });

    await getProgressForVocabularies(duplicatedIds);

    expect(mocks.inFn).toHaveBeenCalledTimes(1);
    expect(mocks.inFn).toHaveBeenCalledWith('vocabulary_id', uniqueIds);
  });

  it('TEST 8: correctly merges all batch responses into a single Map', async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `vocab-${i}`);

    const makeRecords = (subIds: string[]): ProgressRecord[] =>
      subIds.map((id) => ({
        id: `prog-${id}`,
        user_id: 'user-1',
        vocabulary_id: id,
        status: 'learning',
        interval_hours: 24,
        review_count: 1,
        again_count: 0,
        last_reviewed_at: '2026-08-21T00:00:00Z',
        next_review_at: '2026-08-22T00:00:00Z',
        created_at: '2026-08-21T00:00:00Z',
        updated_at: '2026-08-21T00:00:00Z',
      }));

    mocks.inFn.mockImplementation((_col: string, batchIds: string[]) => {
      return Promise.resolve({ data: makeRecords(batchIds), error: null });
    });

    const result = await getProgressForVocabularies(ids);

    expect(result.size).toBe(200);
    expect(result.get('vocab-0')?.id).toBe('prog-vocab-0');
    expect(result.get('vocab-199')?.id).toBe('prog-vocab-199');
  });

  it('TEST 9: rejects entire operation and returns no partial data if one batch fails', async () => {
    const ids = Array.from({ length: 300 }, (_, i) => `vocab-${i}`);

    mocks.inFn.mockImplementation((_col: string, batchIds: string[]) => {
      if (batchIds.includes('vocab-0')) {
        return Promise.resolve({ data: [{ vocabulary_id: 'vocab-0' }], error: null });
      }
      return Promise.resolve({ data: null, error: { message: 'Database connection reset' } });
    });

    await expect(getProgressForVocabularies(ids)).rejects.toThrow('Không thể tải tiến độ học. Vui lòng thử lại.');
  });

  it('TEST 10: invokes throwIfUnauthorized when a batch encounters an error', async () => {
    const ids = ['vocab-1'];
    const mockError = { message: 'JWT expired', status: 401 };

    mocks.inFn.mockResolvedValue({ data: null, error: mockError });

    await expect(getProgressForVocabularies(ids)).rejects.toThrow('Không thể tải tiến độ học. Vui lòng thử lại.');

    expect(mocks.throwIfUnauthorized).toHaveBeenCalledTimes(1);
    expect(mocks.throwIfUnauthorized).toHaveBeenCalledWith(mockError);
  });
});
