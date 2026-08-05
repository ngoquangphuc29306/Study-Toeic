import { ToeicReadError, type ToeicSignedMediaResult } from '../readContracts';

export interface ToeicMediaUrlFetcher {
  (testId: string, paths: ReadonlyArray<string>): Promise<ReadonlyArray<ToeicSignedMediaResult>>;
}

export interface ToeicMediaClient {
  get(testId: string, path: string): Promise<ToeicSignedMediaResult>;
  clear(): void;
}

const REFRESH_BUFFER_MS = 45_000;

function isSignedMediaResult(value: unknown): value is ToeicSignedMediaResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.path === 'string' && typeof item.signedUrl === 'string' && typeof item.expiresAt === 'string' && !Number.isNaN(Date.parse(item.expiresAt));
}

export function createToeicMediaClient(
  fetcher: ToeicMediaUrlFetcher,
  now: () => number = Date.now
): ToeicMediaClient {
  const cache = new Map<string, ToeicSignedMediaResult>();
  return {
    async get(testId, path) {
      if (!path.trim()) throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media path');
      const key = `${testId}:${path}`;
      const cached = cache.get(key);
      if (cached && Date.parse(cached.expiresAt) - now() > REFRESH_BUFFER_MS) return cached;
      const result = await fetcher(testId, [path]);
      const signed = result.find((item) => item.path === path);
      if (!signed) throw new ToeicReadError('MEDIA_NOT_FOUND', 'TOEIC media is unavailable');
      cache.set(key, signed);
      return signed;
    },
    clear() { cache.clear(); },
  };
}

export function createBrowserToeicMediaClient(): ToeicMediaClient {
  return createToeicMediaClient(async (testId, paths) => {
    const response = await fetch(`/api/toeic-tests/${testId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
      cache: 'no-store',
    });
    if (!response.ok) throw new ToeicReadError('MEDIA_SIGNING_FAILED', 'Unable to load TOEIC media');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray((body as { items?: unknown }).items)) {
      throw new ToeicReadError('MEDIA_SIGNING_FAILED', 'Invalid TOEIC media response');
    }
    const items = (body as { items: unknown[] }).items;
    if (!items.every(isSignedMediaResult)) throw new ToeicReadError('MEDIA_SIGNING_FAILED', 'Invalid TOEIC media item');
    return items;
  });
}
