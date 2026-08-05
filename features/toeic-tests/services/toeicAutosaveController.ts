'use client';

import { useEffect, useRef, useState } from 'react';
import type { SaveToeicAttemptAnswersInput, ToeicAttemptAnswerMutation } from '../attemptContracts';
import { batchToeicAnswerMutations } from './toeicAutosaveBatch';

export type ToeicAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface ToeicAutosaveState {
  status: ToeicAutosaveStatus;
  pendingCount: number;
  lastError: Error | null;
}

export interface ToeicAutosaveControllerOptions {
  attemptId: string;
  save: (input: SaveToeicAttemptAnswersInput) => Promise<unknown>;
  debounceMs?: number;
  createMutationKey?: () => string;
}

export interface ToeicAutosaveController {
  enqueue(mutation: ToeicAttemptAnswerMutation): void;
  flush(): Promise<void>;
  retry(): Promise<void>;
  getState(): ToeicAutosaveState;
  subscribe(listener: (state: ToeicAutosaveState) => void): () => void;
  dispose(): void;
}

function randomUuid(): string {
  return crypto.randomUUID();
}

export function createToeicAutosaveController({
  attemptId,
  save,
  debounceMs = 650,
  createMutationKey = randomUuid,
}: ToeicAutosaveControllerOptions): ToeicAutosaveController {
  const pending = new Map<string, ToeicAttemptAnswerMutation>();
  const listeners = new Set<(state: ToeicAutosaveState) => void>();
  let retryBatch: ReadonlyArray<ToeicAttemptAnswerMutation> | null = null;
  let retryMutationKey: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeRequest: Promise<void> | null = null;
  let disposed = false;
  let state: ToeicAutosaveState = { status: 'idle', pendingCount: 0, lastError: null };

  const emit = (next: ToeicAutosaveState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };
  const updatePendingState = (status: ToeicAutosaveStatus = 'pending') => {
    emit({ ...state, status, pendingCount: pending.size + (retryBatch?.length ?? 0), lastError: state.lastError });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void controller.flush(); }, debounceMs);
  };

  const controller: ToeicAutosaveController = {
    enqueue(mutation) {
      if (disposed) return;
      pending.set(mutation.questionId, mutation);
      // A newer local mutation starts a new logical batch for this question.
      if (retryBatch) {
        retryBatch = retryBatch.filter((item) => item.questionId !== mutation.questionId);
        if (retryBatch.length === 0) retryBatch = null;
        if (!retryBatch) retryMutationKey = null;
      }
      updatePendingState();
      schedule();
    },
    async flush() {
      if (disposed) return;
      if (activeRequest) {
        await activeRequest;
        if (!disposed && (pending.size > 0 || retryBatch)) await controller.flush();
        return;
      }
      if (pending.size === 0 && !retryBatch) return;

      const batches = retryBatch
        ? [retryBatch]
        : batchToeicAnswerMutations([...pending.values()]);
      const batch = batches[0];
      if (!retryBatch) batch.forEach((item) => pending.delete(item.questionId));
      const mutationKey = retryMutationKey ?? createMutationKey();
      retryBatch = null;
      retryMutationKey = null;
      emit({ ...state, status: 'saving', pendingCount: pending.size, lastError: null });

      activeRequest = (async () => {
        try {
          await save({ attemptId, answers: batch, mutationKey });
          if (disposed) return;
          if (pending.size > 0) {
            updatePendingState();
          } else {
            emit({ ...state, status: 'saved', pendingCount: 0, lastError: null });
          }
        } catch (error) {
          if (disposed) return;
          const newerQuestions = new Set(pending.keys());
          const retryableBatch = batch.filter((item) => !newerQuestions.has(item.questionId));
          retryBatch = retryableBatch.length > 0 ? retryableBatch : null;
          retryMutationKey = retryBatch ? mutationKey : null;
          emit({
            status: 'error',
            pendingCount: pending.size + (retryBatch?.length ?? 0),
            lastError: error instanceof Error ? error : new Error('Unable to save answers'),
          });
        } finally {
          activeRequest = null;
          if (!disposed && pending.size > 0) schedule();
        }
      })();
      return activeRequest;
    },
    async retry() {
      if (disposed) return;
      if (retryBatch) updatePendingState();
      await controller.flush();
    },
    getState() { return state; },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      listeners.clear();
    },
  };
  return controller;
}

export function useToeicAutosaveController(options: ToeicAutosaveControllerOptions) {
  const controllerRef = useRef<ToeicAutosaveController | null>(null);
  const [state, setState] = useState<ToeicAutosaveState>({ status: 'idle', pendingCount: 0, lastError: null });

  useEffect(() => {
    const controller = createToeicAutosaveController(options);
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setState);
    return () => {
      controller.dispose();
      controllerRef.current = null;
      unsubscribe();
    };
  }, [options]);

  return {
    ...state,
    enqueue: (mutation: ToeicAttemptAnswerMutation) => controllerRef.current?.enqueue(mutation),
    flush: () => controllerRef.current?.flush() ?? Promise.resolve(),
    retry: () => controllerRef.current?.retry() ?? Promise.resolve(),
  };
}
