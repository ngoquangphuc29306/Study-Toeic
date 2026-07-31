/**
 * SRS Scheduler — Pure Domain Functions
 *
 * Phase 4: Extracted from services/vocabService.ts
 *
 * APPROVED ALGORITHM (MVP):
 * - Again: 1 minute (1/60 hours)
 * - Hard: initial 6 hours, then ×2
 * - Good: initial 24 hours, then ×3
 * - Easy: initial 72 hours, then ×4
 * - Mastered: no next review
 *
 * This implementation preserves exact current behavior.
 * No algorithm changes, no new multipliers, no ease factors.
 */

import type { SrsRating, LearningStatus, SrsProgress, SrsScheduleResult } from './types';

// Time constants (explicit units)
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

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
  // Again: reset to 1 minute, increment again_count
  else if (rating === 'again') {
    newStatus = 'learning';
    currentAgainCount += 1;
    newIntervalHours = 1 / 60; // 1 minute in hours
    nextReviewMs = nowMs + MINUTE_MS;
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
