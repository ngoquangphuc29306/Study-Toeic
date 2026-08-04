import { describe, expect, it, vi } from 'vitest';
import {
  attemptChunkRecovery,
  CHUNK_RECOVERY_STORAGE_KEY,
  CHUNK_RECOVERY_WINDOW_MS,
  isChunkLoadError,
  markChunkRecoverySuccessful,
} from './chunkLoadRecovery';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('chunk load recovery', () => {
  it('recognizes chunk errors but not ordinary errors', () => {
    expect(isChunkLoadError(new Error('Loading chunk 549 failed'))).toBe(true);
    expect(isChunkLoadError({ message: 'Failed to fetch dynamically imported module' })).toBe(true);
    expect(isChunkLoadError({ message: 'Failed to load resource: 401' })).toBe(false);
  });

  it('reloads once within a recovery window', () => {
    const storage = createStorage();
    const reload = vi.fn();

    expect(attemptChunkRecovery(storage, reload, 1_000)).toBe(true);
    expect(attemptChunkRecovery(storage, reload, 2_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows a later recovery window and clears after successful boot', () => {
    const storage = createStorage();
    const reload = vi.fn();

    attemptChunkRecovery(storage, reload, 1_000);
    expect(attemptChunkRecovery(storage, reload, 1_000 + CHUNK_RECOVERY_WINDOW_MS)).toBe(true);
    markChunkRecoverySuccessful(storage);
    expect(storage.getItem(CHUNK_RECOVERY_STORAGE_KEY)).toBeNull();
  });
});
