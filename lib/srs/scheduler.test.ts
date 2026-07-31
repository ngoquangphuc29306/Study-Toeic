/**
 * SRS Scheduler Tests
 *
 * Phase 4: Characterization tests to verify extracted algorithm
 * matches original behavior exactly
 *
 * These tests use fixed timestamps to ensure deterministic results.
 * Never use Date.now() in test assertions.
 */

import { calculateNextReview } from './scheduler';
import type { SrsProgress } from './types';

// Fixed timestamp for all tests: 2026-07-31T00:00:00.000Z
const NOW = Date.UTC(2026, 6, 31, 0, 0, 0);

describe('SRS Scheduler - calculateNextReview', () => {
  describe('Again rating', () => {
    test('new + again → 1 minute interval', () => {
      const progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'again', NOW);

      expect(result.status).toBe('learning');
      expect(result.interval_hours).toBe(1 / 60);
      expect(result.next_review_at).toBe(NOW + 60 * 1000);
      expect(result.again_count).toBe(1);
      expect(result.review_count).toBe(1);
    });

    test('learning + again → resets to 1 minute', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 24,
        review_count: 3,
        again_count: 1,
      };

      const result = calculateNextReview(progress, 'again', NOW);

      expect(result.status).toBe('learning');
      expect(result.interval_hours).toBe(1 / 60);
      expect(result.next_review_at).toBe(NOW + 60 * 1000);
      expect(result.again_count).toBe(2);
      expect(result.review_count).toBe(4);
    });

    test('again increments again_count', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 72,
        review_count: 5,
        again_count: 4,
      };

      const result = calculateNextReview(progress, 'again', NOW);

      expect(result.again_count).toBe(5);
    });
  });

  describe('Hard rating', () => {
    test('first hard review → 6 hours', () => {
      const progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'hard', NOW);

      expect(result.status).toBe('learning');
      expect(result.interval_hours).toBe(6);
      expect(result.next_review_at).toBe(NOW + 6 * 60 * 60 * 1000);
      expect(result.again_count).toBe(0);
      expect(result.review_count).toBe(1);
    });

    test('subsequent hard review → ×2 multiplier', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 24,
        review_count: 2,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'hard', NOW);

      expect(result.interval_hours).toBe(48);
      expect(result.next_review_at).toBe(NOW + 48 * 60 * 60 * 1000);
    });

    test('hard preserves again_count', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 12,
        review_count: 3,
        again_count: 2,
      };

      const result = calculateNextReview(progress, 'hard', NOW);

      expect(result.again_count).toBe(2);
    });
  });

  describe('Good rating', () => {
    test('first good review → 24 hours', () => {
      const progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'good', NOW);

      expect(result.status).toBe('learning');
      expect(result.interval_hours).toBe(24);
      expect(result.next_review_at).toBe(NOW + 24 * 60 * 60 * 1000);
      expect(result.again_count).toBe(0);
      expect(result.review_count).toBe(1);
    });

    test('subsequent good review → ×3 multiplier', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 24,
        review_count: 1,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'good', NOW);

      expect(result.interval_hours).toBe(72);
      expect(result.next_review_at).toBe(NOW + 72 * 60 * 60 * 1000);
    });

    test('good sequence: 24h → 72h → 216h', () => {
      let progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      // First good
      let result = calculateNextReview(progress, 'good', NOW);
      expect(result.interval_hours).toBe(24);

      // Second good
      progress = {
        status: result.status,
        interval_hours: result.interval_hours,
        review_count: result.review_count,
        again_count: result.again_count,
      };
      result = calculateNextReview(progress, 'good', NOW);
      expect(result.interval_hours).toBe(72);

      // Third good
      progress = {
        status: result.status,
        interval_hours: result.interval_hours,
        review_count: result.review_count,
        again_count: result.again_count,
      };
      result = calculateNextReview(progress, 'good', NOW);
      expect(result.interval_hours).toBe(216);
    });
  });

  describe('Easy rating', () => {
    test('first easy review → 72 hours', () => {
      const progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'easy', NOW);

      expect(result.status).toBe('learning');
      expect(result.interval_hours).toBe(72);
      expect(result.next_review_at).toBe(NOW + 72 * 60 * 60 * 1000);
      expect(result.again_count).toBe(0);
      expect(result.review_count).toBe(1);
    });

    test('subsequent easy review → ×4 multiplier', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 72,
        review_count: 1,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'easy', NOW);

      expect(result.interval_hours).toBe(288);
      expect(result.next_review_at).toBe(NOW + 288 * 60 * 60 * 1000);
    });

    test('easy sequence: 72h → 288h → 1152h', () => {
      let progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      // First easy
      let result = calculateNextReview(progress, 'easy', NOW);
      expect(result.interval_hours).toBe(72);

      // Second easy
      progress = {
        status: result.status,
        interval_hours: result.interval_hours,
        review_count: result.review_count,
        again_count: result.again_count,
      };
      result = calculateNextReview(progress, 'easy', NOW);
      expect(result.interval_hours).toBe(288);

      // Third easy
      progress = {
        status: result.status,
        interval_hours: result.interval_hours,
        review_count: result.review_count,
        again_count: result.again_count,
      };
      result = calculateNextReview(progress, 'easy', NOW);
      expect(result.interval_hours).toBe(1152);
    });
  });

  describe('Mastered rating', () => {
    test('mastered → no next review', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 24,
        review_count: 5,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'mastered', NOW);

      expect(result.status).toBe('mastered');
      expect(result.next_review_at).toBeNull();
      expect(result.interval_hours).toBe(24); // Preserved
      expect(result.again_count).toBe(0);
    });

    test('mastered from new state', () => {
      const progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'mastered', NOW);

      expect(result.status).toBe('mastered');
      expect(result.next_review_at).toBeNull();
    });
  });

  describe('Edge cases', () => {
    test('input object remains unchanged (immutability)', () => {
      const progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      const originalProgress = { ...progress };
      calculateNextReview(progress, 'good', NOW);

      expect(progress).toEqual(originalProgress);
    });

    test('zero interval with hard rating', () => {
      const progress: SrsProgress = {
        status: 'new',
        interval_hours: 0,
        review_count: 0,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'hard', NOW);

      expect(result.interval_hours).toBe(6);
    });

    test('large interval does not cause overflow', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 10000,
        review_count: 20,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'easy', NOW);

      expect(result.interval_hours).toBe(40000);
      expect(typeof result.next_review_at).toBe('number');
      expect(result.next_review_at).toBeGreaterThan(NOW);
    });

    test('deterministic output for same inputs', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 24,
        review_count: 3,
        again_count: 1,
      };

      const result1 = calculateNextReview(progress, 'good', NOW);
      const result2 = calculateNextReview(progress, 'good', NOW);

      expect(result1).toEqual(result2);
    });

    test('review_count increments by 1', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 24,
        review_count: 10,
        again_count: 2,
      };

      const result = calculateNextReview(progress, 'good', NOW);

      expect(result.review_count).toBe(11);
    });
  });

  describe('Lapse scenario (again after long interval)', () => {
    test('72h interval + again → resets to 1 minute', () => {
      const progress: SrsProgress = {
        status: 'learning',
        interval_hours: 72,
        review_count: 2,
        again_count: 0,
      };

      const result = calculateNextReview(progress, 'again', NOW);

      expect(result.interval_hours).toBe(1 / 60);
      expect(result.next_review_at).toBe(NOW + 60 * 1000);
      expect(result.again_count).toBe(1);
    });

    test('recovery after lapse: again → hard → good', () => {
      let progress: SrsProgress = {
        status: 'learning',
        interval_hours: 72,
        review_count: 2,
        again_count: 0,
      };

      // Lapse: again
      let result = calculateNextReview(progress, 'again', NOW);
      expect(result.interval_hours).toBe(1 / 60);
      expect(result.again_count).toBe(1);

      // Recovery: hard (from 1/60 h → 6h)
      progress = {
        status: result.status,
        interval_hours: result.interval_hours,
        review_count: result.review_count,
        again_count: result.again_count,
      };
      result = calculateNextReview(progress, 'hard', NOW);
      expect(result.interval_hours).toBe(6);
      expect(result.again_count).toBe(1); // Preserved

      // Continue: good (6h × 3 = 18h)
      progress = {
        status: result.status,
        interval_hours: result.interval_hours,
        review_count: result.review_count,
        again_count: result.again_count,
      };
      result = calculateNextReview(progress, 'good', NOW);
      expect(result.interval_hours).toBe(18);
      expect(result.again_count).toBe(1); // Still preserved
    });
  });
});
