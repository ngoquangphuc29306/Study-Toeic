export interface RequestCoordinator<T> {
  getOrCreate(key: string, factory: () => Promise<T>): Promise<T>;
  has(key: string): boolean;
  clear(key: string): void;
  clearAll(): void;
}

/**
 * Shares only requests that are currently in flight. Rejected requests are
 * removed immediately so a later retry can create a fresh request.
 */
export function createRequestCoordinator<T>(): RequestCoordinator<T> {
  const inFlight = new Map<string, Promise<T>>();

  const getOrCreate = (key: string, factory: () => Promise<T>): Promise<T> => {
    const existing = inFlight.get(key);
    if (existing) return existing;

    const request = Promise.resolve().then(factory);
    inFlight.set(key, request);

    void request.then(
      () => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      },
      () => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      }
    );

    return request;
  };

  return {
    getOrCreate,
    has: (key) => inFlight.has(key),
    clear: (key) => inFlight.delete(key),
    clearAll: () => inFlight.clear(),
  };
}
