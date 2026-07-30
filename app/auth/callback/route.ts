/**
 * Auth Callback Route Handler
 *
 * Handles the OAuth callback and email confirmation redirects from Supabase.
 * Exchanges the auth code for a session and sets cookies.
 *
 * This route is required for:
 * - Email confirmation links
 * - OAuth providers (if added later)
 *
 * Security:
 * - Validates the code parameter
 * - Only allows internal relative redirects
 * - Falls back to / on error
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const supabase = await createClient();

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Validate next parameter - only allow internal relative paths
      const isInternalPath = next.startsWith('/') && !next.startsWith('//');
      const redirectTo = isInternalPath ? next : '/';

      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
}
