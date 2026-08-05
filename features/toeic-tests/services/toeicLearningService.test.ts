import { describe, expect, it } from 'vitest';
import { createToeicLearningService, type ToeicLearningRpcClient } from './toeicLearningService';

const attemptId = '11111111-1111-4111-8111-111111111111';
const questionId = '22222222-2222-4222-8222-222222222222';
const feedback = {
  attemptId, questionId, passageId: null, questionNumber: 1, part: 5,
  selectedAnswer: 'A', correctAnswer: 'B', isCorrect: false,
  explanationEn: null, explanationVi: 'Giải thích', aiExplanation: null,
  transcript: null, translation: null, vocabulary: null,
};

describe('TOEIC learning service', () => {
  it('calls the practice boundary with only attempt and question IDs', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: ToeicLearningRpcClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data: feedback, error: null }; } };
    await createToeicLearningService(client).checkToeicPracticeAnswer({ attemptId, questionId });
    expect(calls).toEqual([{ name: 'check_toeic_practice_answer', args: { p_attempt_id: attemptId, p_question_id: questionId } }]);
  });

  it('maps stable errors and validates UUIDs before RPC', async () => {
    const client: ToeicLearningRpcClient = { rpc: async () => ({ data: null, error: { message: 'PRACTICE_ONLY internal' } }) };
    await expect(createToeicLearningService(client).checkToeicPracticeAnswer({ attemptId, questionId })).rejects.toMatchObject({ code: 'PRACTICE_ONLY' });
    await expect(createToeicLearningService(client).getToeicAttemptReviewContent('not-a-uuid')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
