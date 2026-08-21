import { describe, expect, it } from 'vitest';
import { mapSaveToeicAttemptAnswersResponse, mapToeicAttemptSessionResponse } from './toeicAttemptMapper';

const baseSession = {
  attemptId: '11111111-1111-4111-8111-111111111111',
  testId: '22222222-2222-4222-8222-222222222222',
  mode: 'practice',
  status: 'in_progress',
  selectedParts: [5],
  startedAt: '2026-08-05T04:00:00.000Z',
  deadlineAt: null,
  totalQuestions: 1,
  questions: [{ questionId: '33333333-3333-4333-8333-333333333333', part: 5, position: 100 }],
  answers: [],
  serverNow: '2026-08-05T04:00:01.000Z',
  remainingSeconds: null,
};

describe('TOEIC attempt mappers', () => {
  it('maps a safe session payload', () => {
    expect(mapToeicAttemptSessionResponse(baseSession).questions).toHaveLength(1);
  });

  it('rejects answer keys and correctness fields', () => {
    expect(() => mapToeicAttemptSessionResponse({ ...baseSession, correctAnswer: 'A' }))
      .toThrow(/Forbidden TOEIC attempt field/);
  });

  it('maps autosave rows and rejects malformed membership', () => {
    const result = mapSaveToeicAttemptAnswersResponse({
      attemptId: baseSession.attemptId,
      saved: [{
        questionId: baseSession.questions[0].questionId,
        selectedAnswer: 'B',
        isFlagged: true,
        answeredAt: baseSession.serverNow,
        timeSpentSeconds: 12,
        updatedAt: baseSession.serverNow,
      }],
      serverNow: baseSession.serverNow,
    });
    expect(result.saved[0].selectedAnswer).toBe('B');
    expect(() => mapToeicAttemptSessionResponse({
      ...baseSession,
      answers: [{
        questionId: '44444444-4444-4444-8444-444444444444',
        selectedAnswer: null,
        isFlagged: false,
        answeredAt: null,
        timeSpentSeconds: null,
        updatedAt: baseSession.serverNow,
      }],
    })).toThrow(/membership/);
  });
});
