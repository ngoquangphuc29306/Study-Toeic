import { describe, expect, it } from 'vitest';
import { ToeicHistoryError } from '../historyContracts';
import { mapToeicAttemptHistoryResponse, mapToeicTestProgressResponse } from './toeicHistoryMapper';

const attemptId = '11111111-1111-4111-8111-111111111111';
const testId = '22222222-2222-4222-8222-222222222222';

describe('toeicHistoryMapper', () => {
  it('maps submitted and abandoned history without sensitive fields', () => {
    const result = mapToeicAttemptHistoryResponse({
      items: [{
        attemptId,
        testId,
        testName: 'Test 1',
        setName: 'ETS',
        source: 'local',
        mode: 'exam',
        status: 'submitted',
        selectedParts: [1, 2, 3, 4, 5, 6, 7],
        startedAt: '2026-08-05T08:00:00.000Z',
        submittedAt: '2026-08-05T09:00:00.000Z',
        totalQuestions: 200,
        answeredQuestions: 190,
        correctQuestions: 150,
        listeningCorrect: 75,
        listeningTotal: 100,
        readingCorrect: 75,
        readingTotal: 100,
      }, {
        attemptId: '33333333-3333-4333-8333-333333333333',
        testId,
        testName: 'Test 1',
        setName: 'ETS',
        source: 'local',
        mode: 'practice',
        status: 'abandoned',
        selectedParts: [5],
        startedAt: '2026-08-05T10:00:00.000Z',
        submittedAt: null,
        totalQuestions: 30,
        answeredQuestions: 2,
        correctQuestions: null,
        listeningCorrect: null,
        listeningTotal: null,
        readingCorrect: null,
        readingTotal: null,
      }],
      limit: 20,
      offset: 0,
      total: 2,
    });
    expect(result.items[0].correctQuestions).toBe(150);
    expect(result.items[1].correctQuestions).toBeNull();
  });

  it('rejects non-null scaled score and forbidden fields', () => {
    expect(() => mapToeicAttemptHistoryResponse({ items: [], limit: 20, offset: 0, total: 0, scaledScore: 700 })).toThrow(ToeicHistoryError);
    expect(() => mapToeicAttemptHistoryResponse({ items: [{ user_id: 'secret' }], limit: 20, offset: 0, total: 1 })).toThrow(ToeicHistoryError);
  });

  it('maps empty progress and separates Exam and Practice best values', () => {
    const result = mapToeicTestProgressResponse({ items: [{
      testId,
      totalAttempts: 2,
      submittedAttempts: 2,
      abandonedAttempts: 0,
      expiredAttempts: 0,
      latestAttemptId: attemptId,
      latestSubmittedAt: '2026-08-05T09:00:00.000Z',
      bestCorrectQuestions: 150,
      bestTotalQuestions: 200,
      bestMode: 'exam',
      bestExamCorrectQuestions: 150,
      bestExamTotalQuestions: 200,
      bestPracticeCorrectQuestions: 30,
      bestPracticeTotalQuestions: 30,
      latestCorrectQuestions: 30,
      latestTotalQuestions: 30,
      completedParts: [],
      hasActiveAttempt: false,
      hiddenFromProgress: false,
    }] });
    expect(result[0].completedParts).toEqual([]);
    expect(result[0].bestPracticeCorrectQuestions).toBe(30);
  });
});
