/**
 * Supabase Session Refresh and Route Protection Helper
 *
 * Internal helper for refreshing Supabase sessions via cookies and protecting routes.
 * Called by the root middleware to ensure sessions remain valid and enforce auth.
 *
 * Handles:
 * - Session validation
 * - Token refresh
 * - Cookie synchronization between request and response
 * - Route protection (Phase 2B.5)
 * - Authenticated-user redirects from auth pages
 *
 * @param request - The incoming Next.js request
 * @returns Updated response with refreshed session cookies and redirects
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseEnv } from './env';
import { buildLoginUrl } from '../auth/safe-redirect';

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
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes (no auth required)
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/');

  // Protected routes (/app and /app/*) require authentication
  const isProtectedRoute = pathname === '/app' || pathname.startsWith('/app/');

  if (isProtectedRoute && !user) {
    // User is not authenticated - redirect to login with next parameter
    const loginUrl = buildLoginUrl(pathname);
    const redirectResponse = NextResponse.redirect(new URL(loginUrl, request.url));

    // CRITICAL: Copy all cookies from session refresh to redirect response
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return redirectResponse;
  }

  // Authenticated users should not access auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectResponse = NextResponse.redirect(new URL('/app', request.url));

    // CRITICAL: Copy all cookies from session refresh to redirect response
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return redirectResponse;
  }

  return response;
}
