/**
 * Study Queue Helpers
 *
 * Phase 6: Again reinsertion and duplicate protection
 */

const AGAIN_REINSERT_GAP = 5;

/**
 * Reinsert item after a fixed gap in the queue
 *
 * @param remainingQueue - Queue after current item removed
 * @param item - Item to reinsert
 * @param gap - Number of items to show before reinsertion
 * @returns Updated queue with item reinserted
 */
export function reinsertAfterGap<T>(
  remainingQueue: T[],
  item: T,
  gap: number = AGAIN_REINSERT_GAP
): T[] {
  const nextQueue = [...remainingQueue];
  const insertAt = Math.min(gap, nextQueue.length);

  nextQueue.splice(insertAt, 0, item);

  return nextQueue;
}

/**
 * Remove duplicate vocabulary IDs from queue (keep first occurrence only)
 *
 * @param vocabularyIds - Queue of vocabulary IDs
 * @returns Deduplicated queue
 */
export function deduplicateQueue(vocabularyIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of vocabularyIds) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

/**
 * Remove a vocabulary ID from queue if it exists beyond current position
 * Used to prevent duplicate entries when pressing Again multiple times
 *
 * @param vocabularyIds - Current queue
 * @param currentIndex - Current position in queue
 * @param vocabId - Vocabulary ID to remove
 * @returns Updated queue with duplicate removed
 */
export function removePendingDuplicate(
  vocabularyIds: string[],
  currentIndex: number,
  vocabId: string
): string[] {
  const result = [...vocabularyIds];

  // Search only beyond current position
  for (let i = currentIndex + 1; i < result.length; i++) {
    if (result[i] === vocabId) {
      result.splice(i, 1);
      break; // Remove only first duplicate found
    }
  }

  return result;
}
