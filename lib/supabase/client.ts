/**
 * Supabase Browser Client
 *
 * Creates a Supabase client for use in Client Components, browser hooks,
 * and event handlers.
 *
 * Uses @supabase/ssr for automatic cookie-based session management.
 *
 * @example
 * ```tsx
 * 'use client';
 * import { createClient } from '@/lib/supabase/client';
 *
 * export function MyComponent() {
 *   const supabase = createClient();
 *   // Use supabase client...
 * }
 * ```
 */

import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

export function createClient() {
  return createBrowserClient(
    supabaseEnv.url,
    supabaseEnv.anonKey
  );
}
