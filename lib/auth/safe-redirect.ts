/**
 * Safe Redirect Helper
 *
 * Validates and sanitizes redirect paths to prevent open redirect vulnerabilities.
 * Only allows internal relative paths starting with a single slash.
 *
 * Security Rules:
 * - Accept: /dashboard, /profile, /settings
 * - Reject: https://evil.com, //evil.com, javascript:alert(1)
 * - Reject: malformed URLs
 * - Default: /
 */

/**
 * Validate that a redirect path is safe (internal only)
 *
 * @param path - The path to validate
 * @param fallback - Default path if validation fails (default: '/')
 * @returns A safe internal path
 */
export function getSafeRedirectPath(
  path: string | null | undefined,
  fallback: string = '/'
): string {
  // No path provided
  if (!path) {
    return fallback;
  }

  // Must start with exactly one slash
  if (!path.startsWith('/')) {
    return fallback;
  }

  // Reject protocol-relative URLs (//evil.com)
  if (path.startsWith('//')) {
    return fallback;
  }

  // Reject if it looks like an absolute URL
  try {
    // If path can be parsed as a URL with protocol, reject it
    const url = new URL(path, 'http://dummy.local');
    // If the pathname changed significantly, it had a protocol
    if (url.origin !== 'http://dummy.local') {
      return fallback;
    }
  } catch {
    // URL parsing failed - might be a path with special chars
    // Continue to basic validation
  }

  // Basic sanity check - reject obvious malformed inputs
  if (path.includes('://') || path.includes('\\')) {
    return fallback;
  }

  // Looks safe - return the path
  return path;
}

/**
 * Build a login redirect URL with a safe next parameter
 *
 * @param requestedPath - The path the user was trying to access
 * @returns Login URL with encoded next parameter
 */
export function buildLoginUrl(requestedPath: string): string {
  const safePath = getSafeRedirectPath(requestedPath);

  // Don't create circular redirect
  if (safePath === '/login') {
    return '/login';
  }

  return `/login?next=${encodeURIComponent(safePath)}`;
}
