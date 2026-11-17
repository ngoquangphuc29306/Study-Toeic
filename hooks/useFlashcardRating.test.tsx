// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from '../features/synonym-practice/components/test-utils/dom';
import { useFlashcardRating } from './useFlashcardRating';
import { clearPendingRatingAction, loadPendingRatingAction, savePendingRatingAction } from '../lib/session/storage';
import { IdempotencyConflictError, LegacyIdempotencyResultError, type RatingResult } from '../services/progressService';
import type { PreparedRating } from './useFlashcardSession';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

const result = (status: RatingResult['status'] = 'success'): RatingResult => ({
  status, next_review_at: null, interval_hours: 1, new_status: 'learning', again_count: 0, review_count: 1,
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sessionStorage.clear(); });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.unstubAllGlobals(); });

async function setup() {
  const prepare = vi.fn<() => PreparedRating | null>(() => ({ isCurrent: () => true, commit: () => true, isComplete: false }));
  const update = vi.fn<() => Promise<RatingResult>>().mockResolvedValue(result());
  const committed = vi.fn<() => boolean>(() => true);
  const props = { userId: 'user-a' as string | null, vocabularyId: 'v1' as string | undefined,
    onUpdateProgress: update, prepareRating: prepare, onCommitted: committed };
  const resultRef = { current: null as ReturnType<typeof useFlashcardRating> | null };
  function Harness(p: typeof props) {
    const current = useFlashcardRating(p);
    useEffect(() => { resultRef.current = current; }, [current]);
    return null;
  }
  const dom = await mount(<Harness {...props} />);
  cleanups.push(dom.unmount);
  return { result: { get current() { return resultRef.current!; } },
    rerender: (p: typeof props) => dom.render(<Harness {...p} />), unmount: dom.unmount,
    props, prepare, update, committed };
}

it.each(['success', 'already_processed'] as const)('saves retrying before %s and clears only after accepted local commit', async status => {
  const h = await setup();
  const request = deferred<RatingResult>();
  h.update.mockReturnValueOnce(request.promise);
  let task!: Promise<void>;
  act(() => { task = h.result.current.submit(true, 'mastered'); });
  const pending = loadPendingRatingAction('user-a');
  expect(pending).toMatchObject({ vocabularyId: 'v1', rating: 'mastered', isMastered: true, status: 'retrying' });
  expect(h.result.current.isSubmitting).toBe(true);
  expect(h.update).toHaveBeenCalledWith('v1', 'mastered', 'mastered', pending?.idempotencyKey);
  await act(async () => { request.resolve(result(status)); await task; });
  expect(h.committed).toHaveBeenCalledWith(expect.objectContaining({ vocabularyId: 'v1', rating: 'mastered', isMastered: true }), expect.any(Object));
  expect(loadPendingRatingAction('user-a')).toBeNull();
  expect(h.result.current.hasPendingRatingRetry).toBe(false);
});

it('uses a synchronous lock for rapid submissions before render', async () => {
  const h = await setup();
  const request = deferred<RatingResult>();
  h.update.mockReturnValueOnce(request.promise);
  act(() => { void h.result.current.submit(false, 'good'); void h.result.current.submit(false, 'easy'); });
  expect(h.prepare).toHaveBeenCalledTimes(1);
  expect(h.update).toHaveBeenCalledTimes(1);
  await act(async () => { request.resolve(result()); await request.promise; });
  expect(h.committed).toHaveBeenCalledTimes(1);
});

it('keeps the same key and payload through ordinary failure and explicit retry', async () => {
  const h = await setup();
  h.update.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await h.result.current.submit(false, 'hard'); });
  const pending = loadPendingRatingAction('user-a');
  expect(pending).toMatchObject({ rating: 'hard', status: 'retrying' });
  expect(h.result.current.submissionError).toBe('offline');
  expect(h.result.current.hasPendingRatingRetry).toBe(true);
  await act(async () => { await h.result.current.retry(); });
  expect(h.update.mock.calls[1]).toEqual(h.update.mock.calls[0]);
  expect(h.committed).toHaveBeenCalledTimes(1);
  expect(loadPendingRatingAction('user-a')).toBeNull();
});

it.each([IdempotencyConflictError, LegacyIdempotencyResultError])('clears permanent %s keys without committing', async ErrorClass => {
  const h = await setup();
  h.update.mockRejectedValueOnce(new ErrorClass());
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(loadPendingRatingAction('user-a')).toBeNull();
  expect(h.committed).not.toHaveBeenCalled();
  expect(h.result.current.hasPendingRatingRetry).toBe(false);
  expect(h.result.current.submissionError).toMatch(/đánh giá mới/i);
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(h.update.mock.calls[1][3]).not.toBe(h.update.mock.calls[0][3]);
});

it('keeps confirmed metadata when the prepared action declines commit, then retries same key', async () => {
  const h = await setup();
  h.committed.mockReturnValueOnce(false);
  await act(async () => { await h.result.current.submit(false, 'good'); });
  const pending = loadPendingRatingAction('user-a');
  expect(pending?.status).toBe('confirmed');
  expect(h.result.current.hasPendingRatingRetry).toBe(true);
  const request = deferred<RatingResult>();
  h.update.mockReturnValueOnce(request.promise);
  act(() => { void h.result.current.retry(); });
  expect(loadPendingRatingAction('user-a')?.status).toBe('confirmed');
  expect(h.result.current.isSubmitting).toBe(true);
  await act(async () => { request.resolve(result('already_processed')); await request.promise; });
  expect(h.update.mock.calls[1]).toEqual(h.update.mock.calls[0]);
  expect(loadPendingRatingAction('user-a')).toBeNull();
});

it('keeps confirmed metadata when the local callback throws', async () => {
  const h = await setup();
  h.committed.mockImplementationOnce(() => { throw new Error('local'); });
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(loadPendingRatingAction('user-a')?.status).toBe('confirmed');
  expect(h.result.current.hasPendingRatingRetry).toBe(true);
});

it('restores user-scoped pending metadata without auto submitting', async () => {
  savePendingRatingAction('user-a', { vocabularyId: 'v1', isMastered: false, rating: 'good', idempotencyKey: 'original', startedAt: 1, status: 'retrying' });
  const h = await setup();
  await act(async () => { await Promise.resolve(); });
  expect(h.result.current.hasPendingRatingRetry).toBe(true);
  expect(h.update).not.toHaveBeenCalled();
  await act(async () => { await h.result.current.retry(); });
  expect(h.update.mock.calls[0][3]).toBe('original');
});

it('does not write old state into a new card and keeps confirmed recovery', async () => {
  const h = await setup();
  const request = deferred<RatingResult>();
  h.update.mockReturnValueOnce(request.promise);
  act(() => { void h.result.current.submit(false, 'good'); });
  await h.rerender({ ...h.props, vocabularyId: 'v2' });
  await act(async () => { request.resolve(result()); await request.promise; });
  expect(h.committed).not.toHaveBeenCalled();
  expect(loadPendingRatingAction('user-a')?.status).toBe('confirmed');
  expect(h.result.current.hasPendingRatingRetry).toBe(true);
  expect(h.result.current.submissionError).toMatch(/đã được lưu/i);
});

it('shows same-user retry feedback when an ordinary failure settles on a different card', async () => {
  const h = await setup();
  const request = deferred<RatingResult>();
  h.update.mockReturnValueOnce(request.promise);
  act(() => { void h.result.current.submit(false, 'good'); });
  await h.rerender({ ...h.props, vocabularyId: 'v2' });
  await act(async () => { request.reject(new Error('offline')); try { await request.promise; } catch {} });
  expect(loadPendingRatingAction('user-a')?.status).toBe('retrying');
  expect(h.result.current.hasPendingRatingRetry).toBe(true);
  expect(h.result.current.submissionError).toBe('offline');
  expect(h.committed).not.toHaveBeenCalled();
});

it('retries from memory after storage refuses the pending write', async () => {
  const h = await setup();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  h.update.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(h.result.current.hasPendingRatingRetry).toBe(true);
  await act(async () => { await h.result.current.retry(); });
  expect(h.update.mock.calls[1]).toEqual(h.update.mock.calls[0]);
  expect(h.committed).toHaveBeenCalledTimes(1);
  storage.mockRestore(); warn.mockRestore();
});

it('commits a valid RPC result when recovery storage cannot save', async () => {
  const h = await setup();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(h.committed).toHaveBeenCalledTimes(1);
  expect(h.result.current.hasPendingRatingRetry).toBe(false);
  storage.mockRestore(); warn.mockRestore();
});

it('keeps the newer account generation locked when an old A-B-A response settles', async () => {
  const h = await setup();
  const oldRequest = deferred<RatingResult>();
  const newRequest = deferred<RatingResult>();
  h.update.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
  act(() => { void h.result.current.submit(false, 'good'); });
  await h.rerender({ ...h.props, userId: 'user-b' });
  clearPendingRatingAction('user-a');
  await h.rerender(h.props);
  act(() => { void h.result.current.submit(false, 'good'); });
  expect(h.result.current.isLocked()).toBe(true);
  await act(async () => { oldRequest.resolve(result()); await oldRequest.promise; });
  expect(h.result.current.isLocked()).toBe(true);
  expect(h.result.current.isSubmitting).toBe(true);
  await act(async () => { newRequest.resolve(result()); await newRequest.promise; });
  expect(h.committed).toHaveBeenCalledTimes(1);
});

it.each(['unmount', 'account'] as const)('does not recreate metadata after %s', async kind => {
  const h = await setup();
  const request = deferred<RatingResult>();
  h.update.mockReturnValueOnce(request.promise);
  act(() => { void h.result.current.submit(false, 'good'); });
  if (kind === 'unmount') await h.unmount();
  if (kind === 'account') await h.rerender({ ...h.props, userId: 'user-b' });
  await act(async () => { request.resolve(result()); await request.promise; });
  expect(h.committed).not.toHaveBeenCalled();
  expect(loadPendingRatingAction('user-a')?.status).toBe('retrying');
  expect(loadPendingRatingAction('user-b')).toBeNull();
});

it('does not recreate a cleared key after account invalidation', async () => {
  const h = await setup();
  const request = deferred<RatingResult>();
  h.update.mockReturnValueOnce(request.promise);
  act(() => { void h.result.current.submit(false, 'good'); });
  await h.rerender({ ...h.props, userId: 'user-b' });
  clearPendingRatingAction('user-a');
  await act(async () => { request.resolve(result()); await request.promise; });
  expect(loadPendingRatingAction('user-a')).toBeNull();
  expect(h.committed).not.toHaveBeenCalled();
});

it('commits after getItem starts throwing during an in-flight request', async () => {
  const h = await setup();
  const request = deferred<RatingResult>();
  const commit = vi.fn(() => true);
  h.prepare.mockReturnValueOnce({ isCurrent: () => true, commit, isComplete: false });
  h.committed.mockImplementationOnce((_action, prepared) => prepared.commit());
  h.update.mockReturnValueOnce(request.promise);
  act(() => { void h.result.current.submit(false, 'good'); });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage unavailable'); });
  await act(async () => { request.resolve(result()); await request.promise; });
  expect(h.update).toHaveBeenCalledTimes(1);
  expect(h.committed).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(h.result.current.submissionError).toBeNull();
  expect(h.result.current.isLocked()).toBe(false);
  read.mockRestore(); warn.mockRestore();
});

it('allows a new card after committed recovery removal fails once', async () => {
  const h = await setup();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const originalRemove = Storage.prototype.removeItem;
  let failOnce = true;
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
    if (failOnce && key.startsWith('vocab_pending_rating_v1:')) {
      failOnce = false;
      throw new Error('temporary storage failure');
    }
    return originalRemove.call(this, key);
  });
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(h.committed).toHaveBeenCalledTimes(1);
  const stale = loadPendingRatingAction('user-a');
  expect(stale?.status).toBe('confirmed');
  await h.rerender({ ...h.props, vocabularyId: 'v2' });
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(h.update).toHaveBeenCalledTimes(2);
  expect(h.update.mock.calls[1][0]).toBe('v2');
  expect(h.update.mock.calls[1][3]).not.toBe(stale?.idempotencyKey);
  expect(h.committed).toHaveBeenCalledTimes(2);
  expect(loadPendingRatingAction('user-a')).toBeNull();
  remove.mockRestore(); warn.mockRestore();
});

it('does not revive an older committed action after repeated storage failures', async () => {
  const h = await setup();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('remove unavailable'); });
  await act(async () => { await h.result.current.submit(false, 'good'); });
  const first = loadPendingRatingAction('user-a');
  expect(first?.status).toBe('confirmed');
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('write unavailable'); });
  await h.rerender({ ...h.props, vocabularyId: 'v2' });
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(h.update).toHaveBeenCalledTimes(2);
  expect(loadPendingRatingAction('user-a')?.idempotencyKey).toBe(first?.idempotencyKey);
  await h.rerender({ ...h.props, vocabularyId: 'v3' });
  await act(async () => { await h.result.current.submit(false, 'good'); });
  expect(h.update).toHaveBeenCalledTimes(3);
  expect(h.update.mock.calls[2][0]).toBe('v3');
  expect(h.update.mock.calls[2][3]).not.toBe(first?.idempotencyKey);
  expect(h.committed).toHaveBeenCalledTimes(3);
  write.mockRestore(); remove.mockRestore(); warn.mockRestore();
});
