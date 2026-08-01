/**
 * Dashboard Service
 *
 * Phase 7: Real Supabase data for Dashboard metrics
 * Replaces localStorage-based statistics with queries against:
 * - vocabularies (total counts)
 * - user_vocab_progress (status counts, due counts)
 * - review_logs (today activity, streak calculation, recent activity)
 */

import { createClient } from '@/lib/supabase/client';
import type { LearningStatus } from '@/lib/types';

export interface DashboardMetrics {
  totalVocabulary: number;
  newVocabulary: number;
  learningVocabulary: number;
  masteredVocabulary: number;
  dueVocabulary: number; // Current count of words due for review
  reviewsToday: number; // Total review actions today (includes duplicates)
  uniqueVocabularyStudiedToday: number; // Unique due words reviewed today (previous_interval_hours > 0)
  newVocabularyStudiedToday: number; // Unique new words studied today (previous_interval_hours = 0)
  studyStreak: number;
  difficultVocabulary: number;
}

export interface RecentActivity {
  vocabulary_id: string;
  rating: string;
  reviewed_at: string;
  word?: string;
  topic_name?: string;
}

/**
 * Get local day boundaries for timezone-aware queries
 * Returns [startOfDay, endOfDay] in user's local timezone
 */
function getLocalDayBoundaries(date: Date = new Date()): [Date, Date] {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return [startOfDay, endOfDay];
}

/**
 * Get dashboard metrics for current authenticated user
 * All queries are user-scoped through Supabase RLS
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient();

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const now = new Date();
  const [startOfToday, endOfToday] = getLocalDayBoundaries(now);

  try {
    // Query 1: Total vocabulary count (RLS filters by user_id)
    const { count: totalCount, error: totalError } = await supabase
      .from('vocabularies')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Query 2: Progress status counts
    const { data: progressData, error: progressError } = await supabase
      .from('user_vocab_progress')
      .select('status, again_count, next_review_at');

    if (progressError) throw progressError;

    // Calculate status counts and due count
    const progressMap = new Map<LearningStatus, number>();
    let dueCount = 0;
    let difficultCount = 0;

    if (progressData) {
      progressData.forEach((p) => {
        const status = p.status as LearningStatus;
        progressMap.set(status, (progressMap.get(status) || 0) + 1);

        // Due if: status != 'mastered' AND next_review_at <= now
        if (status !== 'mastered' && p.next_review_at) {
          const nextReview = new Date(p.next_review_at);
          if (nextReview <= now) {
            dueCount++;
          }
        }

        // Difficult if: again_count >= 5
        if (p.again_count >= 5) {
          difficultCount++;
        }
      });
    }

    const learningCount = progressMap.get('learning') || 0;
    const masteredCount = progressMap.get('mastered') || 0;
    const totalWithProgress = learningCount + masteredCount;
    const newCount = Math.max(0, (totalCount || 0) - totalWithProgress);

    // Query 3: Today's DUE reviews (exclude new word first studies)
    // Phase 9.10A.4: Filter by previous_interval_hours > 0 to count only reviews
    // previous_interval_hours = 0 means new word (first study, not a review)
    // previous_interval_hours > 0 means word was already studied before (actual review)
    const { data: todayReviews, error: todayError } = await supabase
      .from('review_logs')
      .select('id, vocabulary_id')
      .gte('reviewed_at', startOfToday.toISOString())
      .lte('reviewed_at', endOfToday.toISOString())
      .gt('previous_interval_hours', 0);

    if (todayError) throw todayError;

    const reviewsToday = todayReviews?.length || 0;
    const uniqueVocabToday = todayReviews
      ? new Set(todayReviews.map(r => r.vocabulary_id)).size
      : 0;

    // Query 3b: Today's NEW word studies (first-time studies only)
    // Phase 9.10A.4 Fix: Count unique new words studied today for "Từ mới" display
    const { data: todayNewWords, error: newWordsError } = await supabase
      .from('review_logs')
      .select('id, vocabulary_id')
      .gte('reviewed_at', startOfToday.toISOString())
      .lte('reviewed_at', endOfToday.toISOString())
      .eq('previous_interval_hours', 0);

    if (newWordsError) throw newWordsError;

    const newWordsStudiedToday = todayNewWords
      ? new Set(todayNewWords.map(r => r.vocabulary_id)).size
      : 0;

    // Query 4: Study streak (consecutive days with reviews)
    const streak = await calculateStudyStreak(supabase, now);

    return {
      totalVocabulary: totalCount || 0,
      newVocabulary: newCount,
      learningVocabulary: learningCount,
      masteredVocabulary: masteredCount,
      dueVocabulary: dueCount,
      reviewsToday,
      uniqueVocabularyStudiedToday: uniqueVocabToday,
      newVocabularyStudiedToday: newWordsStudiedToday,
      studyStreak: streak,
      difficultVocabulary: difficultCount,
    };
  } catch (err) {
    console.error('getDashboardMetrics error:', err);
    throw new Error('Không thể tải thống kê Dashboard. Vui lòng thử lại.');
  }
}

/**
 * Calculate study streak: consecutive days with at least one review
 * Uses ONE bounded query to fetch all review timestamps, then calculates streak client-side
 */
async function calculateStudyStreak(
  supabase: ReturnType<typeof createClient>,
  referenceDate: Date = new Date()
): Promise<number> {
  const today = new Date(referenceDate);

  // Bounded query: fetch last 365 days of review timestamps in ONE request
  const maxDaysBack = 365;
  const boundaryDate = new Date(today);
  boundaryDate.setDate(boundaryDate.getDate() - maxDaysBack);
  const [startBoundary] = getLocalDayBoundaries(boundaryDate);

  const { data: reviews, error } = await supabase
    .from('review_logs')
    .select('reviewed_at')
    .gte('reviewed_at', startBoundary.toISOString());

  if (error) throw error;

  // No reviews in last 365 days = streak is 0
  if (!reviews || reviews.length === 0) {
    return 0;
  }

  // Convert timestamps to local date keys and deduplicate
  const studiedDates = new Set<string>();
  reviews.forEach((review) => {
    const reviewDate = new Date(review.reviewed_at);
    const localDateKey = `${reviewDate.getFullYear()}-${String(reviewDate.getMonth() + 1).padStart(2, '0')}-${String(reviewDate.getDate()).padStart(2, '0')}`;
    studiedDates.add(localDateKey);
  });

  // Calculate streak using pure function
  return calculateConsecutiveStreak(studiedDates, today);
}

/**
 * Pure function: Calculate consecutive streak from set of date keys
 * Counts backwards from today/yesterday until finding a missing date
 */
function calculateConsecutiveStreak(
  studiedDates: Set<string>,
  referenceDate: Date
): number {
  const today = new Date(referenceDate);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // Streak must start today or yesterday
  let currentDate: Date;
  if (studiedDates.has(todayKey)) {
    currentDate = today;
  } else if (studiedDates.has(yesterdayKey)) {
    currentDate = yesterday;
  } else {
    return 0; // No recent activity
  }

  let streak = 0;
  const maxDays = 365; // Safety limit

  for (let i = 0; i < maxDays; i++) {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

    if (!studiedDates.has(dateKey)) {
      break; // Streak ends
    }

    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

/**
 * Get recent activity (last N review actions)
 * Returns review logs with vocabulary word and topic name
 */
export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  const supabase = createClient();

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  try {
    // Query review_logs with vocabulary join
    const { data, error } = await supabase
      .from('review_logs')
      .select(`
        vocabulary_id,
        rating,
        reviewed_at,
        vocabularies!inner(word, topic_id, topics(name))
      `)
      .order('reviewed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!data) return [];

    // Transform joined data
    return data.map((log: any) => ({
      vocabulary_id: log.vocabulary_id,
      rating: log.rating,
      reviewed_at: log.reviewed_at,
      word: log.vocabularies?.word,
      topic_name: log.vocabularies?.topics?.name,
    }));
  } catch (err) {
    console.error('getRecentActivity error:', err);
    throw new Error('Không thể tải hoạt động gần đây. Vui lòng thử lại.');
  }
}

/**
 * Get study dates for week visualization
 * Returns array of { date: 'YYYY-MM-DD', count: number } for last 7 days
 */
export async function getWeekActivity(): Promise<Array<{ date: string; count: number }>> {
  const supabase = createClient();

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const [startOfWeek] = getLocalDayBoundaries(sevenDaysAgo);

  try {
    // Get all reviews from last 7 days
    const { data, error } = await supabase
      .from('review_logs')
      .select('reviewed_at')
      .gte('reviewed_at', startOfWeek.toISOString());

    if (error) throw error;

    // Group by local date
    const countsByDate = new Map<string, number>();

    // Initialize all 7 days with 0
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      countsByDate.set(dateStr, 0);
    }

    // Count reviews per day
    if (data) {
      data.forEach((review) => {
        const reviewDate = new Date(review.reviewed_at);
        const localDateStr = reviewDate.toISOString().split('T')[0];
        countsByDate.set(localDateStr, (countsByDate.get(localDateStr) || 0) + 1);
      });
    }

    // Convert to array
    return Array.from(countsByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error('getWeekActivity error:', err);
    throw new Error('Không thể tải hoạt động tuần. Vui lòng thử lại.');
  }
}
