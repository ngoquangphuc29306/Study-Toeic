import { describe, expect, it } from 'vitest';
import { batchToeicAnswerMutations } from './toeicAutosaveBatch';

const answer = (questionId: string, selectedAnswer: 'A' | 'B') => ({
  questionId,
  selectedAnswer,
  isFlagged: false,
  answeredAt: null,
  timeSpentSeconds: null,
  clientMutationId: '11111111-1111-4111-8111-111111111111',
});

describe('TOEIC autosave batching', () => {
  it('keeps the latest state for a question and preserves order', () => {
    expect(batchToeicAnswerMutations([
      answer('q1', 'A'),
      answer('q2', 'A'),
      answer('q1', 'B'),
    ])).toEqual([[answer('q1', 'B'), answer('q2', 'A')]]);
  });

  it('splits batches at the server limit', () => {
    const mutations = Array.from({ length: 5 }, (_, index) => answer(`q${index}`, 'A'));
    expect(batchToeicAnswerMutations(mutations, 2).map((batch) => batch.length)).toEqual([2, 2, 1]);
  });

  it('rejects an oversized configured batch', () => {
    expect(() => batchToeicAnswerMutations([], 51)).toThrow('Invalid TOEIC autosave batch size');
  });
});
