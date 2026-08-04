import type { Vocabulary } from '../types';
import type { RatingResult } from '../../services/progressService';
import { applyRatingResult } from './applyRatingResult';

const source: Vocabulary = {
  id: 'vocab-1',
  topic_id: 'topic-1',
  word: 'reconcile',
  meaning: 'đối chiếu',
  part_of_speech: 'verb',
  example: 'Reconcile the account.',
  status: 'learning',
  next_review_at: '2026-08-05T00:00:00.000Z',
  interval_hours: 24,
  review_count: 2,
  again_count: 1,
  is_difficult: false,
};

const result: RatingResult = {
  status: 'success',
  vocabulary_id: 'vocab-1',
  rating: 'good',
  new_status: 'learning',
  next_review_at: null,
  interval_hours: 72,
  review_count: 3,
  again_count: 1,
};

describe('applyRatingResult', () => {
  test('patches only authoritative progress fields', () => {
    const patched = applyRatingResult(source, result);

    expect(patched).toMatchObject({
      id: source.id,
      word: source.word,
      meaning: source.meaning,
      status: 'learning',
      next_review_at: null,
      interval_hours: 72,
      review_count: 3,
      again_count: 1,
    });
    expect(patched).not.toBe(source);
  });

  test('supports already_processed with the same authoritative shape', () => {
    expect(applyRatingResult(source, { ...result, status: 'already_processed' }).review_count).toBe(3);
  });

  test('does not mutate the input or patch a different vocabulary', () => {
    const original = { ...source };
    const mismatched = applyRatingResult(source, { ...result, vocabulary_id: 'other' });

    expect(source).toEqual(original);
    expect(mismatched).toBe(source);
  });

  test('preserves the server-provided difficult threshold', () => {
    expect(applyRatingResult(source, { ...result, again_count: 5 }).is_difficult).toBe(true);
  });
});
