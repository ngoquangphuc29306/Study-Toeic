export const CHUNK_RECOVERY_STORAGE_KEY = 'easytoeic:chunk-recovery';
export const CHUNK_RECOVERY_WINDOW_MS = 60_000;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface ChunkRecoveryMarker {
  attemptedAt: number;
}

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readMarker(storage: StorageLike): ChunkRecoveryMarker | null {
  try {
    const parsed = JSON.parse(storage.getItem(CHUNK_RECOVERY_STORAGE_KEY) || 'null') as Partial<ChunkRecoveryMarker> | null;
    return parsed && typeof parsed.attemptedAt === 'number' ? parsed as ChunkRecoveryMarker : null;
  } catch {
    return null;
  }
}

export function isChunkLoadError(value: unknown): boolean {
  if (typeof value === 'string') {
    return /(?:ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module)/i.test(value);
  }

  if (!value || typeof value !== 'object') return false;

  const candidate = value as {
    name?: unknown;
    message?: unknown;
    filename?: unknown;
    error?: { name?: unknown; message?: unknown } | null;
    target?: { src?: unknown } | null;
  };
  const text = [
    candidate.name,
    candidate.message,
    candidate.filename,
    candidate.error?.name,
    candidate.error?.message,
    candidate.target?.src,
  ].filter((part): part is string => typeof part === 'string').join(' ');

  return isChunkLoadError(text);
}

export function attemptChunkRecovery(
  storage: StorageLike,
  reload: () => void,
  now = Date.now()
): boolean {
  const previous = readMarker(storage);
  if (previous && now - previous.attemptedAt < CHUNK_RECOVERY_WINDOW_MS) {
    return false;
  }

  try {
    storage.setItem(CHUNK_RECOVERY_STORAGE_KEY, JSON.stringify({ attemptedAt: now }));
  } catch {
    // If sessionStorage is unavailable, avoid an uncontrolled reload loop.
    return false;
  }

  reload();
  return true;
}

export function markChunkRecoverySuccessful(storage: StorageLike): void {
  try {
    storage.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function installChunkLoadErrorRecovery(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const storage = getSessionStorage();
  if (!storage) return () => undefined;

  const recover = (value: unknown) => {
    if (isChunkLoadError(value)) {
      attemptChunkRecovery(storage, () => window.location.reload());
    }
  };
  const handleError = (event: ErrorEvent) => recover(event);
  const handleRejection = (event: PromiseRejectionEvent) => recover(event.reason);

  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleRejection);

  return () => {
    window.removeEventListener('error', handleError, true);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
