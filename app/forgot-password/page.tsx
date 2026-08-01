'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { requestPasswordReset } from '@/services/accountService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedEmail = email.trim();

      // Basic client validation
      if (!trimmedEmail) {
        setError('Email là bắt buộc');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError('Email không hợp lệ');
        return;
      }

      // Request password reset (anti-enumeration: always succeeds unless network error)
      await requestPasswordReset(trimmedEmail);

      // Show success state
      setIsSuccess(true);
    } catch (err) {
      // Network/service errors surface here
      console.error('Forgot password error:', err);
      setError('Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-[#4A4A4A] mb-1">Quên mật khẩu</h1>
          <p className="text-sm text-[#9CA3AF]">Nhập email để đặt lại mật khẩu</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-[#FCE7F3] p-8 shadow-lg shadow-pink-100/20">
          {!isSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-11 pr-4 py-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="your@email.com"
                    autoComplete="email"
                    autoFocus
                  />
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
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Gửi email đặt lại</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Success State */
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-2">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-[#4A4A4A]">Kiểm tra email của bạn</h2>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu.
                Vui lòng kiểm tra hộp thư đến và làm theo hướng dẫn.
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Không nhận được email? Kiểm tra thư mục spam hoặc thử lại sau vài phút.
              </p>
            </div>
          )}

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

        {/* Footer Note */}
        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          Liên kết đặt lại mật khẩu sẽ hết hạn sau một khoảng thời gian nhất định
        </p>
      </div>
    </div>
  );
}
