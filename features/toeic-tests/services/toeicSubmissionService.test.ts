import { describe, expect, it } from 'vitest';
import { createToeicSubmissionService, type ToeicSubmissionRpcClient } from './toeicSubmissionService';

const attemptId = '11111111-1111-4111-8111-111111111111';
const testId = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';
const now = '2026-08-05T00:00:00.000Z';
const result = {
  version: 1, attemptId, testId, mode: 'exam', status: 'submitted', totalQuestions: 200,
  answeredQuestions: 180, unansweredQuestions: 20, correctQuestions: 140, incorrectQuestions: 40,
  listeningTotal: 100, listeningCorrect: 75, readingTotal: 100, readingCorrect: 65,
  submittedAt: now, scaledScore: null,
};

function clientFor(data: unknown, error: { message: string } | null = null): ToeicSubmissionRpcClient {
  return { rpc: async () => ({ data, error }) };
}

describe('TOEIC submission service', () => {
  it('passes the idempotency key to submit RPC', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: ToeicSubmissionRpcClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data: result, error: null }; } };
    await createToeicSubmissionService(client).submitToeicAttempt({ attemptId, idempotencyKey: key });
    expect(calls).toEqual([{ name: 'submit_toeic_attempt', args: { p_attempt_id: attemptId, p_idempotency_key: key } }]);
  });

  it('maps stable server errors and rejects invalid UUIDs before RPC', async () => {
    await expect(createToeicSubmissionService(clientFor(null, { message: 'ANSWER_KEY_INCOMPLETE internal' })).submitToeicAttempt({ attemptId, idempotencyKey: key })).rejects.toMatchObject({ code: 'ANSWER_KEY_INCOMPLETE' });
    await expect(createToeicSubmissionService(clientFor(result)).getToeicAttemptResult('not-a-uuid')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
