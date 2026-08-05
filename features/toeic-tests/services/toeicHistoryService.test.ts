import { describe, expect, it, vi } from 'vitest';
import { ToeicHistoryError } from '../historyContracts';
import { createToeicHistoryService } from './toeicHistoryService';

const attemptId = '11111111-1111-4111-8111-111111111111';
const testId = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';

const session = {
  attemptId,
  testId,
  mode: 'practice',
  status: 'in_progress',
  selectedParts: [5],
  startedAt: '2026-08-05T08:00:00.000Z',
  deadlineAt: null,
  totalQuestions: 1,
  questions: [{ questionId: '44444444-4444-4444-8444-444444444444', part: 5, position: 1 }],
  answers: [],
  serverNow: '2026-08-05T08:00:00.000Z',
  remainingSeconds: null,
};

describe('toeicHistoryService', () => {
  it('sends bounded filters and maps history', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [], limit: 20, offset: 0, total: 0 }, error: null });
    const service = createToeicHistoryService({ rpc });
    await service.listToeicAttemptHistory({ testId, mode: 'exam', status: 'submitted' });
    expect(rpc).toHaveBeenCalledWith('list_toeic_attempt_history', expect.objectContaining({ p_test_id: testId, p_mode: 'exam', p_status: 'submitted', p_limit: 20, p_offset: 0 }));
  });

  it('validates UUIDs before calling RPC', async () => {
    const rpc = vi.fn();
    const service = createToeicHistoryService({ rpc });
    await expect(service.startToeicWrongQuestionAttempt({ sourceAttemptId: 'bad', idempotencyKey: key })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps stable no-wrong-questions and duplicate errors', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'NO_WRONG_QUESTIONS' } }).mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'DUPLICATE_ACTIVE_ATTEMPT' } });
    const service = createToeicHistoryService({ rpc });
    await expect(service.startToeicWrongQuestionAttempt({ sourceAttemptId: attemptId, idempotencyKey: key })).rejects.toMatchObject({ code: 'NO_WRONG_QUESTIONS' });
    await expect(service.startToeicWrongQuestionAttempt({ sourceAttemptId: attemptId, idempotencyKey: key })).rejects.toMatchObject({ code: 'DUPLICATE_ACTIVE_ATTEMPT' });
  });

  it('maps a server-selected retry session', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: session, error: null });
    const service = createToeicHistoryService({ rpc });
    const result = await service.startToeicWrongQuestionAttempt({ sourceAttemptId: attemptId, idempotencyKey: key });
    expect(result.attemptId).toBe(attemptId);
    expect(rpc).toHaveBeenCalledWith('start_toeic_wrong_question_attempt', { p_source_attempt_id: attemptId, p_idempotency_key: key });
  });

  it('rejects invalid progress response instead of fabricating zeros', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [{ testId }] }, error: null });
    const service = createToeicHistoryService({ rpc });
    await expect(service.getToeicTestProgress([testId])).rejects.toBeInstanceOf(ToeicHistoryError);
  });
});
