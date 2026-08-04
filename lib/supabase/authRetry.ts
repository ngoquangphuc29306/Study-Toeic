interface SessionLike {
  user?: { id?: string } | null;
}

export interface AuthSessionSource {
  getSession: () => Promise<{
    data: { session: SessionLike | null };
    error: unknown;
  }>;
  refreshSession: () => Promise<{
    data: { session: SessionLike | null };
    error: unknown;
  }>;
}

export class UnauthorizedRequestError extends Error {
  readonly status = 401;
  readonly code = 'AUTH_UNAUTHORIZED';

  constructor(message = 'The authenticated request was rejected.') {
    super(message);
    this.name = 'UnauthorizedRequestError';
  }
}

export class AuthSessionExpiredError extends Error {
  readonly status = 401;
  readonly code = 'AUTH_SESSION_EXPIRED';

  constructor(message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.') {
    super(message);
    this.name = 'AuthSessionExpiredError';
  }
}

export class AuthRetryExhaustedError extends Error {
  readonly status = 401;
  readonly code = 'AUTH_RETRY_EXHAUSTED';

  constructor(message = 'Không thể xác thực phiên đăng nhập. Vui lòng thử lại.') {
    super(message);
    this.name = 'AuthRetryExhaustedError';
  }
}

let refreshInFlight: Promise<SessionLike | null> | null = null;

export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const message = typeof candidate.message === 'string' ? candidate.message : '';

  return (
    candidate.status === 401 ||
    candidate.code === 'PGRST301' ||
    candidate.code === 'AUTH_UNAUTHORIZED' ||
    /(?:\b401\b|jwt expired|invalid jwt|not authenticated|unauthorized)/i.test(message)
  );
}

export function isAuthSessionExpiredError(error: unknown): error is AuthSessionExpiredError {
  return error instanceof AuthSessionExpiredError || (
    Boolean(error && typeof error === 'object') &&
    (error as { code?: unknown }).code === 'AUTH_SESSION_EXPIRED'
  );
}

export function isAuthRetryExhaustedError(error: unknown): error is AuthRetryExhaustedError {
  return error instanceof AuthRetryExhaustedError || (
    Boolean(error && typeof error === 'object') &&
    (error as { code?: unknown }).code === 'AUTH_RETRY_EXHAUSTED'
  );
}

/** Convert a raw Supabase 401 into a safe, token-free typed error. */
export function throwIfUnauthorized(error: unknown): void {
  if (isUnauthorizedError(error)) {
    throw new UnauthorizedRequestError();
  }
}

async function refreshSessionOnce(auth: AuthSessionSource): Promise<SessionLike | null> {
  if (!refreshInFlight) {
    refreshInFlight = auth.refreshSession()
      .then(({ data, error }) => (error ? null : data.session))
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

/**
 * Retry one rejected authenticated read after one coordinated session refresh.
 * A second 401 is returned to the caller and is never retried again here.
 */
export async function withSessionRetry<T>(
  operation: () => Promise<T>,
  auth?: AuthSessionSource
): Promise<T> {
  const authSource = auth || (await import('./client')).createClient().auth;

  try {
    return await operation();
  } catch (error) {
    if (!isUnauthorizedError(error)) throw error;

    const { data: sessionData } = await authSource.getSession().catch(() => ({
      data: { session: null },
    }));

    if (!sessionData.session) {
      throw new AuthSessionExpiredError();
    }

    const refreshedSession = await refreshSessionOnce(authSource);
    if (!refreshedSession) {
      throw new AuthSessionExpiredError();
    }

    try {
      return await operation();
    } catch (retryError) {
      if (isUnauthorizedError(retryError)) {
        throw new AuthRetryExhaustedError();
      }
      throw retryError;
    }
  }
}
