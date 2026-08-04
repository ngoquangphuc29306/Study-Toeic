import { describe, expect, it, vi } from 'vitest';
import {
  AuthRetryExhaustedError,
  AuthSessionExpiredError,
  isUnauthorizedError,
  withSessionRetry,
  type AuthSessionSource,
} from './authRetry';

function createAuthSource(session: { user: { id: string } } | null, refreshedSession = session): AuthSessionSource {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: refreshedSession }, error: null }),
  };
}

describe('withSessionRetry', () => {
  it('refreshes once and retries an unauthorized request once', async () => {
    const auth = createAuthSource({ user: { id: 'user-1' } });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ status: 401, message: 'Unauthorized' })
      .mockResolvedValue('ok');

    await expect(withSessionRetry(operation, auth)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('stops after the retry is unauthorized again', async () => {
    const auth = createAuthSource({ user: { id: 'user-1' } });
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue({ status: 401 });

    await expect(withSessionRetry(operation, auth)).rejects.toBeInstanceOf(AuthRetryExhaustedError);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when there is no session', async () => {
    const auth = createAuthSource(null);
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue({ status: 401 });

    await expect(withSessionRetry(operation, auth)).rejects.toBeInstanceOf(AuthSessionExpiredError);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('coordinates concurrent unauthorized requests through one refresh', async () => {
    const auth = createAuthSource({ user: { id: 'user-1' } });
    auth.refreshSession = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { data: { session: { user: { id: 'user-1' } } }, error: null };
    });
    const first = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValue('first');
    const second = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValue('second');

    await expect(Promise.all([
      withSessionRetry(first, auth),
      withSessionRetry(second, auth),
    ])).resolves.toEqual(['first', 'second']);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('recognizes Supabase JWT rejection without exposing token data', () => {
    expect(isUnauthorizedError({ code: 'PGRST301', message: 'JWT expired' })).toBe(true);
    expect(isUnauthorizedError({ status: 500, message: 'server error' })).toBe(false);
  });
});
