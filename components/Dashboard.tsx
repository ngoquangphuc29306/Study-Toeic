'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  Play,
  Search,
  Filter,
  Briefcase,
  FileText,
  Plane,
  CreditCard,
  TrendingUp,
  GitCompareArrows,
  PlusCircle,
  ArrowRight,
  Target,
  Settings,
  X,
  Layers,
  Calendar,
  Trophy,
  Brain,
  ArrowLeft,
  Volume2,
  RotateCcw,
  Flame,
  Check,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { FlashcardInitialFilter, Topic, StudyStats, Vocabulary } from '../lib/types';
import { SrsRating } from '../services/vocabService';
import {
  getDashboardMetrics,
  getWeekActivity,
  type DashboardMetrics
} from '../services/dashboardService';
import gsap from 'gsap';
import { motionTokens } from '../lib/animation/motionTokens';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';

interface DashboardProps {
  topics: Topic[];
  vocabularies: Vocabulary[];
  stats: StudyStats;
  dashboardMetrics: DashboardMetrics | null; // Phase 9.8: Passed from parent
  weekActivity: Array<{ date: string; count: number }>; // Phase 9.8: Passed from parent
  isLoadingMetrics: boolean; // Phase 9.8: Passed from parent
  onSelectTopicForFlashcard: (topicId: string, initialStatus?: FlashcardInitialFilter) => void;
  onSelectTopicForSynonyms: (topicId: string) => void;
  onOpenCollectionModal: () => void;
  onUpdateProgress?: (vocabId: string, status: 'learning' | 'mastered', rating?: SrsRating) => void;
}

// Map string icon names to Lucide icon components
const IconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-6 h-6 text-pink-500" />,
  Briefcase: <Briefcase className="w-6 h-6 text-rose-500" />,
  Plane: <Plane className="w-6 h-6 text-pink-500" />,
  CreditCard: <CreditCard className="w-6 h-6 text-rose-500" />,
  TrendingUp: <TrendingUp className="w-6 h-6 text-pink-500" />,
};

export const Dashboard: React.FC<DashboardProps> = ({
  topics,
  vocabularies,
  stats,
  dashboardMetrics,
  weekActivity,
  isLoadingMetrics,
  onSelectTopicForFlashcard,
  onSelectTopicForSynonyms,
  onOpenCollectionModal,
  onUpdateProgress,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Phase 9.8: Dashboard metrics now passed from parent (app/app/page.tsx)
  // Removed internal state and useEffect for getDashboardMetrics/getWeekActivity
  // Parent owns single source of truth and refreshes metrics with vocabulary changes

  // Phase 9.10A.3: Get user ID for user-scoped localStorage
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      if (typeof window === 'undefined') return;
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    loadUser();
  }, []);

  // Daily Goal Settings State (user-scoped localStorage)
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 20;
    // Will be updated by effect when userId loads
    return 20;
  });
  const [dailyReviewLimit, setDailyReviewLimit] = useState<number>(() => {
    if (typeof window === 'undefined') return 20;
    return 20;
  });
  const [unlimitedReview, setUnlimitedReview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return true;
  });

  // Load user-scoped settings when userId becomes available
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    const savedGoal = localStorage.getItem(`vocab_daily_goal:${userId}`);
    const savedLimit = localStorage.getItem(`vocab_daily_review_limit:${userId}`);
    const savedUnlimited = localStorage.getItem(`vocab_unlimited_review:${userId}`);

    const newGoal = savedGoal ? parseInt(savedGoal, 10) || 20 : 20;
    const newLimit = savedLimit ? parseInt(savedLimit, 10) || 20 : 20;
    const newUnlimited = savedUnlimited !== null ? savedUnlimited === 'true' : true;

    // Sync with localStorage - this is the intended use case for setState in effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDailyGoal(prev => prev !== newGoal ? newGoal : prev);
    setDailyReviewLimit(prev => prev !== newLimit ? newLimit : prev);
    setUnlimitedReview(prev => prev !== newUnlimited ? newUnlimited : prev);
  }, [userId]);

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoal, setTempGoal] = useState<number>(20);
  const [tempUnlimited, setTempUnlimited] = useState<boolean>(true);
  const [tempReviewLimit, setTempReviewLimit] = useState<number>(20);

  const handleOpenGoalModal = () => {
    setTempGoal(dailyGoal);
    setTempUnlimited(unlimitedReview);
    setTempReviewLimit(dailyReviewLimit);
    setIsGoalModalOpen(true);
  };

  const handleSaveGoalSettings = () => {
    const validGoal = Math.min(100, Math.max(1, tempGoal || 20));
    const validReviewLimit = Math.min(999, Math.max(1, tempReviewLimit || 20));
    setDailyGoal(validGoal);
    setDailyReviewLimit(validReviewLimit);
    setUnlimitedReview(tempUnlimited);
    if (typeof window !== 'undefined' && userId) {
      localStorage.setItem(`vocab_daily_goal:${userId}`, validGoal.toString());
      localStorage.setItem(`vocab_daily_review_limit:${userId}`, validReviewLimit.toString());
      localStorage.setItem(`vocab_unlimited_review:${userId}`, tempUnlimited.toString());
    }
    setIsGoalModalOpen(false);
  };

  const [activeDetailView, setActiveDetailView] = useState<'pending' | 'mastered' | 'difficult' | null>(null);
  const [detailSearchTerm, setDetailSearchTerm] = useState('');

  // Relearn confirmation modal state
  const [relearnConfirmModal, setRelearnConfirmModal] = useState<{
    isOpen: boolean;
    vocabId: string;
    vocabWord: string;
  }>({ isOpen: false, vocabId: '', vocabWord: '' });
  const [isRelearnSubmitting, setIsRelearnSubmitting] = useState<boolean>(false);
  const [relearnError, setRelearnError] = useState<string | null>(null);
  const [relearnSuccess, setRelearnSuccess] = useState<string | null>(null);

  // Stable timestamp for due-time calculations
  const [nowMs] = useState(() => Date.now());
  const dashboardRef = useRef<HTMLDivElement>(null);
  const hasAnimatedDashboardRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isLoadingMetrics || hasAnimatedDashboardRef.current || !dashboardRef.current) return;

    hasAnimatedDashboardRef.current = true;
    const ctx = gsap.context(() => {
      const entranceTargets = dashboardRef.current?.querySelectorAll<HTMLElement>('[data-dashboard-entrance]');
      const statTargets = dashboardRef.current?.querySelectorAll<HTMLElement>('[data-dashboard-stat]');
      const progressTarget = dashboardRef.current?.querySelector<HTMLElement>('[data-dashboard-progress]');

      if (!entranceTargets || !statTargets) return;

      if (prefersReducedMotion) {
        gsap.set([...entranceTargets, ...statTargets], { clearProps: 'all' });
        if (progressTarget) gsap.set(progressTarget, { clearProps: 'transform,transformOrigin' });
        return;
      }

      const timeline = gsap.timeline({
        defaults: {
          duration: motionTokens.duration.normal,
          ease: motionTokens.ease.standard,
        },
      });

      timeline
        .fromTo(
          entranceTargets,
          { autoAlpha: 0, y: motionTokens.distance.medium },
          { autoAlpha: 1, y: 0 }
        )
        .fromTo(
          statTargets,
          { autoAlpha: 0, y: motionTokens.distance.small },
          { autoAlpha: 1, y: 0, stagger: 0.04 },
          '-=0.12'
        );

      if (progressTarget) {
        timeline.fromTo(
          progressTarget,
          { scaleX: 0, transformOrigin: 'left center' },
          { scaleX: 1, duration: motionTokens.duration.slow, ease: motionTokens.ease.emphasized },
          '-=0.16'
        );
      }
    }, dashboardRef);

    return () => ctx.revert();
  }, [isLoadingMetrics, prefersReducedMotion]);

  // ESC key handler for goal modal
  useEffect(() => {
    if (!isGoalModalOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGoalModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isGoalModalOpen]);

  // ESC key handler for relearn confirmation modal
  useEffect(() => {
    if (!relearnConfirmModal.isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRelearnSubmitting) {
        setRelearnConfirmModal({ isOpen: false, vocabId: '', vocabWord: '' });
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [relearnConfirmModal.isOpen, isRelearnSubmitting]);

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (!relearnSuccess) return;
    const timer = setTimeout(() => setRelearnSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [relearnSuccess]);

  const handlePlayAudio = (word: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Handler for relearn action with confirmation
  const handleRelearnVocab = async () => {
    if (!relearnConfirmModal.vocabId || !onUpdateProgress) return;

    setIsRelearnSubmitting(true);
    setRelearnError(null);

    try {
      await onUpdateProgress(relearnConfirmModal.vocabId, 'learning', 'again');

      setRelearnSuccess(`Đã chuyển từ "${relearnConfirmModal.vocabWord}" về danh sách học lại. Từ này sẽ xuất hiện trong phần "Ôn tập" với lịch ôn tập mới.`);
      setRelearnConfirmModal({ isOpen: false, vocabId: '', vocabWord: '' });
    } catch (error) {
      setRelearnError('Không thể chuyển từ về danh sách học lại. Vui lòng thử lại.');
      console.error('Relearn error:', error);
    } finally {
      setIsRelearnSubmitting(false);
    }
  };

  // Helper for time remaining calculation
  const formatTimeRemaining = (isoDateStr: string | undefined, nowMs: number) => {
    if (!isoDateStr) return 'Đến hạn';
    const target = new Date(isoDateStr).getTime();
    const diffMs = target - nowMs;
    if (diffMs <= 0) return 'Đến hạn';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    if (diffHours < 24) return `${diffHours}h${remMins}m`;

    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    return `${diffDays}d${remHours}h`;
  };

  // Derive Real SRS Lists & Counts
  const dueLearningVocabs = vocabularies.filter(
    (v) => v.status === 'learning' && (!v.next_review_at || new Date(v.next_review_at).getTime() <= nowMs)
  );

  const pendingLearningVocabs = vocabularies.filter(
    (v) => v.status === 'learning' && v.next_review_at && new Date(v.next_review_at).getTime() > nowMs
  );

  const realPending = pendingLearningVocabs.map((v) => ({
    id: v.id,
    word: v.word,
    meaning: v.meaning,
    due_in: formatTimeRemaining(v.next_review_at ?? undefined, nowMs),
  }));

  const realMastered = vocabularies
    .filter((v) => v.status === 'mastered')
    .map((v) => ({
      id: v.id,
      word: v.word,
      meaning: v.meaning,
      ipa: [v.phonetic_uk ? `UK: ${v.phonetic_uk}` : '', v.phonetic_us ? `US: ${v.phonetic_us}` : ''].filter(Boolean).join(' | ') || '-',
      mastered_date: v.last_reviewed_at ? new Date(v.last_reviewed_at).toLocaleDateString('vi-VN') : 'Mới đây',
    }));

  const realDifficult = vocabularies
    .filter((v) => (v.again_count && v.again_count >= 5) || v.is_difficult)
    .map((v) => ({
      id: v.id,
      word: v.word,
      meaning: v.meaning,
      ipa: [v.phonetic_uk ? `UK: ${v.phonetic_uk}` : '', v.phonetic_us ? `US: ${v.phonetic_us}` : ''].filter(Boolean).join(' | ') || '-',
      fail_count: v.again_count || 5,
    }));

  const pendingSource = realPending;
  const masteredSource = realMastered;
  const difficultSource = realDifficult;

  const pendingItems = pendingSource.filter(
    (item) =>
      item.word.toLowerCase().includes(detailSearchTerm.toLowerCase()) ||
      item.meaning.toLowerCase().includes(detailSearchTerm.toLowerCase())
  );

  const masteredItems = masteredSource.filter(
    (item) =>
      item.word.toLowerCase().includes(detailSearchTerm.toLowerCase()) ||
      item.meaning.toLowerCase().includes(detailSearchTerm.toLowerCase())
  );

  const difficultItems = difficultSource.filter(
    (item) =>
      item.word.toLowerCase().includes(detailSearchTerm.toLowerCase()) ||
      item.meaning.toLowerCase().includes(detailSearchTerm.toLowerCase())
  );

  // Phase 7: Compute New Words Progress from real metrics
  // Phase 9.10A.4 Fix: Use newVocabularyStudiedToday for "Từ mới" display
  const newWordsCount = dashboardMetrics?.newVocabularyStudiedToday || 0;
  const newWordsPercent = Math.min(100, Math.round((newWordsCount / dailyGoal) * 100));

  // Phase 7: Compute Week Days from real Supabase review_logs data
  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon...
    const distanceToMon = (currentDayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMon);

    const daysName = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    // Build set of studied dates from weekActivity (real Supabase data)
    const studyDatesSet = new Set<string>(
      weekActivity.filter(a => a.count > 0).map(a => a.date)
    );

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const isStudied = studyDatesSet.has(dateStr);
      const dayNum = d.getDate();

      return {
        label: daysName[i],
        dateStr,
        dayNum,
        isToday,
        isStudied,
      };
    });
  }, [weekActivity]);

  const studiedDaysThisWeekCount = weekDays.filter((d) => d.isStudied).length;

  // Filter Topics by Search and Category
  const categories = ['All', ...Array.from(new Set(topics.map((t) => t.category || 'General')))];

  const filteredTopics = topics.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div ref={dashboardRef} className="space-y-5 sm:space-y-8 pb-8 sm:pb-12">
      {/* Hero Welcome Banner */}
      <div data-dashboard-entrance className="relative overflow-hidden rounded-[20px] sm:rounded-[36px] bg-gradient-to-r from-[#F472B6] via-[#FF85A1] to-[#FFB6C1] p-5 sm:p-8 lg:p-10 text-white shadow-lg shadow-pink-100">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-yellow-100" />
            <span>Học Từ Vựng Mỗi Ngày</span>
          </div>
          <h1 className="text-xl sm:text-4xl font-extrabold tracking-tight">
            Chào mừng bạn trở lại! 🌸
          </h1>
          <p className="text-sm sm:text-base text-pink-50 font-medium leading-relaxed">
            Học từ vựng TOEIC chuẩn hóa với Spaced Repetition, Flashcards tương tác và bài kiểm tra phản xạ nhanh.
          </p>
        </div>

        {/* Quick Launch Action Cards */}
        <div className="relative z-10 mt-5 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={() => onSelectTopicForFlashcard('all')}
            className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white/95 hover:bg-white text-gray-800 font-semibold text-sm shadow-xs transition-all hover:scale-[1.01] cursor-pointer group"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFF1F2] flex items-center justify-center text-[#F472B6] shrink-0">
                <Play className="w-4 h-4 fill-[#F472B6]" />
              </div>
              <span className="text-gray-800 font-bold text-xs sm:text-sm">Luyện Tất Cả Từ</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F472B6] group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          <button
            onClick={() => onSelectTopicForSynonyms('all')}
            className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white/95 hover:bg-white text-gray-800 font-semibold text-sm shadow-xs transition-all hover:scale-[1.01] cursor-pointer group"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFF1F2] flex items-center justify-center text-[#F472B6] shrink-0">
                <GitCompareArrows className="w-4 h-4 text-[#F472B6]" />
              </div>
              <span className="text-gray-800 font-bold text-xs sm:text-sm">Luyện Từ Đồng Nghĩa</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F472B6] group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          <button
            onClick={onOpenCollectionModal}
            className="col-span-2 sm:col-span-1 flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-black/10 hover:bg-black/15 backdrop-blur-md text-white font-semibold text-sm shadow-xs transition-all hover:scale-[1.01] cursor-pointer"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 text-pink-100 shrink-0" />
              <span className="text-xs sm:text-sm">Thêm Bài Học Mới</span>
            </div>
          </button>
        </div>
      </div>

      {/* Top Interactive Dashboard Cards: Streak & Daily Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* Card 1: Chuỗi Ngày Học Tập (Streak Tracker) */}
        <div data-dashboard-entrance className="p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-4 sm:space-y-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 text-gray-900 font-extrabold text-base sm:text-xl">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500 shadow-2xs shrink-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-orange-500 text-orange-500 animate-pulse" />
              </div>
              <span className="hidden sm:inline">Chuỗi ngày học tập</span>
              <span className="sm:hidden">Chuỗi học tập</span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap ${
              (dashboardMetrics?.studyStreak || 0) > 0
                ? 'bg-orange-50 text-orange-600 border-orange-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              {(dashboardMetrics?.studyStreak || 0) > 0 ? '🔥 Hoạt động' : '❄️ Bắt đầu'}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-1">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                {isLoadingMetrics ? (
                  <div className="h-10 sm:h-14 w-16 sm:w-20 rounded-lg bg-gray-200 animate-pulse" aria-hidden="true" />
                ) : (
                  <span className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
                    {dashboardMetrics?.studyStreak || 0}
                  </span>
                )}
                <span className="text-base sm:text-lg font-bold text-gray-500">ngày liên tiếp</span>
              </div>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                {(dashboardMetrics?.studyStreak || 0) > 0
                  ? `Xuất sắc! Bạn đã duy trì thói quen học tập liên tục ${dashboardMetrics?.studyStreak} ngày.`
                  : 'Học hoặc ôn từ vựng hôm nay để thắp sáng ngọn lửa học tập!'}
              </p>
            </div>
          </div>

          {/* Weekly Tracker Strip (Mon -> Sun) */}
          <div className="pt-3 border-t border-[#FCE7F3]">
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-gray-400 mb-2">
              <span>Lịch tuần này</span>
              <span className="text-[#ED4F8E] font-semibold">{studiedDaysThisWeekCount}/7</span>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl flex flex-col items-center justify-between gap-0.5 sm:gap-1 transition-all ${
                    day.isStudied
                      ? 'bg-gradient-to-b from-orange-400 to-[#ED4F8E] text-white shadow-xs font-bold'
                      : day.isToday
                      ? 'bg-[#FFF1F2] border-2 border-[#ED4F8E] text-[#ED4F8E] font-extrabold'
                      : 'bg-gray-50 text-gray-400 font-medium'
                  }`}
                >
                  <span className="text-[9px] sm:text-[10px] tracking-wider uppercase opacity-80">{day.label}</span>
                  <div className="my-0.5 flex items-center justify-center">
                    {day.isStudied ? (
                      <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white text-white" />
                    ) : day.isToday ? (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ED4F8E] animate-ping" />
                    ) : (
                      <span className="text-[10px] sm:text-xs">{day.dayNum}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Mục Tiêu Hôm Nay Section */}
        <div data-dashboard-entrance className="p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-4 sm:space-y-5 flex flex-col justify-between">
          {/* Card Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-2.5 text-gray-900 font-extrabold text-base sm:text-xl">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[#ED4F8E]" />
              <span>Mục tiêu hôm nay</span>
            </div>
            <button
              onClick={handleOpenGoalModal}
              title="Cài đặt mục tiêu hàng ngày"
              aria-label="Cài đặt mục tiêu hàng ngày"
              className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-[#ED4F8E] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* 2 Main Sub-cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Ôn tập */}
            <div
              onClick={() => onSelectTopicForFlashcard('all', 'due')}
              className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#FFF5F7] border border-[#FCE7F3] flex flex-col justify-between space-y-2 sm:space-y-3 cursor-pointer hover:border-[#F472B6]/60 transition-all group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ED4F8E]" />
                <span className="group-hover:text-[#ED4F8E] transition-colors">Ôn tập</span>
              </div>

              <div className="text-center py-1 sm:py-2 space-y-1">
                {isLoadingMetrics ? (
                  <div className="h-10 sm:h-12 w-32 sm:w-40 mx-auto rounded-lg bg-gray-200 animate-pulse" aria-hidden="true" />
                ) : (
                  <div className="text-2xl sm:text-4xl font-extrabold text-gray-900">
                    {unlimitedReview
                      ? `${dashboardMetrics?.uniqueVocabularyStudiedToday || 0}`
                      : `${dashboardMetrics?.uniqueVocabularyStudiedToday || 0} / ${dailyReviewLimit}`
                    } <span className="text-xs sm:text-sm font-semibold text-gray-500">{unlimitedReview ? 'từ' : ''}</span>
                  </div>
                )}
                <div className="text-[10px] sm:text-xs text-[#ED4F8E] font-medium">
                  {unlimitedReview ? 'Không giới hạn' : 'Đã ôn hôm nay'}
                </div>
              </div>
            </div>

            {/* Từ mới */}
            <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#FFF1F2]/60 border border-[#FCE7F3] flex flex-col justify-between space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ED4F8E]" />
                <span>Từ mới</span>
              </div>

              <div className="text-center py-1 sm:py-2 space-y-1.5 sm:space-y-2">
                <div className="text-2xl sm:text-4xl font-extrabold text-gray-900">
                  {newWordsCount}
                  <span className="text-sm sm:text-lg font-bold text-gray-400">/{dailyGoal}</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 sm:h-2 bg-[#FCE7F3] rounded-full overflow-hidden max-w-xs mx-auto">
                  <div
                    data-dashboard-progress
                    style={{ width: `${newWordsPercent}%` }}
                    className="h-full bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] rounded-full transition-all duration-500"
                  />
                </div>

                <div className="text-[10px] sm:text-xs text-gray-500 font-medium">
                  {newWordsPercent}% hoàn thành
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Views Overlay (If clicked 'Xem chi tiết') */}
      {activeDetailView === 'pending' && (
        <div className="p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setActiveDetailView(null); setDetailSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-gray-700 hover:text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Quay lại</span>
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] shadow-xs shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-extrabold text-gray-900">
                Từ chưa đến hạn
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {pendingItems.length} từ đang chờ ôn tập
              </p>
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm từ vựng trong danh sách..."
              value={detailSearchTerm}
              onChange={(e) => setDetailSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FCE7F3] rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
            />
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#FCE7F3] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-[#FFF5F7] border-b border-[#FCE7F3] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Từ</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Nghĩa</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5 text-right">Thời gian tới hạn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]/60">
                  {pendingItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FFF5F7]/50 transition-colors">
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 font-bold text-gray-900">
                        {item.word}
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-gray-600 font-medium">
                        {item.meaning}
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-right font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E0F2FE] text-[#0284C7] font-semibold text-[11px]">
                          <Clock className="w-3 h-3" />
                          {item.due_in}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeDetailView === 'mastered' && (
        <div className="p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setActiveDetailView(null); setDetailSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-gray-700 hover:text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Quay lại</span>
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#D1FAE5] flex items-center justify-center text-[#059669] shadow-xs shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-extrabold text-gray-900">
                Từ đã thành thạo
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {masteredItems.length} từ đã thành thạo
              </p>
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm từ vựng..."
              value={detailSearchTerm}
              onChange={(e) => setDetailSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FCE7F3] rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
            />
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#FCE7F3] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-[#FFF5F7] border-b border-[#FCE7F3] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Từ</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Nghĩa</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">IPA</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Ngày thành thạo</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]/60">
                  {masteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FFF5F7]/50 transition-colors">
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayAudio(item.word)}
                            title="Nghe phát âm"
                            aria-label="Nghe phát âm"
                            className="p-1 rounded-lg text-gray-400 hover:text-[#ED4F8E] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span>{item.word}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-gray-600 font-medium">
                        {item.meaning}
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-gray-400 font-mono text-[11px]">
                        {item.ipa || '-'}
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-gray-500 font-medium text-[11px]">
                        {item.mastered_date}
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-right">
                        <button
                          onClick={() => {
                            setRelearnConfirmModal({
                              isOpen: true,
                              vocabId: item.id,
                              vocabWord: item.word,
                            });
                            setRelearnError(null);
                          }}
                          disabled={isRelearnSubmitting}
                          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#FCE7F3] bg-white hover:bg-[#FFF1F2] text-gray-700 hover:text-[#ED4F8E] font-bold text-[11px] transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Học lại</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeDetailView === 'difficult' && (
        <div className="p-4 sm:p-6 rounded-[20px] sm:rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setActiveDetailView(null); setDetailSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-gray-700 hover:text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Quay lại</span>
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#FFE4E6] flex items-center justify-center text-[#E11D48] shadow-xs shrink-0">
              <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-extrabold text-gray-900">
                Từ vựng khó nhớ
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {difficultItems.length} từ khó nhớ
              </p>
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm từ vựng..."
              value={detailSearchTerm}
              onChange={(e) => setDetailSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FCE7F3] rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
            />
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#FCE7F3] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-[#FFF5F7] border-b border-[#FCE7F3] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Từ</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Nghĩa</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">IPA</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5">Số lần quên</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]/60">
                  {difficultItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FFF5F7]/50 transition-colors">
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayAudio(item.word)}
                            title="Nghe phát âm"
                            aria-label="Nghe phát âm"
                            className="p-1 rounded-lg text-gray-400 hover:text-[#ED4F8E] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span>{item.word}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-gray-600 font-medium">
                        {item.meaning}
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-gray-400 font-mono text-[11px]">
                        {item.ipa || '-'}
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 font-semibold text-[#E11D48]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFE4E6] text-[#E11D48] text-[11px]">
                          {item.fail_count} lần
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-right">
                        <button
                          onClick={() => onSelectTopicForFlashcard('all')}
                          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs hover:opacity-95"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Luyện tập</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Spaced Repetition Overview Section (Image 1 Layout) */}
      {activeDetailView === null && (
        <div className="space-y-4 sm:space-y-5">
          {/* Top 4 Mini Stat Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3" role="status" aria-live="polite" aria-busy={isLoadingMetrics}>
            <div data-dashboard-stat className="p-3 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500">Tổng thể</p>
                {isLoadingMetrics ? (
                  <div className="h-7 sm:h-8 w-12 sm:w-16 rounded bg-gray-200 animate-pulse mt-0.5 sm:mt-1" aria-hidden="true" />
                ) : (
                  <p className="text-lg sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">
                    {dashboardMetrics?.totalVocabulary || 0}
                  </p>
                )}
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#FFF1F2] flex items-center justify-center text-[#ED4F8E] shrink-0">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            <div data-dashboard-stat className="p-3 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500">Đã học</p>
                {isLoadingMetrics ? (
                  <div className="h-7 sm:h-8 w-12 sm:w-16 rounded bg-gray-200 animate-pulse mt-0.5 sm:mt-1" aria-hidden="true" />
                ) : (
                  <p className="text-lg sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">
                    {(dashboardMetrics?.masteredVocabulary || 0) + (dashboardMetrics?.learningVocabulary || 0)}
                  </p>
                )}
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#FFF5F7] flex items-center justify-center text-[#F472B6] shrink-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            <div data-dashboard-stat className="p-3 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500">Thành thạo</p>
                {isLoadingMetrics ? (
                  <div className="h-7 sm:h-8 w-12 sm:w-16 rounded bg-gray-200 animate-pulse mt-0.5 sm:mt-1" aria-hidden="true" />
                ) : (
                  <p className="text-lg sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">
                    {dashboardMetrics?.masteredVocabulary || 0}
                  </p>
                )}
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#D1FAE5] flex items-center justify-center text-[#059669] shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            <div data-dashboard-stat className="p-3 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500">Cần ôn ngay</p>
                {isLoadingMetrics ? (
                  <div className="h-7 sm:h-8 w-12 sm:w-16 rounded bg-gray-200 animate-pulse mt-0.5 sm:mt-1" aria-hidden="true" />
                ) : (
                  <p className="text-lg sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">
                    {dashboardMetrics?.dueVocabulary || 0}
                  </p>
                )}
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#F3E8FF] flex items-center justify-center text-[#A855F7] shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </div>

          {/* 4 Status Rows */}
          <div className="space-y-2 sm:space-y-3">
            {/* Row 1: Từ cần ôn ngay */}
            <div className="p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-[#F472B6]/40 transition-all">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#F3E8FF] flex items-center justify-center text-[#A855F7] flex-shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-gray-900">Từ cần ôn ngay</h3>
                  {isLoadingMetrics ? (
                    <div className="h-5 sm:h-7 w-28 sm:w-32 rounded bg-gray-200 animate-pulse mt-1" aria-hidden="true" />
                  ) : (
                    <p className="text-sm sm:text-lg font-black text-[#A855F7]">
                      {dashboardMetrics?.dueVocabulary || 0} từ đến hạn
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onSelectTopicForFlashcard('all', 'due')}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] hover:from-[#E13B7D] hover:to-[#EC4899] text-white font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Ôn tập ngay
              </button>
            </div>

            {/* Row 2: Từ chưa đến hạn */}
            <div className="p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-[#0284C7]/30 transition-all">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] flex-shrink-0">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-gray-900">Từ chưa đến hạn</h3>
                  <p className="text-sm sm:text-lg font-black text-[#0284C7]">
                    {pendingLearningVocabs.length} từ đang chờ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDetailView('pending')}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white hover:bg-[#FFF1F2] border border-[#FCE7F3] text-gray-800 font-bold text-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Xem chi tiết
              </button>
            </div>

            {/* Row 3: Từ đã thành thạo */}
            <div className="p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-[#059669]/30 transition-all">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#D1FAE5] flex items-center justify-center text-[#059669] flex-shrink-0">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-gray-900">Từ đã thành thạo</h3>
                  {isLoadingMetrics ? (
                    <div className="h-5 sm:h-7 w-24 sm:w-28 rounded bg-gray-200 animate-pulse mt-1" aria-hidden="true" />
                  ) : (
                    <p className="text-sm sm:text-lg font-black text-[#059669]">
                      {dashboardMetrics?.masteredVocabulary || 0} từ
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveDetailView('mastered')}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white hover:bg-[#FFF1F2] border border-[#FCE7F3] text-gray-800 font-bold text-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Xem chi tiết
              </button>
            </div>

            {/* Row 4: Từ vựng khó nhớ */}
            <div className="p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-[#E11D48]/30 transition-all">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#FFE4E6] flex items-center justify-center text-[#E11D48] flex-shrink-0">
                  <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-gray-900">Từ vựng khó nhớ</h3>
                  {isLoadingMetrics ? (
                    <div className="h-5 sm:h-7 w-36 sm:w-40 rounded bg-gray-200 animate-pulse mt-1" aria-hidden="true" />
                  ) : (
                    <p className="text-sm sm:text-lg font-black text-[#E11D48]">
                      {dashboardMetrics?.difficultVocabulary || 0} từ bạn thường quên
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveDetailView('difficult')}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white hover:bg-[#FFF1F2] border border-[#FCE7F3] text-gray-800 font-bold text-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: Cài đặt mục tiêu hàng ngày */}
      {isGoalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsGoalModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-[#FCE7F3] rounded-[20px] sm:rounded-[28px] p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-goal-modal-title"
          >

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 id="daily-goal-modal-title" className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-[#ED4F8E] shrink-0" />
                  <span>Cài đặt mục tiêu hàng ngày</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Thiết lập số từ mới và ôn tập mỗi ngày
                </p>
              </div>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                aria-label="Đóng"
                className="p-2 sm:p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Controls */}
            <div className="space-y-4 sm:space-y-5 text-xs">
              {/* Field 1: Số từ mới mỗi ngày */}
              <div className="space-y-2">
                <label htmlFor="daily-goal-input" className="block font-bold text-gray-800">
                  Số từ mới mỗi ngày
                </label>
                <input
                  id="daily-goal-input"
                  type="number"
                  min={1}
                  max={100}
                  value={tempGoal}
                  onChange={(e) => setTempGoal(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2.5 sm:p-3 bg-[#FFF5F7] border border-[#FCE7F3] rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
                />
                <p className="text-[11px] text-gray-400">Giới hạn 1-100 từ</p>
              </div>

              {/* Field 2: Giới hạn ôn tập */}
              <div className="space-y-2.5 pt-2 border-t border-[#FCE7F3]">
                <div className="flex items-center justify-between">
                  <label htmlFor="unlimited-review-toggle" className="font-bold text-gray-800">
                    Giới hạn ôn tập
                  </label>

                  {/* Toggle switch */}
                  <button
                    id="unlimited-review-toggle"
                    type="button"
                    onClick={() => setTempUnlimited(!tempUnlimited)}
                    aria-label={tempUnlimited ? 'Tắt chế độ không giới hạn' : 'Bật chế độ không giới hạn'}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      tempUnlimited ? 'bg-[#ED4F8E]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tempUnlimited ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-gray-600 font-medium text-[11px]">
                  {tempUnlimited && (
                    <span className="text-[#ED4F8E] font-bold">✓</span>
                  )}
                  <span>
                    {tempUnlimited ? 'Không giới hạn số từ ôn tập' : 'Có giới hạn số từ ôn tập'}
                  </span>
                </div>

                {/* Daily Review Limit Input (shown when limited mode is active) */}
                {!tempUnlimited && (
                  <div className="mt-3 space-y-2">
                    <label htmlFor="daily-review-limit-input" className="block text-[11px] font-semibold text-gray-700">
                      Số từ ôn tập tối đa mỗi ngày
                    </label>
                    <input
                      id="daily-review-limit-input"
                      type="number"
                      min={1}
                      max={999}
                      value={tempReviewLimit}
                      onChange={(e) => setTempReviewLimit(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2.5 sm:p-3 bg-[#FFF5F7] border border-[#FCE7F3] rounded-xl font-bold text-gray-900 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
                      placeholder="20"
                    />
                    <p className="text-[10px] text-gray-400">Giới hạn 1-999 từ</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#FCE7F3]">
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors cursor-pointer text-xs sm:text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveGoalSettings}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold hover:opacity-95 shadow-2xs transition-all cursor-pointer text-xs sm:text-sm"
              >
                Lưu
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Relearn Confirmation */}
      {relearnConfirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={() => {
            if (!isRelearnSubmitting) {
              setRelearnConfirmModal({ isOpen: false, vocabId: '', vocabWord: '' });
            }
          }}
        >
          <div
            className="relative w-full max-w-md bg-white border border-[#FCE7F3] rounded-[20px] sm:rounded-[28px] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="relearn-modal-title"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 id="relearn-modal-title" className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-[#ED4F8E] shrink-0" />
                  <span>Xác nhận học lại</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Bạn có chắc muốn học lại từ này?
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isRelearnSubmitting) {
                    setRelearnConfirmModal({ isOpen: false, vocabId: '', vocabWord: '' });
                  }
                }}
                disabled={isRelearnSubmitting}
                aria-label="Đóng"
                className="p-2 sm:p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 rounded-2xl bg-[#FFF5F7] border border-[#FCE7F3] space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#ED4F8E] shadow-xs shrink-0">
                  <Volume2 className="w-4 h-4" />
                </div>
                <p className="font-bold text-gray-900 text-sm">
                  {relearnConfirmModal.vocabWord}
                </p>
              </div>
              <div className="text-xs text-gray-600 leading-relaxed pl-10">
                Từ này sẽ được chuyển về danh sách <span className="font-bold text-[#ED4F8E]">&quot;Đang học&quot;</span> với lịch ôn tập mới. Bạn sẽ thấy từ này trong phần <span className="font-bold">&quot;Từ cần ôn ngay&quot;</span> hoặc <span className="font-bold">&quot;Từ chưa đến hạn&quot;</span>.
              </div>
            </div>

            {/* Error Message */}
            {relearnError && (
              <div className="p-3.5 rounded-2xl bg-[#FFE4E6] border border-[#E11D48] text-[#E11D48] text-xs font-bold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{relearnError}</span>
                </div>
                <button
                  onClick={() => setRelearnError(null)}
                  className="text-[#E11D48] hover:text-[#BE123C] cursor-pointer"
                  aria-label="Đóng thông báo lỗi"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#FCE7F3]">
              <button
                onClick={() => {
                  if (!isRelearnSubmitting) {
                    setRelearnConfirmModal({ isOpen: false, vocabId: '', vocabWord: '' });
                  }
                }}
                disabled={isRelearnSubmitting}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors cursor-pointer text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                onClick={handleRelearnVocab}
                disabled={isRelearnSubmitting}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold hover:opacity-95 shadow-2xs transition-all cursor-pointer text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRelearnSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isRelearnSubmitting ? 'Đang xử lý...' : 'Xác nhận'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {relearnSuccess && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-fadeIn">
          <div className="p-4 rounded-2xl bg-[#D1FAE5] border border-[#059669] text-[#059669] shadow-2xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#059669] shrink-0 shadow-xs">
              <Check className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-bold">Thành công!</p>
              <p className="text-xs leading-relaxed">{relearnSuccess}</p>
            </div>
            <button
              onClick={() => setRelearnSuccess(null)}
              className="text-[#059669] hover:text-[#047857] cursor-pointer shrink-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
