import type { ToeicAttemptAnswerMutation } from '../attemptContracts';

export const TOEIC_AUTOSAVE_MAX_BATCH_SIZE = 50;

/**
 * Coalesces local answer changes before a debounced RPC call. The latest
 * state for each question wins; this utility does not persist data, schedule
 * timers, or decide retry keys.
 */
export function batchToeicAnswerMutations(
  mutations: ReadonlyArray<ToeicAttemptAnswerMutation>,
  maxBatchSize = TOEIC_AUTOSAVE_MAX_BATCH_SIZE
): ReadonlyArray<ReadonlyArray<ToeicAttemptAnswerMutation>> {
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > TOEIC_AUTOSAVE_MAX_BATCH_SIZE) {
    throw new Error('Invalid TOEIC autosave batch size');
  }

  const latestByQuestion = new Map<string, ToeicAttemptAnswerMutation>();
  for (const mutation of mutations) {
    latestByQuestion.set(mutation.questionId, mutation);
  }
  const latest = [...latestByQuestion.values()];
  const batches: Array<ReadonlyArray<ToeicAttemptAnswerMutation>> = [];
  for (let index = 0; index < latest.length; index += maxBatchSize) {
    batches.push(latest.slice(index, index + maxBatchSize));
  }
  return batches;
}
