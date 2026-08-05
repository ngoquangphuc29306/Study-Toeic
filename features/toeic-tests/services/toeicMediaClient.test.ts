import { describe, expect, it, vi } from 'vitest';
import { createToeicMediaClient } from './toeicMediaClient';

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
});
