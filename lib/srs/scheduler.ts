/**
 * SRS Scheduler — Pure Domain Functions
 *
 * Phase 4: Extracted from services/vocabService.ts
 * Phase 6: Updated Again behavior to queue-based relearning
 *
 * APPROVED ALGORITHM:
 * - Again: 0 hours, no next_review_at (queue-based relearning)
 * - Hard: initial 6 hours, then ×2
 * - Good: initial 24 hours, then ×3
 * - Easy: initial 72 hours, then ×4
 * - Mastered: no next review
 *
 * Phase 6 Change: Again rating now sets interval=0 and next_review=null.
 * Card reappears after 5 other cards in active study session (client-side queue).
 */

import type { SrsRating, LearningStatus, SrsProgress, SrsScheduleResult } from './types';

// Time constants (explicit units)
const HOUR_MS = 60 * 60_000;

/**
 * Calculate next review schedule based on user rating
 *
 * Pure function - no side effects, deterministic output
 *
 * @param progress - Current vocabulary progress state
 * @param rating - User's rating (again/hard/good/easy/mastered)
 * @param nowMs - Current timestamp in milliseconds (explicit time dependency)
 * @returns Calculated schedule with next review time
 */
export function calculateNextReview(
  progress: SrsProgress,
  rating: SrsRating,
  nowMs: number,
): SrsScheduleResult {
  const currentIntervalHours = progress.interval_hours || 0;
  const currentReviewCount = progress.review_count || 0;
  let currentAgainCount = progress.again_count || 0;

  let nextReviewMs: number | null = null;
  let newIntervalHours = currentIntervalHours;
  let newStatus: LearningStatus = progress.status;

  // Mastered: no next review scheduled
  if (rating === 'mastered') {
    newStatus = 'mastered';
    nextReviewMs = null;
    newIntervalHours = currentIntervalHours; // Preserve interval but don't use it
  }
  // Again: Phase 6 queue-based relearning (no global scheduling)
  else if (rating === 'again') {
    newStatus = 'learning';
    currentAgainCount += 1;
    newIntervalHours = 0; // Queue-based relearning, not time-based
    nextReviewMs = null; // Not scheduled globally, handled by session queue
  }
  // Hard: initial 6 hours or ×2 current interval
  else if (rating === 'hard') {
    newStatus = 'learning';
    newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 2 : 6;
    nextReviewMs = nowMs + newIntervalHours * HOUR_MS;
  }
  // Good: initial 24 hours or ×3 current interval
  else if (rating === 'good') {
    newStatus = 'learning';
    newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 3 : 24;
    nextReviewMs = nowMs + newIntervalHours * HOUR_MS;
  }
  // Easy: initial 72 hours or ×4 current interval
  else if (rating === 'easy') {
    newStatus = 'learning';
    newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 4 : 72;
    nextReviewMs = nowMs + newIntervalHours * HOUR_MS;
  }

  return {
    status: newStatus,
    interval_hours: newIntervalHours,
    next_review_at: nextReviewMs,
    again_count: currentAgainCount,
    review_count: currentReviewCount + 1,
  };
}
