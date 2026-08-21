import { describe, expect, it, vi } from 'vitest';
import { createToeicAutosaveController } from './toeicAutosaveController';

const mutation = (answer: 'A' | 'B') => ({
  questionId: '11111111-1111-4111-8111-111111111111',
  selectedAnswer: answer,
  isFlagged: false,
  answeredAt: null,
  timeSpentSeconds: null,
  clientMutationId: '22222222-2222-4222-8222-222222222222',
});

describe('TOEIC autosave controller', () => {
  it('debounces and coalesces changes', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue({});
    const controller = createToeicAutosaveController({ attemptId: '33333333-3333-4333-8333-333333333333', save, debounceMs: 100, createMutationKey: () => '44444444-4444-4444-8444-444444444444' });
    controller.enqueue(mutation('A'));
    controller.enqueue(mutation('B'));
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].answers[0].selectedAnswer).toBe('B');
    expect(save.mock.calls[0][0].mutationKey).toBe('44444444-4444-4444-8444-444444444444');
    controller.dispose();
    vi.useRealTimers();
  });

  it('retries a failed batch with the same mutation key', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
    const controller = createToeicAutosaveController({ attemptId: '33333333-3333-4333-8333-333333333333', save, debounceMs: 0, createMutationKey: () => '44444444-4444-4444-8444-444444444444' });
    controller.enqueue(mutation('A'));
    await controller.flush();
    expect(controller.getState().status).toBe('error');
    await controller.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][0].mutationKey).toBe(save.mock.calls[1][0].mutationKey);
    expect(controller.getState().status).toBe('saved');
    controller.dispose();
  });
});
