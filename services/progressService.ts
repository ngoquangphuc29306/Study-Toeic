/**
 * Progress Service
 *
 * Phase 5: Supabase-backed SRS progress persistence
 * Handles vocabulary progress reads and atomic rating submissions via RPC
 */

import { createClient } from '@/lib/supabase/client';
import { throwIfUnauthorized } from '@/lib/supabase/authRetry';
import type { LearningStatus } from '@/lib/types';

export interface ProgressRecord {
  id: string;
  user_id: string;
  vocabulary_id: string;
  status: LearningStatus;
  interval_hours: number;
  review_count: number;
  again_count: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RatingResult {
  status: 'success' | 'already_processed';
  vocabulary_id?: string;
  rating?: SrsRating;
  next_review_at: string | null;
  interval_hours: number;
  new_status: LearningStatus;
  again_count: number;
  review_count: number;
}

export type SrsRating = 'again' | 'hard' | 'good' | 'easy' | 'mastered';

export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT';
  readonly retryable = false;

  constructor(message = 'Idempotency key was already used with a different rating payload.') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class LegacyIdempotencyResultError extends Error {
  readonly code = 'LEGACY_IDEMPOTENCY_RESULT_UNAVAILABLE';
  readonly retryable = false;

  constructor(message = 'The original rating result is unavailable for this legacy idempotency record.') {
    super(message);
    this.name = 'LegacyIdempotencyResultError';
  }
}

function isRpcStatus(data: unknown, status: 'idempotency_conflict' | 'legacy_result_unavailable'): data is { status: typeof status; message?: string } {
  return Boolean(data && typeof data === 'object' && (data as Record<string, unknown>).status === status);
}

function isRatingResult(data: unknown): data is RatingResult {
  if (!data || typeof data !== 'object') return false;

  const result = data as Record<string, unknown>;
  return (
    (result.status === 'success' || result.status === 'already_processed') &&
    (result.new_status === 'new' || result.new_status === 'learning' || result.new_status === 'mastered') &&
    (result.vocabulary_id === undefined || typeof result.vocabulary_id === 'string') &&
    (result.rating === undefined || result.rating === 'again' || result.rating === 'hard' || result.rating === 'good' || result.rating === 'easy' || result.rating === 'mastered') &&
    (typeof result.next_review_at === 'string' || result.next_review_at === null) &&
    typeof result.interval_hours === 'number' &&
    typeof result.again_count === 'number' &&
    typeof result.review_count === 'number'
  );
}

/**
 * Get progress for multiple vocabularies
 * Returns map of vocabulary_id -> progress
 */
export async function getProgressForVocabularies(
  vocabularyIds: string[]
): Promise<Map<string, ProgressRecord>> {
  if (vocabularyIds.length === 0) {
    return new Map();
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_vocab_progress')
    .select('*')
    .in('vocabulary_id', vocabularyIds);

  if (error) {
    throwIfUnauthorized(error);
    console.error('getProgressForVocabularies error:', error);
    throw new Error('Không thể tải tiến độ học. Vui lòng thử lại.');
  }

  const progressMap = new Map<string, ProgressRecord>();
  if (data) {
    (data as ProgressRecord[]).forEach((record) => {
      progressMap.set(record.vocabulary_id, record as ProgressRecord);
    });
  }

  return progressMap;
}

/**
 * Get progress for a single vocabulary
 */
export async function getProgressForVocabulary(
  vocabularyId: string
): Promise<ProgressRecord | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_vocab_progress')
    .select('*')
    .eq('vocabulary_id', vocabularyId)
    .maybeSingle();

  if (error) {
    console.error('getProgressForVocabulary error:', error);
    throw new Error('Không thể tải tiến độ học. Vui lòng thử lại.');
  }

  return data as ProgressRecord | null;
}

/**
 * Submit vocabulary rating via atomic RPC
 *
 * @param vocabularyId - Vocabulary UUID from Supabase
 * @param rating - User's rating (again/hard/good/easy/mastered)
 * @param idempotencyKey - Client-generated UUID for duplicate protection
 * @returns Calculated progress from server
 */
export async function submitVocabularyRating(
  vocabularyId: string,
  rating: SrsRating,
  idempotencyKey: string
): Promise<RatingResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('submit_vocabulary_rating', {
    p_vocabulary_id: vocabularyId,
    p_rating: rating,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error('submitVocabularyRating error:', error);

    // Handle specific error cases
    if (error.message?.includes('Not authenticated')) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (error.message?.includes('not found or access denied')) {
      throw new Error('Không tìm thấy từ vựng hoặc bạn không có quyền thao tác.');
    }
    if (error.message?.includes('Invalid rating')) {
      throw new Error('Đánh giá không hợp lệ. Vui lòng thử lại.');
    }

    throw new Error('Không thể lưu kết quả học. Vui lòng thử lại.');
  }

  if (isRpcStatus(data, 'idempotency_conflict')) {
    throw new IdempotencyConflictError(data.message);
  }

  if (isRpcStatus(data, 'legacy_result_unavailable')) {
    throw new LegacyIdempotencyResultError(data.message);
  }

  if (!isRatingResult(data)) {
    throw new Error('Không nhận được phản hồi từ máy chủ. Vui lòng thử lại.');
  }

  return data;
}

/**
 * Reset progress for a vocabulary (delete progress row)
 */
export async function resetProgress(vocabularyId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_vocab_progress')
    .delete()
    .eq('vocabulary_id', vocabularyId);

  if (error) {
    console.error('resetProgress error:', error);
    throw new Error('Không thể đặt lại tiến độ. Vui lòng thử lại.');
  }
}

/**
 * Reset all progress for current user
 */
export async function resetAllProgress(): Promise<void> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const { error } = await supabase
    .from('user_vocab_progress')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('resetAllProgress error:', error);
    throw new Error('Không thể đặt lại tiến độ. Vui lòng thử lại.');
  }
}
