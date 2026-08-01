'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/lib/auth/actions';
import { getSafeRedirectPath } from '@/lib/auth/safe-redirect';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Parse and validate next parameter - memoized to avoid recalculation
  const redirectTo = useMemo(() => {
    const nextParam = searchParams.get('next');
    return getSafeRedirectPath(nextParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn(email, password, redirectTo);
      if (!result.success && result.error) {
        setError(result.error);
      }
      // If success, signIn action will redirect to redirectTo
    });
  };

  return (
    <div className="min-h-screen bg-[#FFF9FA] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 mb-4 shadow-lg shadow-pink-100">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-2xl">
              🌸
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#4A4A4A] mb-1">Đăng nhập</h1>
          <p className="text-sm text-[#9CA3AF]">Chào mừng trở lại với VocabTOEIC</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-3xl border border-[#FCE7F3] p-8 shadow-lg shadow-pink-100/20">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
                className="w-full px-4 py-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isPending}
                  className="w-full px-4 py-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isPending}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F472B6] transition-colors disabled:opacity-50"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
              disabled={isPending}
              className="w-full bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-medium py-3 px-6 rounded-full hover:shadow-lg hover:shadow-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-[#9CA3AF] hover:text-[#F472B6] hover:underline transition-colors"
            >
              Quên mật khẩu?
            </Link>
          </div>

          {/* Sign Up Link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-[#6B7280]">
              Chưa có tài khoản?{' '}
              <Link
                href="/signup"
                className="text-[#F472B6] hover:text-[#EC4899] font-medium hover:underline transition-colors"
              >
                Tạo tài khoản
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          Bằng việc đăng nhập, bạn đồng ý với các điều khoản sử dụng của VocabTOEIC
        </p>
      </div>
    </div>
  );
}
