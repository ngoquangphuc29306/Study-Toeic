import { Suspense } from 'react';
import LoginForm from './login-form';

/**
 * Login Page
 *
 * Wraps the login form in Suspense boundary to handle useSearchParams() safely.
 * Required for Next.js static generation.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * Loading skeleton for login page
 */
function LoginPageSkeleton() {
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

        {/* Loading Card */}
        <div className="bg-white rounded-3xl border border-[#FCE7F3] p-8 shadow-lg shadow-pink-100/20">
          <div className="space-y-5">
            <div className="h-20 bg-[#FFF9FA] rounded-xl animate-pulse" />
            <div className="h-20 bg-[#FFF9FA] rounded-xl animate-pulse" />
            <div className="h-12 bg-gradient-to-r from-[#F472B6] to-[#FF85A1] rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
