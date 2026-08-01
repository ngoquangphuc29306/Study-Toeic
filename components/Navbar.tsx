'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpen, Sparkles, Database, Plus, Flame, CheckCircle2, Home, Layers, HelpCircle, User } from 'lucide-react';
import { StudyStats } from '../lib/types';
import { SignOutButton } from './auth/sign-out-button';
import { getCurrentProfile } from '@/services/profileService';
import type { UserProfile } from '@/services/profileService';

interface NavbarProps {
  activeTab: 'dashboard' | 'flashcard' | 'quiz' | 'vocab-manager';
  setActiveTab: (tab: 'dashboard' | 'flashcard' | 'quiz' | 'vocab-manager') => void;
  stats: StudyStats;
  currentStreak: number; // Phase 9.8: Authoritative streak from dashboardMetrics
  onOpenSqlModal: () => void;
  onOpenAddModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  currentStreak,
  onOpenSqlModal,
  onOpenAddModal,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Load profile on mount and when pathname changes
  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      try {
        const profileData = await getCurrentProfile();
        if (isActive) {
          setProfile(profileData);
          setIsLoadingProfile(false);
        }
      } catch (err) {
        console.error('Load profile error:', err);
        if (isActive) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [pathname]); // Reload when pathname changes

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 border-b border-[#FCE7F3] shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveTab('dashboard');
            }
          }}
          aria-label="Về trang tổng quan"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] p-0.5 shadow-md shadow-pink-100 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#F472B6]" />
            </div>
          </div>
          <div className="hidden min-[375px]:block sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg sm:text-xl bg-gradient-to-r from-[#F472B6] to-[#FF85A1] bg-clip-text text-transparent">
                VocabTOEIC
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#FFF1F2] text-[#F472B6]">
                Master
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium hidden sm:block">Học Từ Vựng TOEIC Thông Minh</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#FFF1F2] p-1.5 rounded-2xl border border-[#FCE7F3]">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white text-[#F472B6] shadow-2xs'
                : 'text-gray-500 hover:text-[#F472B6] hover:bg-white/60'
            }`}
          >
            <Home className="w-4 h-4" />
            Tổng Quan
          </button>

          <button
            onClick={() => setActiveTab('flashcard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'flashcard'
                ? 'bg-white text-[#F472B6] shadow-2xs'
                : 'text-gray-500 hover:text-[#F472B6] hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Luyện Flashcards
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-white text-[#F472B6] shadow-2xs'
                : 'text-gray-500 hover:text-[#F472B6] hover:bg-white/60'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Bài Tập Quiz
          </button>

          <button
            onClick={() => setActiveTab('vocab-manager')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'vocab-manager'
                ? 'bg-white text-[#F472B6] shadow-2xs'
                : 'text-gray-500 hover:text-[#F472B6] hover:bg-white/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            Quản Lý Từ Vựng
          </button>
        </nav>

        {/* Action Badges & Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Daily Streak Badge */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-[#FFF1F2] border border-[#FCE7F3] rounded-2xl text-[11px] sm:text-xs font-bold text-[#F472B6]">
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F472B6] fill-[#F472B6] animate-pulse shrink-0" />
            <span className="whitespace-nowrap">{currentStreak}</span>
          </div>

          {/* Account Button - Mobile (avatar only) */}
          <button
            onClick={() => router.push('/app/account')}
            className="flex sm:hidden items-center justify-center p-1 text-gray-700 hover:text-[#F472B6] hover:bg-[#FFF1F2] rounded-full transition-all"
            aria-label="Cài đặt tài khoản"
            title="Cài đặt tài khoản"
          >
            {isLoadingProfile ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border-2 border-[#FCE7F3]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center text-white text-sm font-bold border-2 border-[#FCE7F3]">
                {profile?.displayName?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </button>

          {/* Account & Sign Out Buttons - Desktop */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Profile Avatar/Icon Button */}
            <button
              onClick={() => router.push('/app/account')}
              className="flex items-center gap-2 p-1.5 pr-3 text-gray-700 hover:text-[#F472B6] hover:bg-[#FFF1F2] rounded-full transition-all group"
              aria-label="Cài đặt tài khoản"
              title="Cài đặt tài khoản"
            >
              {isLoadingProfile ? (
                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
              ) : profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover border-2 border-[#FCE7F3] group-hover:border-[#F472B6] transition-colors"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center text-white text-sm font-bold border-2 border-[#FCE7F3] group-hover:border-[#F472B6] transition-colors">
                  {profile?.displayName?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <span className="text-sm font-medium hidden lg:block max-w-[120px] truncate">
                {profile?.displayName || profile?.email?.split('@')[0] || 'Tài khoản'}
              </span>
            </button>

            {/* Sign Out Button */}
            <SignOutButton variant="compact" />
          </div>
        </div>
      </div>

      {/* Mobile Navigation Row - Single instance */}
      <nav
        className="flex md:hidden items-center justify-around border-t border-[#FCE7F3] py-2 bg-white px-2 text-xs"
        aria-label="Mobile navigation"
      >
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[60px] ${
            activeTab === 'dashboard' ? 'text-[#F472B6] font-bold' : 'text-gray-500'
          }`}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        >
          <Home className="w-5 h-5 sm:w-4 sm:h-4" />
          <span className="text-[10px] sm:text-xs">Tổng quan</span>
        </button>
        <button
          onClick={() => setActiveTab('flashcard')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[60px] ${
            activeTab === 'flashcard' ? 'text-[#F472B6] font-bold' : 'text-gray-500'
          }`}
          aria-current={activeTab === 'flashcard' ? 'page' : undefined}
        >
          <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" />
          <span className="text-[10px] sm:text-xs">Flashcard</span>
        </button>
        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[60px] ${
            activeTab === 'quiz' ? 'text-[#F472B6] font-bold' : 'text-gray-500'
          }`}
          aria-current={activeTab === 'quiz' ? 'page' : undefined}
        >
          <HelpCircle className="w-5 h-5 sm:w-4 sm:h-4" />
          <span className="text-[10px] sm:text-xs">Quiz</span>
        </button>
        <button
          onClick={() => setActiveTab('vocab-manager')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[60px] ${
            activeTab === 'vocab-manager' ? 'text-[#F472B6] font-bold' : 'text-gray-500'
          }`}
          aria-current={activeTab === 'vocab-manager' ? 'page' : undefined}
        >
          <Layers className="w-5 h-5 sm:w-4 sm:h-4" />
          <span className="text-[10px] sm:text-xs">Quản lý</span>
        </button>
      </nav>
    </header>
  );
};
