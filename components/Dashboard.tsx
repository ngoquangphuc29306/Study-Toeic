'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  HelpCircle,
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
  Check
} from 'lucide-react';
import { Topic, StudyStats, Vocabulary } from '../lib/types';
import { SrsRating } from '../services/vocabService';
import {
  getDashboardMetrics,
  getWeekActivity,
  type DashboardMetrics
} from '../services/dashboardService';

interface DashboardProps {
  topics: Topic[];
  vocabularies: Vocabulary[];
  stats: StudyStats;
  onSelectTopicForFlashcard: (topicId: string, initialStatus?: 'all' | 'new' | 'learning' | 'mastered') => void;
  onSelectTopicForQuiz: (topicId: string) => void;
  onOpenAddModal: () => void;
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
  onSelectTopicForFlashcard,
  onSelectTopicForQuiz,
  onOpenAddModal,
  onUpdateProgress,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Phase 7: Real Supabase metrics
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [weekActivity, setWeekActivity] = useState<Array<{ date: string; count: number }>>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Load real Dashboard metrics from Supabase
  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      try {
        setIsLoadingMetrics(true);
        setMetricsError(null);

        const [metrics, weekData] = await Promise.all([
          getDashboardMetrics(),
          getWeekActivity(),
        ]);

        if (isMounted) {
          setDashboardMetrics(metrics);
          setWeekActivity(weekData);
          setIsLoadingMetrics(false);
        }
      } catch (err) {
        console.error('Dashboard metrics load error:', err);
        if (isMounted) {
          setMetricsError(err instanceof Error ? err.message : 'Không thể tải thống kê');
          setIsLoadingMetrics(false);
        }
      }
    };

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [vocabularies]); // Reload when vocabularies change

  // Daily Goal Settings State (localStorage only for user preference)
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vocab_daily_goal');
      if (saved) return parseInt(saved, 10) || 20;
    }
    return 20;
  });

  const [unlimitedReview, setUnlimitedReview] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vocab_unlimited_review');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoal, setTempGoal] = useState<number>(20);
  const [tempUnlimited, setTempUnlimited] = useState<boolean>(true);

  const handleOpenGoalModal = () => {
    setTempGoal(dailyGoal);
    setTempUnlimited(unlimitedReview);
    setIsGoalModalOpen(true);
  };

  const handleSaveGoalSettings = () => {
    const validGoal = Math.min(100, Math.max(1, tempGoal || 20));
    setDailyGoal(validGoal);
    setUnlimitedReview(tempUnlimited);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vocab_daily_goal', validGoal.toString());
      localStorage.setItem('vocab_unlimited_review', tempUnlimited.toString());
    }
    setIsGoalModalOpen(false);
  };

  const [activeDetailView, setActiveDetailView] = useState<'pending' | 'mastered' | 'difficult' | null>(null);
  const [detailSearchTerm, setDetailSearchTerm] = useState('');

  // Stable timestamp for due-time calculations
  const [nowMs] = useState(() => Date.now());

  const handlePlayAudio = (word: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
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
    due_in: formatTimeRemaining(v.next_review_at, nowMs),
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
  const newWordsCount = dashboardMetrics?.uniqueVocabularyStudiedToday || 0;
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
    <div className="space-y-8 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-[#F472B6] via-[#FF85A1] to-[#FFB6C1] p-8 sm:p-10 text-white shadow-lg shadow-pink-100">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-yellow-100" />
            <span>Học Từ Vựng Mỗi Ngày</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Chào mừng bạn trở lại! 🌸
          </h1>
          <p className="text-pink-50 sm:text-base font-medium leading-relaxed">
            Học từ vựng TOEIC chuẩn hóa với Spaced Repetition, Flashcards tương tác và bài kiểm tra phản xạ nhanh.
          </p>
        </div>

        {/* Quick Launch Action Cards */}
        <div className="relative z-10 mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onSelectTopicForFlashcard('all')}
            className="flex items-center justify-between p-4 rounded-2xl bg-white/95 hover:bg-white text-gray-800 font-semibold text-sm shadow-xs transition-all hover:scale-[1.01] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] flex items-center justify-center text-[#F472B6]">
                <Play className="w-4 h-4 fill-[#F472B6]" />
              </div>
              <span className="text-gray-800 font-bold">Luyện Tất Cả Từ</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#F472B6] group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => onSelectTopicForQuiz('all')}
            className="flex items-center justify-between p-4 rounded-2xl bg-white/95 hover:bg-white text-gray-800 font-semibold text-sm shadow-xs transition-all hover:scale-[1.01] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] flex items-center justify-center text-[#F472B6]">
                <HelpCircle className="w-4 h-4 text-[#F472B6]" />
              </div>
              <span className="text-gray-800 font-bold">Quiz Tổng Hợp</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#F472B6] group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center justify-between p-4 rounded-2xl bg-black/10 hover:bg-black/15 backdrop-blur-md text-white font-semibold text-sm shadow-xs transition-all hover:scale-[1.01] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <PlusCircle className="w-5 h-5 text-pink-100" />
              <span>Thêm Bài Học Mới</span>
            </div>
          </button>
        </div>
      </div>

      {/* Top Interactive Dashboard Cards: Streak & Daily Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Chuỗi Ngày Học Tập (Streak Tracker) */}
        <div className="p-6 rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-gray-900 font-extrabold text-lg sm:text-xl">
              <div className="w-9 h-9 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500 shadow-2xs">
                <Flame className="w-5 h-5 fill-orange-500 text-orange-500 animate-pulse" />
              </div>
              <span>Chuỗi ngày học tập</span>
            </div>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
              (dashboardMetrics?.studyStreak || 0) > 0
                ? 'bg-orange-50 text-orange-600 border-orange-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              {(dashboardMetrics?.studyStreak || 0) > 0 ? '🔥 Chuỗi đang hoạt động' : '❄️ Bắt đầu chuỗi ngay'}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-1">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
                  {isLoadingMetrics ? '...' : (dashboardMetrics?.studyStreak || 0)}
                </span>
                <span className="text-lg font-bold text-gray-500">ngày liên tiếp</span>
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
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2.5">
              <span>Lịch học tuần này</span>
              <span className="text-[#ED4F8E] font-semibold">{studiedDaysThisWeekCount}/7 ngày hoàn thành</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`p-2 rounded-2xl flex flex-col items-center justify-between gap-1 transition-all ${
                    day.isStudied
                      ? 'bg-gradient-to-b from-orange-400 to-[#ED4F8E] text-white shadow-xs font-bold'
                      : day.isToday
                      ? 'bg-[#FFF1F2] border-2 border-[#ED4F8E] text-[#ED4F8E] font-extrabold'
                      : 'bg-gray-50 text-gray-400 font-medium'
                  }`}
                >
                  <span className="text-[10px] tracking-wider uppercase opacity-80">{day.label}</span>
                  <div className="my-0.5 flex items-center justify-center">
                    {day.isStudied ? (
                      <Flame className="w-4 h-4 fill-white text-white" />
                    ) : day.isToday ? (
                      <span className="w-2 h-2 rounded-full bg-[#ED4F8E] animate-ping" />
                    ) : (
                      <span className="text-xs">{day.dayNum}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Mục Tiêu Hôm Nay Section */}
        <div className="p-6 rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-5 flex flex-col justify-between">
          {/* Card Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-gray-900 font-extrabold text-lg sm:text-xl">
              <Target className="w-5 h-5 text-[#ED4F8E]" />
              <span>Mục tiêu hôm nay</span>
            </div>
            <button
              onClick={handleOpenGoalModal}
              title="Cài đặt mục tiêu hàng ngày"
              className="p-2 rounded-xl text-gray-400 hover:text-[#ED4F8E] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* 2 Main Sub-cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ôn tập */}
            <div
              onClick={() => onSelectTopicForFlashcard('all', 'learning')}
              className="p-5 rounded-2xl bg-[#FFF5F7] border border-[#FCE7F3] flex flex-col justify-between space-y-3 cursor-pointer hover:border-[#F472B6]/60 transition-all group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <Clock className="w-4 h-4 text-[#ED4F8E]" />
                <span className="group-hover:text-[#ED4F8E] transition-colors">Ôn tập</span>
              </div>

              <div className="text-center py-2 space-y-1">
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                  {isLoadingMetrics ? '...' : (dashboardMetrics?.dueVocabulary || 0)} <span className="text-sm font-semibold text-gray-500">từ</span>
                </div>
                <div className="text-xs text-[#ED4F8E] font-medium">
                  {unlimitedReview ? 'Không giới hạn' : 'Đã đến hạn ôn tập'}
                </div>
              </div>
            </div>

            {/* Từ mới */}
            <div className="p-5 rounded-2xl bg-[#FFF1F2]/60 border border-[#FCE7F3] flex flex-col justify-between space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <BookOpen className="w-4 h-4 text-[#ED4F8E]" />
                <span>Từ mới</span>
              </div>

              <div className="text-center py-2 space-y-2">
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                  {newWordsCount}
                  <span className="text-base sm:text-lg font-bold text-gray-400">/{dailyGoal} từ</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-[#FCE7F3] rounded-full overflow-hidden max-w-xs mx-auto">
                  <div
                    style={{ width: `${newWordsPercent}%` }}
                    className="h-full bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] rounded-full transition-all duration-500"
                  />
                </div>

                <div className="text-xs text-gray-500 font-medium">
                  {newWordsPercent}% hoàn thành
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Views Overlay (If clicked 'Xem chi tiết') */}
      {activeDetailView === 'pending' && (
        <div className="p-6 rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setActiveDetailView(null); setDetailSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-gray-700 hover:text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] shadow-xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">
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

          <div className="bg-white rounded-[24px] border border-[#FCE7F3] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF5F7] border-b border-[#FCE7F3] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-5">Từ</th>
                    <th className="py-3.5 px-5">Nghĩa</th>
                    <th className="py-3.5 px-5 text-right">Thời gian tới hạn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]/60">
                  {pendingItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FFF5F7]/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-gray-900">
                        {item.word}
                      </td>
                      <td className="py-3.5 px-5 text-gray-600 font-medium">
                        {item.meaning}
                      </td>
                      <td className="py-3.5 px-5 text-right font-medium">
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
        <div className="p-6 rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setActiveDetailView(null); setDetailSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-gray-700 hover:text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#D1FAE5] flex items-center justify-center text-[#059669] shadow-xs">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">
                Từ đã thành thạo
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Các từ bạn đã đánh dấu thành thạo — có thể khôi phục để học lại
              </p>
            </div>
          </div>

          <div className="text-xs font-bold text-gray-700">
            {masteredItems.length} từ đã thành thạo
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

          <div className="bg-white rounded-[24px] border border-[#FCE7F3] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF5F7] border-b border-[#FCE7F3] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-5">Từ</th>
                    <th className="py-3.5 px-5">Nghĩa</th>
                    <th className="py-3.5 px-5">IPA</th>
                    <th className="py-3.5 px-5">Ngày thành thạo</th>
                    <th className="py-3.5 px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]/60">
                  {masteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FFF5F7]/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayAudio(item.word)}
                            title="Nghe phát âm"
                            className="p-1 rounded-lg text-gray-400 hover:text-[#ED4F8E] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span>{item.word}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-gray-600 font-medium">
                        {item.meaning}
                      </td>
                      <td className="py-3.5 px-5 text-gray-400 font-mono text-[11px]">
                        {item.ipa || '-'}
                      </td>
                      <td className="py-3.5 px-5 text-gray-500 font-medium text-[11px]">
                        {item.mastered_date}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={async () => {
                            if (onUpdateProgress) {
                              await onUpdateProgress(item.id, 'learning', 'again');
                            }
                            alert(`Đã chuyển từ "${item.word}" về danh sách học lại.`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#FCE7F3] bg-white hover:bg-[#FFF1F2] text-gray-700 hover:text-[#ED4F8E] font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
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
        <div className="p-6 rounded-[32px] bg-white border border-[#FCE7F3] shadow-2xs space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setActiveDetailView(null); setDetailSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FFF1F2] border border-[#FCE7F3] text-gray-700 hover:text-[#ED4F8E] hover:bg-[#FFE4E6] text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFE4E6] flex items-center justify-center text-[#E11D48] shadow-xs">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">
                Từ vựng khó nhớ
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Các từ vựng bạn trả lời sai nhiều lần cần chú ý đặc biệt
              </p>
            </div>
          </div>

          <div className="text-xs font-bold text-gray-700">
            {difficultItems.length} từ khó nhớ
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

          <div className="bg-white rounded-[24px] border border-[#FCE7F3] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF5F7] border-b border-[#FCE7F3] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-5">Từ</th>
                    <th className="py-3.5 px-5">Nghĩa</th>
                    <th className="py-3.5 px-5">IPA</th>
                    <th className="py-3.5 px-5">Số lần quên</th>
                    <th className="py-3.5 px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FCE7F3]/60">
                  {difficultItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FFF5F7]/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayAudio(item.word)}
                            title="Nghe phát âm"
                            className="p-1 rounded-lg text-gray-400 hover:text-[#ED4F8E] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span>{item.word}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-gray-600 font-medium">
                        {item.meaning}
                      </td>
                      <td className="py-3.5 px-5 text-gray-400 font-mono text-[11px]">
                        {item.ipa || '-'}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-[#E11D48]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFE4E6] text-[#E11D48] text-[11px]">
                          {item.fail_count} lần
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => onSelectTopicForFlashcard('all')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs hover:opacity-95"
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
        <div className="space-y-5">
          {/* Top 4 Mini Stat Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 sm:p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Tổng thể</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {isLoadingMetrics ? '...' : (dashboardMetrics?.totalVocabulary || 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#FFF1F2] flex items-center justify-center text-[#ED4F8E]">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Đã học</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {isLoadingMetrics ? '...' : ((dashboardMetrics?.masteredVocabulary || 0) + (dashboardMetrics?.learningVocabulary || 0))}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#FFF5F7] flex items-center justify-center text-[#F472B6]">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Thành thạo</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {isLoadingMetrics ? '...' : (dashboardMetrics?.masteredVocabulary || 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#D1FAE5] flex items-center justify-center text-[#059669]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Cần ôn ngay</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {isLoadingMetrics ? '...' : (dashboardMetrics?.dueVocabulary || 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F3E8FF] flex items-center justify-center text-[#A855F7]">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 4 Status Rows */}
          <div className="space-y-3">
            {/* Row 1: Từ cần ôn ngay */}
            <div className="p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#F472B6]/40 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#F3E8FF] flex items-center justify-center text-[#A855F7] flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">Từ cần ôn ngay</h3>
                  <p className="text-base sm:text-lg font-black text-[#A855F7]">
                    {isLoadingMetrics ? '...' : `${dashboardMetrics?.dueVocabulary || 0} từ đến hạn`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSelectTopicForFlashcard('all', 'learning')}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] hover:from-[#E13B7D] hover:to-[#EC4899] text-white font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Ôn tập ngay
              </button>
            </div>

            {/* Row 2: Từ chưa đến hạn */}
            <div className="p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#0284C7]/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">Từ chưa đến hạn</h3>
                  <p className="text-base sm:text-lg font-black text-[#0284C7]">
                    {pendingLearningVocabs.length} từ đang chờ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDetailView('pending')}
                className="px-5 py-2.5 rounded-2xl bg-white hover:bg-[#FFF1F2] border border-[#FCE7F3] text-gray-800 font-bold text-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Xem chi tiết
              </button>
            </div>

            {/* Row 3: Từ đã thành thạo */}
            <div className="p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#059669]/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#D1FAE5] flex items-center justify-center text-[#059669] flex-shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">Từ đã thành thạo</h3>
                  <p className="text-base sm:text-lg font-black text-[#059669]">
                    {isLoadingMetrics ? '...' : `${dashboardMetrics?.masteredVocabulary || 0} từ`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDetailView('mastered')}
                className="px-5 py-2.5 rounded-2xl bg-white hover:bg-[#FFF1F2] border border-[#FCE7F3] text-gray-800 font-bold text-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Xem chi tiết
              </button>
            </div>

            {/* Row 4: Từ vựng khó nhớ */}
            <div className="p-5 rounded-[24px] bg-white border border-[#FCE7F3] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#E11D48]/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#FFE4E6] flex items-center justify-center text-[#E11D48] flex-shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">Từ vựng khó nhớ</h3>
                  <p className="text-base sm:text-lg font-black text-[#E11D48]">
                    {isLoadingMetrics ? '...' : `${dashboardMetrics?.difficultVocabulary || 0} từ bạn thường quên`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDetailView('difficult')}
                className="px-5 py-2.5 rounded-2xl bg-white hover:bg-[#FFF1F2] border border-[#FCE7F3] text-gray-800 font-bold text-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: Cài đặt mục tiêu hàng ngày */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-[#FCE7F3] rounded-[28px] p-6 space-y-6 shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#ED4F8E]" />
                  <span>Cài đặt mục tiêu hàng ngày</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Thiết lập số từ mới và ôn tập mỗi ngày
                </p>
              </div>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Controls */}
            <div className="space-y-5 text-xs">
              {/* Field 1: Số từ mới mỗi ngày */}
              <div className="space-y-2">
                <label className="block font-bold text-gray-800">
                  Số từ mới mỗi ngày
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={tempGoal}
                  onChange={(e) => setTempGoal(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-3 bg-[#FFF5F7] border border-[#FCE7F3] rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
                />
                <p className="text-[11px] text-gray-400">Giới hạn 1-100 từ</p>
              </div>

              {/* Field 2: Giới hạn ôn tập */}
              <div className="space-y-2.5 pt-2 border-t border-[#FCE7F3]">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-800">
                    Giới hạn ôn tập
                  </label>
                  
                  {/* Toggle switch */}
                  <button
                    type="button"
                    onClick={() => setTempUnlimited(!tempUnlimited)}
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
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#FCE7F3]">
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveGoalSettings}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold hover:opacity-95 shadow-2xs transition-all cursor-pointer"
              >
                Lưu
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
