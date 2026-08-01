/**
 * Account Service
 *
 * Handles account management operations:
 * - Password reset requests
 * - Password updates (signed-in and recovery)
 * - Account information retrieval
 * - Sign out
 *
 * Security:
 * - Uses browser client for auth state
 * - Anti-enumeration: generic responses for password reset
 * - Safe error messages for users
 * - No password logging
 */

import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/auth/siteUrl';
import {
  PasswordResetError,
  PasswordUpdateError,
  InvalidRecoveryError,
} from './accountErrors';

export interface AccountSummary {
  id: string;
  email: string | null;
}

/**
 * Request password reset email
 *
 * Anti-enumeration: Always returns success, never reveals if email exists
 * Network/service errors are thrown as PasswordResetError
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  const siteUrl = getSiteUrl();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/reset-password`,
    });

    // Anti-enumeration: Supabase does not expose user-not-found errors
    // We only need to handle actual service/network failures
    if (error) {
      console.error('Password reset request error:', error.message);

      // Throw all errors - caller will show generic failure message
      // This preserves anti-enumeration while surfacing real failures
      throw new PasswordResetError(error.message);
    }

    // Success - email sent (or user doesn't exist, but we don't reveal that)
  } catch (err) {
    // If we threw PasswordResetError above, re-throw it
    if (err instanceof PasswordResetError) {
      throw err;
    }

    // Network exceptions (fetch failures) should be thrown
    console.error('Password reset exception:', err);
    throw new PasswordResetError('Network error during password reset request');
  }
}

/**
 * Update password for signed-in user
 *
 * Used for: signed-in password change
 * Note: Does NOT require current password - Supabase Auth allows
 * authenticated users to change password without re-authentication
 */
export async function updateAccountPassword(newPassword: string): Promise<void> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Password update error:', error.message);
      throw new PasswordUpdateError(error.message);
    }

    if (!data.user) {
      throw new PasswordUpdateError('No user returned after update');
    }
  } catch (err) {
    if (err instanceof PasswordUpdateError) {
      throw err;
    }
    console.error('Password update exception:', err);
    throw new PasswordUpdateError('Unexpected error during password update');
  }
}

/**
 * Update password in recovery context
 *
 * Used for: password reset after following email link
 *
 * IMPORTANT: This function does NOT validate recovery context.
 * Supabase auth.updateUser({ password }) works for ANY authenticated session:
 * - Normal signed-in users can change password without current password
 * - Recovery session users can change password
 *
 * Recovery validation must happen at the UI level by:
 * 1. Root-level AuthEventBridge detects PASSWORD_RECOVERY event
 * 2. Sets sessionStorage marker with timestamp when event fires
 * 3. Reset page validates marker age + session before showing form
 * 4. Normal sessions without valid marker are rejected
 *
 * This function only validates that:
 * - A session exists (user is authenticated)
 * - Password update succeeds
 */
export async function updatePasswordFromRecovery(newPassword: string): Promise<void> {
  const supabase = createClient();

  try {
    // Check if we have any session at all
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new InvalidRecoveryError('No session found');
    }

    // Update password
    // NOTE: This works for normal authenticated sessions too
    // Recovery context must be validated by caller
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Password update error:', error.message);

      // Check for common errors
      if (error.message.includes('session') || error.message.includes('token')) {
        throw new InvalidRecoveryError(error.message);
      }

      throw new PasswordUpdateError(error.message);
    }

    if (!data.user) {
      throw new PasswordUpdateError('No user returned after password update');
    }
  } catch (err) {
    if (err instanceof InvalidRecoveryError || err instanceof PasswordUpdateError) {
      throw err;
    }
    console.error('Password update exception:', err);
    throw new PasswordUpdateError('Unexpected error during password update');
  }
}

/**
 * Get current account information
 */
export async function getCurrentAccount(): Promise<AccountSummary | null> {
  const supabase = createClient();

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Get account error:', error.message);
      return null;
    }

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || null,
    };
  } catch (err) {
    console.error('Get account exception:', err);
    return null;
  }
}

/**
 * Sign out current user
 *
 * Note: Actual redirect is handled by signOut server action
 * This is a client-side helper that delegates to the server action
 */
export async function signOutCurrentUser(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
