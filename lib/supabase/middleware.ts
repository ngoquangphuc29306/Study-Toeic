/**
 * Supabase Session Refresh Helper
 *
 * Internal helper for refreshing Supabase sessions via cookies.
 * Called by the root middleware/proxy to ensure sessions remain valid.
 *
 * Handles:
 * - Session validation
 * - Token refresh
 * - Cookie synchronization between request and response
 *
 * Does NOT handle route protection - that's deferred to Phase 2.
 *
 * @param request - The incoming Next.js request
 * @returns Updated response with refreshed session cookies
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseEnv } from './env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Validate/refresh session - triggers automatic token refresh if needed
  // This reads the current session and refreshes the token if necessary
  await supabase.auth.getClaims();

  return response;
}
