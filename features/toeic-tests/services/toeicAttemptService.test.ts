import { describe, expect, it } from 'vitest';
import {
  createToeicAttemptService,
  type ToeicAttemptRpcClient,
} from './toeicAttemptService';

const testId = '11111111-1111-4111-8111-111111111111';
const attemptId = '22222222-2222-4222-8222-222222222222';
const questionId = '33333333-3333-4333-8333-333333333333';
const key = '44444444-4444-4444-8444-444444444444';
const now = '2026-08-05T04:00:00.000Z';

const session = {
  attemptId,
  testId,
  mode: 'practice',
  status: 'in_progress',
  selectedParts: [5],
  startedAt: now,
  deadlineAt: null,
  totalQuestions: 1,
  questions: [{ questionId, part: 5, position: 100 }],
  answers: [],
  serverNow: now,
  remainingSeconds: null,
};

function clientFor(data: unknown, error: { message: string } | null = null): ToeicAttemptRpcClient {
  return { rpc: async () => ({ data, error }) };
}

describe('TOEIC attempt service', () => {
  it('validates exam part selection before the RPC', async () => {
    const service = createToeicAttemptService(clientFor(session));
    await expect(service.startToeicAttempt({
      testId,
      mode: 'exam',
      selectedParts: [5],
      idempotencyKey: key,
    })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('passes start idempotency and selected parts explicitly', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: ToeicAttemptRpcClient = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: session, error: null };
      },
    };
    await createToeicAttemptService(client).startToeicAttempt({
      testId,
      mode: 'practice',
      selectedParts: [5],
      idempotencyKey: key,
    });
    expect(calls).toEqual([{
      name: 'start_toeic_attempt',
      args: {
        p_test_id: testId,
        p_mode: 'practice',
        p_selected_parts: [5],
        p_idempotency_key: key,
      },
    }]);
  });

  it('maps raw RPC failures to stable errors', async () => {
    const service = createToeicAttemptService(clientFor(null, { message: 'ATTEMPT_EXPIRED internal detail' }));
    await expect(service.getToeicAttemptSession(attemptId)).rejects.toMatchObject({ code: 'ATTEMPT_EXPIRED' });
    await expect(service.getToeicAttemptSession(attemptId)).rejects.not.toHaveProperty('message', 'ATTEMPT_EXPIRED internal detail');
  });

  it('sends a bounded autosave batch and keeps client mutation key', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: ToeicAttemptRpcClient = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return {
          data: {
            attemptId,
            saved: [{ questionId, selectedAnswer: 'B', isFlagged: true, answeredAt: now, timeSpentSeconds: 12, updatedAt: now }],
            serverNow: now,
          },
          error: null,
        };
      },
    };
    await createToeicAttemptService(client).saveToeicAttemptAnswers({
      attemptId,
      mutationKey: key,
      answers: [{ questionId, selectedAnswer: 'B', isFlagged: true, answeredAt: now, timeSpentSeconds: 12, clientMutationId: '55555555-5555-4555-8555-555555555555' }],
    });
    expect(calls[0].args.p_mutation_key).toBe(key);
    expect(calls[0].args.p_answers).toHaveLength(1);
  });
});
