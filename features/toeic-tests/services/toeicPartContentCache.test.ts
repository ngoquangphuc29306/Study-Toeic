import { describe, expect, it, vi } from 'vitest';
import { ToeicPartContentCache } from './toeicPartContentCache';

const payload = { test: { id: 'test', name: 'T', setName: 'S', year: 2026, source: 'x', durationSeconds: 1 }, part: 5 as const, passages: [], questions: [] };

describe('ToeicPartContentCache', () => {
  it('deduplicates concurrent reads and reuses completed data', async () => {
    let resolve!: (value: typeof payload) => void;
    const load = vi.fn(() => new Promise<typeof payload>((r) => { resolve = r; }));
    const cache = new ToeicPartContentCache(load);
    const first = cache.get('test', 5);
    const second = cache.get('test', 5);
    expect(load).toHaveBeenCalledTimes(1);
    resolve(payload);
    await expect(Promise.all([first, second])).resolves.toEqual([payload, payload]);
    await expect(cache.get('test', 5)).resolves.toBe(payload);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('allows a failed request to be retried', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce(payload);
    const cache = new ToeicPartContentCache(load);
    await expect(cache.get('test', 5)).rejects.toThrow('temporary');
    await expect(cache.get('test', 5)).resolves.toBe(payload);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
