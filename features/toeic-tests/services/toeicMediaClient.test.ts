import { describe, expect, it, vi } from 'vitest';
import { createBrowserToeicMediaClient, createToeicMediaClient } from './toeicMediaClient';

describe('TOEIC media client', () => {
  it('caches signed URLs and refreshes near expiry', async () => {
    let now = Date.parse('2026-08-05T00:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValue([{ path: 'audio/a.mp3', signedUrl: 'url', expiresAt: '2026-08-05T00:02:00.000Z' }]);
    const client = createToeicMediaClient(fetcher, () => now);
    await client.get('test', 'audio/a.mp3');
    await client.get('test', 'audio/a.mp3');
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 80_000;
    await client.get('test', 'audio/a.mp3');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('sends canonical external URLs unchanged to the media route', async () => {
    const value = 'https://qfhmnlvgweznzcsoijyr.supabase.co/storage/v1/object/public/mock-test-media/2026/t1/1.webp';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ path: value, signedUrl: value, expiresAt: '2026-08-05T00:10:00.000Z', sourceType: 'external_url' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await createBrowserToeicMediaClient().get('test-id', value);
      const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { paths: string[] };
      expect(request.paths).toEqual([value]);
      expect(request.paths[0]).not.toMatch(/^\[/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
