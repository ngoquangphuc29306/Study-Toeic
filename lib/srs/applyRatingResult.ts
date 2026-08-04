import type { Vocabulary } from '../types';
import type { RatingResult } from '../../services/progressService';

/**
 * Applies only the progress fields returned by the authoritative RPC result.
 * It deliberately does not calculate an SRS schedule on the client.
 */
export function applyRatingResult(
  vocabulary: Vocabulary,
  result: RatingResult
): Vocabulary {
  if (result.vocabulary_id && result.vocabulary_id !== vocabulary.id) {
    return vocabulary;
  }

  return {
    ...vocabulary,
    status: result.new_status,
    next_review_at: result.next_review_at,
    interval_hours: result.interval_hours,
    review_count: result.review_count,
    again_count: result.again_count,
    is_difficult: result.again_count >= 5,
  };
}
