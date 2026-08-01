/**
 * Study Queue Transition Logic
 *
 * Phase 6 Fix: Pure transition functions to ensure snapshot consistency
 * The same transition result drives both React state and sessionStorage
 */

import { reinsertAfterGap, removePendingDuplicate } from './queueHelpers';

export interface QueueTransition {
  queue: string[];
  currentIndex: number;
}

/**
 * Apply a rating to the queue and return the next state
 *
 * @param rating - The SRS rating applied
 * @param currentQueue - Current queue state
 * @param currentIndex - Current position in queue
 * @param currentVocabId - ID of the vocabulary just rated
 * @param isLastCard - Whether this is the last card in the queue
 * @returns Next queue state and index
 */
export function applyRatingToQueue(
  rating: 'again' | 'hard' | 'good' | 'easy' | 'mastered',
  currentQueue: string[],
  currentIndex: number,
  currentVocabId: string,
  isLastCard: boolean
): QueueTransition {
  // For "again", reinsert after 5 cards
  if (rating === 'again') {
    // Remove current item from queue (already at currentIndex)
    const remainingQueue = currentQueue.slice(currentIndex + 1);

    // Remove any pending duplicate of this vocabulary ID
    const cleanQueue = removePendingDuplicate(remainingQueue, -1, currentVocabId);

    // Reinsert after 5 cards gap
    const updatedQueue = reinsertAfterGap(cleanQueue, currentVocabId, 5);

    // Prepend already-reviewed items and advance index
    const nextQueue = [...currentQueue.slice(0, currentIndex + 1), ...updatedQueue];
    const nextIndex = currentIndex + 1;

    return { queue: nextQueue, currentIndex: nextIndex };
  }

  // For all other ratings, just advance index
  // Queue remains unchanged
  const nextIndex = isLastCard ? currentIndex : currentIndex + 1;

  return { queue: currentQueue, currentIndex: nextIndex };
}
