'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { updatePasswordFromRecovery } from '@/services/accountService';
import { validatePasswordMatch } from '@/lib/validation/password';
import { InvalidRecoveryError, PasswordUpdateError } from '@/services/accountErrors';

type PageState = 'loading' | 'ready' | 'expired' | 'success';

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for recovery session on mount
  // Password recovery detection strategy:
  // 1. Root-level AuthEventBridge catches PASSWORD_RECOVERY event
  // 2. Sets sessionStorage marker with timestamp
  // 3. This page validates marker age + session existence
  // 4. Normal authenticated sessions WITHOUT valid marker are rejected
  // 5. Scoped listener provides fallback for direct PASSWORD_RECOVERY
  useEffect(() => {
    let isMounted = true;
    const RECOVERY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

    const checkRecoverySession = async () => {
      try {
        const supabase = createClient();

        // Check for password recovery marker set by AuthEventBridge
        const markerString = sessionStorage.getItem('password_recovery_flow');
        let isValidMarker = false;

        if (markerString) {
          try {
            const marker = JSON.parse(markerString);
            const age = Date.now() - marker.createdAt;

            // Marker must be active and within recovery window
            if (marker.active && age < RECOVERY_WINDOW_MS) {
              isValidMarker = true;
            } else {
              // Stale marker - remove it
              sessionStorage.removeItem('password_recovery_flow');
            }
          } catch {
            // Invalid marker format - remove it
            sessionStorage.removeItem('password_recovery_flow');
          }
        }

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session) {
          // No session at all - link is expired or invalid
          setPageState('expired');
        } else if (isValidMarker) {
          // Valid recovery session: has session AND valid marker
          setPageState('ready');
        } else {
          // Has session but NO valid marker
          // This is a normal authenticated user navigating directly
          // Reject and show expired state
          setPageState('expired');
        }
      } catch (err) {
        console.error('Recovery session check error:', err);
        if (isMounted) {
          setPageState('expired');
        }
      }
    };

    // Scoped listener for direct PASSWORD_RECOVERY (fallback)
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'PASSWORD_RECOVERY' && isMounted) {
        // Direct PASSWORD_RECOVERY received on this page
        // Set marker if not already set by AuthEventBridge
        const markerString = sessionStorage.getItem('password_recovery_flow');
        if (!markerString) {
          const marker = {
            active: true,
            createdAt: Date.now(),
          };
          sessionStorage.setItem('password_recovery_flow', JSON.stringify(marker));
        }
        setPageState('ready');
      }
    });

    checkRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setError(null);

    // Client validation
    const validation = validatePasswordMatch(newPassword, confirmPassword);
    if (!validation.valid) {
      setError(validation.message || 'Mật khẩu không hợp lệ');
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePasswordFromRecovery(newPassword);

      // Clear sensitive data
      setNewPassword('');
      setConfirmPassword('');

      // Clear recovery marker - flow is complete
      sessionStorage.removeItem('password_recovery_flow');

      // Sign out the recovery session so the user must log in again
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutError) {
        console.error(
          'Recovery session sign out error:',
          signOutError.message
        );

        setError(
          'Mật khẩu đã được cập nhật nhưng không thể kết thúc phiên đăng nhập. Vui lòng đăng xuất thủ công.'
        );
        return;
      }

      // Show success only after recovery session is cleared
      setPageState('success');
    } catch (err) {
      console.error('Reset password error:', err);

      if (err instanceof InvalidRecoveryError) {
        // Recovery session invalid or expired
        sessionStorage.removeItem('password_recovery_flow');
        setPageState('expired');
      } else if (err instanceof PasswordUpdateError) {
        setError(err.userMessage);
      } else {
        setError('Không thể cập nhật mật khẩu. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [newPassword, confirmPassword, isSubmitting]);

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#F472B6] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-[#9CA3AF]">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  // Expired/Invalid link state
  if (pageState === 'expired') {
    return (
      <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 mb-4 shadow-lg shadow-pink-100">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-2xl">
                🌸
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#4A4A4A] mb-1">Đặt lại mật khẩu</h1>
          </div>

          <div className="bg-white rounded-3xl border border-[#FCE7F3] p-8 shadow-lg shadow-pink-100/20">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-2">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-[#4A4A4A]">Liên kết không hợp lệ</h2>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
                Vui lòng yêu cầu liên kết mới.
              </p>
              <div className="pt-4">
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-medium rounded-full hover:shadow-lg hover:shadow-pink-200 transition-all"
                >
                  Yêu cầu liên kết mới
                </Link>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-[#F472B6] hover:text-[#EC4899] font-medium hover:underline transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Quay lại đăng nhập</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 mb-4 shadow-lg shadow-pink-100">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-2xl">
                🌸
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#4A4A4A] mb-1">Đặt lại mật khẩu</h1>
          </div>

          <div className="bg-white rounded-3xl border border-[#FCE7F3] p-8 shadow-lg shadow-pink-100/20">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-[#4A4A4A]">Đổi mật khẩu thành công</h2>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                Mật khẩu của bạn đã được cập nhật thành công.
                Bạn có thể đăng nhập với mật khẩu mới.
              </p>
              <div className="pt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-medium rounded-full hover:shadow-lg hover:shadow-pink-200 transition-all"
                >
                  Đăng nhập
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset form state (pageState === 'ready')
  return (
    <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 mb-4 shadow-lg shadow-pink-100">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-2xl">
              🌸
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] mb-1">Đặt lại mật khẩu</h1>
          <p className="text-sm text-[#9CA3AF]">Nhập mật khẩu mới của bạn</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-[#FCE7F3] p-8 shadow-lg shadow-pink-100/20">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password Field */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-11 pr-12 py-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F472B6] transition-colors disabled:opacity-50"
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-[#9CA3AF]">Tối thiểu 8 ký tự</p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-11 pr-12 py-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F472B6] transition-colors disabled:opacity-50"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-medium py-3 px-6 rounded-full hover:shadow-lg hover:shadow-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang cập nhật...</span>
                </>
              ) : (
                <>
                  <Lock size={20} />
                  <span>Đặt lại mật khẩu</span>
                </>
              )}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-[#F472B6] hover:text-[#EC4899] font-medium hover:underline transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Quay lại đăng nhập</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
