'use client';

import { useEffect } from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * AuthEventBridge
 *
 * Root-level auth event listener that detects PASSWORD_RECOVERY events
 * and manages sessionStorage recovery markers.
 *
 * Mount Scope: Root layout (app/layout.tsx)
 * - Runs on ALL routes, including /reset-password
 * - Catches PASSWORD_RECOVERY before reset page mounts
 * - No race condition with page-specific listeners
 *
 * Responsibilities:
 * - Listen for PASSWORD_RECOVERY event
 * - Set sessionStorage marker with timestamp
 * - Clear marker on SIGNED_OUT
 * - Clean up subscription on unmount
 *
 * Does NOT:
 * - Load application data
 * - Manage application state
 * - Duplicate /app route auth logic
 * - Store tokens, passwords, or session values
 */
export function AuthEventBridge() {
  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked password recovery link from email
        // Set marker with timestamp for /reset-password page
        const marker = {
          active: true,
          createdAt: Date.now(),
        };
        sessionStorage.setItem('password_recovery_flow', JSON.stringify(marker));
      }

      if (event === 'SIGNED_OUT') {
        // Clear recovery marker on sign out
        sessionStorage.removeItem('password_recovery_flow');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Renders nothing - pure event bridge
  return null;
}
