import { describe, expect, it } from 'vitest';
import { mapToeicAttemptResultResponse, mapToeicAttemptReviewResponse } from './toeicSubmissionMapper';

const attemptId = '11111111-1111-4111-8111-111111111111';
const testId = '22222222-2222-4222-8222-222222222222';
const questionId = '33333333-3333-4333-8333-333333333333';
const now = '2026-08-05T00:00:00.000Z';

const summary = {
  version: 1,
  attemptId,
  testId,
  mode: 'practice',
  status: 'submitted',
  totalQuestions: 30,
  answeredQuestions: 3,
  unansweredQuestions: 27,
  correctQuestions: 2,
  incorrectQuestions: 1,
  listeningTotal: 0,
  listeningCorrect: 0,
  readingTotal: 30,
  readingCorrect: 2,
  submittedAt: now,
  scaledScore: null,
};

describe('TOEIC submission mappers', () => {
  it('maps a safe summary and requires scaledScore null', () => {
    expect(mapToeicAttemptResultResponse(summary)).toMatchObject({ attemptId, totalQuestions: 30, scaledScore: null });
    expect(() => mapToeicAttemptResultResponse({ ...summary, scaledScore: 700 })).toThrow('scaled score');
    expect(() => mapToeicAttemptResultResponse({ ...summary, correct_answer: 'A' })).toThrow('Forbidden');
  });

  it('maps review rows and rejects sensitive fields or inconsistent unanswered state', () => {
    const review = mapToeicAttemptReviewResponse({
      attemptId,
      testId,
      status: 'submitted',
      items: [{ questionId, questionNumber: 1, part: 5, passageId: null, selectedAnswer: null, correctAnswer: 'A', isCorrect: null, isFlagged: false }],
    });
    expect(review.items[0].correctAnswer).toBe('A');
    expect(() => mapToeicAttemptReviewResponse({ attemptId, testId, status: 'submitted', items: [{ questionId, questionNumber: 1, part: 5, passageId: null, selectedAnswer: null, correctAnswer: 'A', isCorrect: true, isFlagged: false }] })).toThrow('Unanswered');
    expect(() => mapToeicAttemptReviewResponse({ attemptId, testId, status: 'submitted', transcript: 'secret', items: [] })).toThrow('Forbidden');
  });
});
