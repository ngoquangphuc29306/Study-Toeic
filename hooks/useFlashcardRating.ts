'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearPendingRatingAction, loadPendingRatingAction, savePendingRatingAction, type PendingRatingAction } from '../lib/session/storage';
import { IdempotencyConflictError, LegacyIdempotencyResultError, type RatingResult } from '../services/progressService';
import type { SrsRating } from '../services/vocabService';
import type { PreparedRating } from './useFlashcardSession';

export interface FlashcardRatingOptions {
  userId: string | null;
  vocabularyId: string | undefined;
  onUpdateProgress: (vocabId: string, status: 'learning' | 'mastered', rating?: SrsRating, idempotencyKey?: string) => Promise<RatingResult>;
  prepareRating: (rating: SrsRating, isMastered: boolean) => PreparedRating | null;
  onCommitted: (action: Pick<PendingRatingAction, 'vocabularyId' | 'rating' | 'isMastered'>, prepared: PreparedRating) => boolean;
}

const confirmedMessage = 'Đánh giá trước đã được lưu nhưng phiên học chưa hoàn tất. Hãy tiếp tục với cùng kết quả.';
const retryMessage = 'Đánh giá trước chưa được xác nhận. Hãy thử lại với cùng kết quả.';

export function useFlashcardRating({ userId, vocabularyId, onUpdateProgress, prepareRating, onCommitted }: FlashcardRatingOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [hasPendingRatingRetry, setHasPendingRatingRetry] = useState(false);
  const lockRef = useRef(false);
  const pendingRef = useRef<PendingRatingAction | null>(null);
  const clearedActionsRef = useRef<Map<string, Set<string>>>(new Map());
  const mountedRef = useRef(true);
  const contextRef = useRef({ userId, vocabularyId });
  const ownerRef = useRef({ userId, generation: 0 });

  const rememberCleared = useCallback((ownerId: string, key: string) => {
    let keys = clearedActionsRef.current.get(ownerId);
    if (!keys) {
      keys = new Set();
      clearedActionsRef.current.set(ownerId, keys);
    }
    keys.add(key);
  }, []);

  const readPending = useCallback((ownerId: string) => {
    const pending = loadPendingRatingAction(ownerId);
    if (pending && clearedActionsRef.current.get(ownerId)?.has(pending.idempotencyKey)) {
      // A failed removeItem must not resurrect an action already applied locally.
      clearPendingRatingAction(ownerId);
      return null;
    }
    return pending;
  }, []);

  useEffect(() => {
    contextRef.current = { userId, vocabularyId };
    if (ownerRef.current.userId !== userId) {
      ownerRef.current = { userId, generation: ownerRef.current.generation + 1 };
      pendingRef.current = null;
      lockRef.current = false;
      setIsSubmitting(false);
      setHasPendingRatingRetry(false);
      setSubmissionError(null);
    }
  }, [userId, vocabularyId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!userId || !vocabularyId) return;
    let cancelled = false;
    queueMicrotask(() => {
      const pending = readPending(userId);
      if (cancelled || !pending || pending.vocabularyId !== vocabularyId) return;
      pendingRef.current = pending;
      setHasPendingRatingRetry(true);
      setSubmissionError(pending.status === 'confirmed' ? confirmedMessage : retryMessage);
    });
    return () => { cancelled = true; };
  }, [userId, vocabularyId, readPending]);

  const isLocked = useCallback(() => lockRef.current, []);

  const run = useCallback(async (isMastered: boolean, rating?: SrsRating, retryOnly = false): Promise<void> => {
    if (!userId || !vocabularyId || lockRef.current || !mountedRef.current) return;
    const existing = pendingRef.current ?? readPending(userId);
    if (retryOnly && (!existing || existing.vocabularyId !== vocabularyId)) return;
    const srsRating = retryOnly && existing ? existing.rating : rating ?? (isMastered ? 'mastered' : 'good');
    if (existing && (existing.vocabularyId !== vocabularyId || existing.rating !== srsRating || existing.isMastered !== isMastered)) {
      setSubmissionError('Đánh giá trước chưa được xác nhận. Hãy thử lại đánh giá đó trước.');
      setHasPendingRatingRetry(true);
      return;
    }
    // Capture the session generation and queue transition before the first await.
    const prepared = prepareRating(srsRating, isMastered);
    if (!prepared) return;
    lockRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    setHasPendingRatingRetry(false);
    const pending: PendingRatingAction = existing ?? {
      vocabularyId, isMastered, rating: srsRating, idempotencyKey: crypto.randomUUID(), startedAt: Date.now(), status: 'pending',
    };
    // A confirmed RPC result stays confirmed while its local commit is retried.
    const retrying: PendingRatingAction = { ...pending, status: pending.status === 'confirmed' ? 'confirmed' : 'retrying' };
    pendingRef.current = retrying;
    savePendingRatingAction(userId, retrying);
    const generation = ownerRef.current.generation;
    const stillOwned = () => mountedRef.current && ownerRef.current.userId === userId &&
      ownerRef.current.generation === generation && pendingRef.current?.idempotencyKey === pending.idempotencyKey;
    const release = () => {
      if (mountedRef.current && ownerRef.current.userId === userId && ownerRef.current.generation === generation) {
        lockRef.current = false;
        setIsSubmitting(false);
      }
    };
    const sameCard = () => contextRef.current.vocabularyId === vocabularyId;
    try {
      const status = isMastered || srsRating === 'mastered' ? 'mastered' : 'learning';
      await onUpdateProgress(vocabularyId, status, srsRating, pending.idempotencyKey);
    } catch (err) {
      if (stillOwned()) {
        const permanent = err instanceof IdempotencyConflictError || err instanceof LegacyIdempotencyResultError;
        if (permanent) {
          rememberCleared(userId, pending.idempotencyKey);
          pendingRef.current = null;
          clearPendingRatingAction(userId);
        } else if (pending.status === 'confirmed') {
          pendingRef.current = pending;
          savePendingRatingAction(userId, pending);
        }
        setSubmissionError(err instanceof IdempotencyConflictError
            ? 'Khóa đánh giá không còn hợp lệ cho thao tác này. Hãy thực hiện đánh giá mới.'
            : err instanceof LegacyIdempotencyResultError
              ? 'Kết quả của thao tác cũ không thể khôi phục. Hãy thực hiện đánh giá mới.'
              : err instanceof Error ? err.message : 'Không thể lưu kết quả. Vui lòng thử lại.');
        setHasPendingRatingRetry(!permanent);
      }
      release();
      return;
    }

    if (!stillOwned()) {
      release();
      return;
    }
    const confirmed: PendingRatingAction = { ...retrying, status: 'confirmed' };
    pendingRef.current = confirmed;
    savePendingRatingAction(userId, confirmed);
    if (sameCard()) {
      try {
        if (prepared.isCurrent() && onCommitted(confirmed, prepared)) {
          // A confirmed action is cleared only after the captured local transition accepts it.
          if (stillOwned()) {
            rememberCleared(userId, pending.idempotencyKey);
            pendingRef.current = null;
            clearPendingRatingAction(userId);
            setHasPendingRatingRetry(false);
            setSubmissionError(null);
          }
        } else {
          setHasPendingRatingRetry(true);
          setSubmissionError(confirmedMessage);
        }
      } catch (err) {
        console.error('Confirmed rating local commit error:', err);
        setHasPendingRatingRetry(true);
        setSubmissionError('Đã lưu đánh giá. Phiên học sẽ được khôi phục khi bạn thử lại.');
      }
    } else {
      setHasPendingRatingRetry(true);
      setSubmissionError(confirmedMessage);
    }
    release();
  }, [userId, vocabularyId, onUpdateProgress, prepareRating, onCommitted, readPending, rememberCleared]);

  const submit = useCallback((isMastered: boolean, rating?: SrsRating) => run(isMastered, rating), [run]);
  const retry = useCallback(() => {
    const pending = pendingRef.current ?? (userId ? readPending(userId) : null);
    if (!pending || pending.vocabularyId !== vocabularyId) return Promise.resolve();
    return run(pending.isMastered, pending.rating, true);
  }, [run, userId, vocabularyId, readPending]);
  const dismissError = useCallback(() => setSubmissionError(null), []);

  return { isSubmitting, submissionError, hasPendingRatingRetry, isLocked, submit, retry, dismissError };
}
