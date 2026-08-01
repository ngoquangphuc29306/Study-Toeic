/**
 * Site URL Helper
 *
 * Returns the application's base URL for use in redirects and email links.
 * Prioritizes NEXT_PUBLIC_SITE_URL environment variable, falls back to window.location.origin
 * in browser context, or localhost for SSR.
 *
 * Usage:
 * - Password reset redirects
 * - Email confirmation redirects
 * - Absolute URLs in email templates
 */

export function getSiteUrl(): string {
  // Use explicit site URL from environment
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  // Browser: use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server fallback (should set NEXT_PUBLIC_SITE_URL in production)
  return 'http://localhost:3000';
}
