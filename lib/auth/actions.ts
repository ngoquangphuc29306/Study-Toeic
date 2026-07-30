/**
 * Authentication Server Actions
 *
 * Server-side authentication actions for sign up, sign in, and sign out.
 * Uses Supabase SSR server client for secure cookie-based session management.
 *
 * Security:
 * - All actions run on the server
 * - Use server client with cookie synchronization
 * - Never expose raw Supabase errors to client
 * - Sanitize error messages for users
 */

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateSignUp, validateSignIn } from '@/lib/validation/auth';

export interface AuthResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Sign up with email and password
 *
 * Handles both email confirmation flows:
 * - Confirmation enabled: Returns success message, no session
 * - Confirmation disabled: Creates session, redirects to /
 */
export async function signUp(
  email: string,
  password: string,
  confirmPassword: string
): Promise<AuthResult> {
  // Validate input
  const errors = validateSignUp({ email, password, confirmPassword });
  if (errors.length > 0) {
    return {
      success: false,
      error: errors[0].message,
    };
  }

  const supabase = await createClient();

  // Attempt sign up
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    // Sanitize error for user
    if (error.message.includes('already registered')) {
      return {
        success: false,
        error: 'Email này đã được đăng ký',
      };
    }

    return {
      success: false,
      error: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
    };
  }

  // Check if email confirmation is required
  if (data.user && !data.session) {
    // Email confirmation enabled
    return {
      success: true,
      message: 'Tài khoản đã được tạo. Hãy kiểm tra email để xác nhận tài khoản.',
    };
  }

  // Email confirmation disabled - session created immediately
  if (data.session) {
    redirect('/app');
  }

  return {
    success: true,
    message: 'Tài khoản đã được tạo thành công',
  };
}

/**
 * Sign in with email and password
 *
 * @param email - User email
 * @param password - User password
 * @param redirectTo - Safe internal path to redirect after login (default: '/app')
 */
export async function signIn(
  email: string,
  password: string,
  redirectTo: string = '/app'
): Promise<AuthResult> {
  // Validate input
  const errors = validateSignIn({ email, password });
  if (errors.length > 0) {
    return {
      success: false,
      error: errors[0].message,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    // Generic error for security (don't reveal if email exists)
    return {
      success: false,
      error: 'Email hoặc mật khẩu không chính xác',
    };
  }

  if (!data.session) {
    return {
      success: false,
      error: 'Đăng nhập thất bại',
    };
  }

  // Successful login - redirect to safe path
  redirect(redirectTo);
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
