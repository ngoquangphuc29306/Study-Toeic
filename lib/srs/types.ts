/**
 * SRS Domain Types
 *
 * Phase 4: Pure domain types for Spaced Repetition System
 * Extracted from services/vocabService.ts to enable pure scheduling functions
 */

export type SrsRating = 'again' | 'hard' | 'good' | 'easy' | 'mastered';

export type LearningStatus = 'new' | 'learning' | 'mastered';

/**
 * Input: Current progress state for a vocabulary
 */
export interface SrsProgress {
  status: LearningStatus;
  interval_hours: number;
  review_count: number;
  again_count: number;
  last_reviewed_at?: string | null;
  next_review_at?: string | null;
}

/**
 * Output: Calculated next review schedule
 */
export interface SrsScheduleResult {
  status: LearningStatus;
  interval_hours: number;
  next_review_at: number | null; // milliseconds since epoch, or null if mastered
  again_count: number;
  review_count: number;
}
