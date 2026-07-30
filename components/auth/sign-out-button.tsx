'use client';

import React, { useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';

interface SignOutButtonProps {
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Sign Out Button Component
 *
 * Reusable button that calls the server-side signOut action.
 * Provides loading state and prevents duplicate submissions.
 *
 * Usage:
 * - Default: Full button with icon and label
 * - Compact: Icon-only for constrained spaces
 */
export function SignOutButton({ variant = 'default', className = '' }: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
      // signOut action will redirect to /login
    });
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className={`p-2 text-gray-500 hover:text-[#F472B6] hover:bg-[#FFF1F2] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        aria-label="Đăng xuất"
        title="Đăng xuất"
      >
        {isPending ? (
          <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <LogOut className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-[#F472B6] hover:bg-[#FFF1F2] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      aria-label="Đăng xuất"
    >
      {isPending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span>Đang đăng xuất...</span>
        </>
      ) : (
        <>
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </>
      )}
    </button>
  );
}
