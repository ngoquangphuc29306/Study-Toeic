'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Vocabulary } from '../../../lib/types';
import {
  getDueVocabularyIds,
  type ReviewReminderAuthStatus,
  type ReviewReminderDataStatus,
} from '../types';
import { readReviewReminderState, writeReviewReminderState } from '../storage/reviewReminderStorage';

const SNOOZE_DURATION_MS = 6 * 60 * 60 * 1000;

interface UseReviewReminderOptions {
  authStatus: ReviewReminderAuthStatus;
  dataStatus: ReviewReminderDataStatus;
  authUserId: string | null;
  dashboardDueCount: number | null;
  vocabularies: Vocabulary[];
  lastDataLoadedAt: number | null;
  lastStudySessionCompletedAt: number | null;
  isBlocked: boolean;
  onReviewNow: (dueVocabularyIds: string[]) => void;
  onNoDueVocabulary: () => void;
}

export function useReviewReminder({
  authStatus,
  dataStatus,
  authUserId,
  dashboardDueCount,
  vocabularies,
  lastDataLoadedAt,
  lastStudySessionCompletedAt,
  isBlocked,
  onReviewNow,
  onNoDueVocabulary,
}: UseReviewReminderOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  const lastPromptedDueCountRef = useRef<number | null>(null);
  const promptedUserIdRef = useRef<string | null>(null);
  const blockedDataLoadedAtRef = useRef<number | null>(null);

  const isRecentSession =
    lastStudySessionCompletedAt !== null &&
    (lastDataLoadedAt === null || lastDataLoadedAt <= lastStudySessionCompletedAt);

  const isEligible =
    authStatus === 'authenticated' &&
    dataStatus === 'success' &&
    authUserId !== null &&
    lastDataLoadedAt !== null &&
    dashboardDueCount !== null &&
    dashboardDueCount > 0 &&
    !isBlocked &&
    !isRecentSession;

  useEffect(() => {
    if (promptedUserIdRef.current !== authUserId) {
      promptedUserIdRef.current = authUserId;
      lastPromptedDueCountRef.current = null;
      blockedDataLoadedAtRef.current = null;
    }

    if (!isEligible || dashboardDueCount === null || !authUserId) {
      if (lastDataLoadedAt !== null && (isBlocked || isRecentSession)) {
        blockedDataLoadedAtRef.current = lastDataLoadedAt;
      }
      queueMicrotask(() => setIsOpen(false));
      return;
    }

    if (blockedDataLoadedAtRef.current === lastDataLoadedAt) return;

    const now = Date.now();
    const storedState = readReviewReminderState(authUserId, now);
    const storedSnoozeUntil = storedState?.snoozeUntil ?? 0;
    setSnoozeUntil(storedSnoozeUntil);

    if (storedSnoozeUntil > now) {
      queueMicrotask(() => setIsOpen(false));
      return;
    }

    if (lastPromptedDueCountRef.current === dashboardDueCount) return;

    lastPromptedDueCountRef.current = dashboardDueCount;
    setIsOpen(true);
  }, [
    authStatus,
    authUserId,
    dashboardDueCount,
    dataStatus,
    isEligible,
    isBlocked,
    lastDataLoadedAt,
    isRecentSession,
  ]);

  useEffect(() => {
    if (!snoozeUntil || snoozeUntil <= Date.now()) return;

    const timer = window.setTimeout(() => {
      setSnoozeUntil(0);
      lastPromptedDueCountRef.current = null;
    }, Math.max(0, snoozeUntil - Date.now()) + 50);

    return () => window.clearTimeout(timer);
  }, [snoozeUntil]);

  const handleSnooze = useCallback(() => {
    if (!authUserId) return;

    const dismissedAt = Date.now();
    const nextSnoozeUntil = dismissedAt + SNOOZE_DURATION_MS;
    writeReviewReminderState(authUserId, {
      dismissedAt,
      snoozeUntil: nextSnoozeUntil,
      dueCountAtDismiss: dashboardDueCount ?? 0,
    });
    setSnoozeUntil(nextSnoozeUntil);
    setIsOpen(false);
  }, [authUserId, dashboardDueCount]);

  const handleReviewNow = useCallback(() => {
    const dueVocabularyIds = getDueVocabularyIds(vocabularies);
    setIsOpen(false);

    if (dueVocabularyIds.length === 0) {
      onNoDueVocabulary();
      return;
    }

    onReviewNow(dueVocabularyIds);
  }, [onNoDueVocabulary, onReviewNow, vocabularies]);

  return {
    isOpen,
    dueCount: dashboardDueCount ?? 0,
    handleSnooze,
    handleReviewNow,
  };
}
