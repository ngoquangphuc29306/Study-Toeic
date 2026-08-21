import type { ToeicTestPart } from '../types';
import type { ToeicTestPartPayload } from '../readContracts';

export type ToeicPartContentLoader = (testId: string, part: ToeicTestPart) => Promise<ToeicTestPartPayload>;

/** In-memory cache only. It deduplicates concurrent part reads without Next shared caching. */
export class ToeicPartContentCache {
  private readonly cache = new Map<string, ToeicTestPartPayload>();
  private readonly pending = new Map<string, Promise<ToeicTestPartPayload>>();

  constructor(private readonly load: ToeicPartContentLoader) {}

  get(testId: string, part: ToeicTestPart): Promise<ToeicTestPartPayload> {
    const key = `${testId}:${part}`;
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const request = this.load(testId, part).then((payload) => {
      this.cache.set(key, payload);
      return payload;
    }).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }

  getCached(testId: string, part: ToeicTestPart): ToeicTestPartPayload | undefined {
    return this.cache.get(`${testId}:${part}`);
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }
}
