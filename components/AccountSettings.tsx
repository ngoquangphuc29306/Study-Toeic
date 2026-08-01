'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Lock, Eye, EyeOff, CheckCircle2, Mail } from 'lucide-react';
import { SignOutButton } from './auth/sign-out-button';
import { getCurrentAccount, updateAccountPassword } from '@/services/accountService';
import { validatePasswordMatch } from '@/lib/validation/password';
import { PasswordUpdateError } from '@/services/accountErrors';
import type { AccountSummary } from '@/services/accountService';

interface AccountSettingsProps {
  onClose: () => void;
}

export function AccountSettings({ onClose }: AccountSettingsProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // Password change form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cho phép render Portal sau khi component đã mount trên browser
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);

    return () => {
      setIsMounted(false);
    };
  }, []);

  // Load account info on mount
  useEffect(() => {
    let isActive = true;

    const loadAccount = async () => {
      try {
        const accountData = await getCurrentAccount();
        if (isActive) {
          setAccount(accountData);
          setIsLoadingAccount(false);
        }
      } catch (err) {
        console.error('Load account error:', err);
        if (isActive) {
          setIsLoadingAccount(false);
        }
      }
    };

    loadAccount();

    return () => {
      isActive = false;
    };
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setError(null);
    setSuccessMessage(null);

    // Client validation
    const validation = validatePasswordMatch(newPassword, confirmPassword);
    if (!validation.valid) {
      setError(validation.message || 'Mật khẩu không hợp lệ');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateAccountPassword(newPassword);

      // Clear form
      setNewPassword('');
      setConfirmPassword('');

      // Show success
      setSuccessMessage('Đổi mật khẩu thành công');
    } catch (err) {
      console.error('Password change error:', err);

      if (err instanceof PasswordUpdateError) {
        setError(err.userMessage);
      } else {
        setError('Không thể cập nhật mật khẩu. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-[#FCE7F3] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-3xl border-b border-[#FCE7F3] bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] p-0.5 shadow-md shadow-pink-100">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <User className="w-5 h-5 text-[#F472B6]" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[#4A4A4A]">Tài khoản</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Đóng"
            >
              <span className="text-2xl leading-none">&times;</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Account Information Section */}
          <section>
            <h3 className="text-sm font-semibold text-[#4A4A4A] mb-3">Thông tin tài khoản</h3>
            <div className="bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl p-4">
              {isLoadingAccount ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-32" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF] font-medium">Email tài khoản</p>
                    <p className="text-sm font-medium text-[#4A4A4A]">
                      {account?.email || 'Không có email'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Change Password Section */}
          <section>
            <h3 className="text-sm font-semibold text-[#4A4A4A] mb-3">Đổi mật khẩu</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-11 py-2.5 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-sm text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Tối thiểu 8 ký tự"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F472B6] transition-colors disabled:opacity-50"
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPasswordSettings" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    id="confirmPasswordSettings"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-11 py-2.5 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-sm text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm"
                  role="alert"
                  aria-live="polite"
                >
                  {error}
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div
                  className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-sm flex items-center gap-2"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 size={16} />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-medium py-2.5 px-4 rounded-xl hover:shadow-md hover:shadow-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Đổi mật khẩu</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Sign Out Section */}
          <section>
            <h3 className="text-sm font-semibold text-[#4A4A4A] mb-3">Phiên đăng nhập</h3>
            <SignOutButton className="w-full justify-center" />
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
