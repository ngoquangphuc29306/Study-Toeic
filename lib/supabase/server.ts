/**
 * Supabase Server Client
 *
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers.
 *
 * Uses Next.js cookies() for session management.
 * Cookie writes from Server Components are tolerated but session mutation
 * is ultimately handled by middleware.
 *
 * Security: Do not use getSession() as authorization proof - always verify
 * with database queries protected by RLS.
 *
 * @example
 * ```tsx
 * import { createClient } from '@/lib/supabase/server';
 *
 * export async function ServerComponent() {
 *   const supabase = await createClient();
 *   const { data } = await supabase.from('collections').select();
 *   // ...
 * }
 * ```
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes may fail in Server Components where setting cookies
            // is not available. This is expected - session mutation is handled
            // by middleware/proxy instead.
          }
        },
      },
    }
  );
}
