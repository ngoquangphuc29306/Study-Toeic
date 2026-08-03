import type { ReviewReminderState } from '../types';

const STORAGE_KEY_PREFIX = 'easytoeic_review_reminder:';
const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getReviewReminderStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isValidState(value: unknown): value is ReviewReminderState {
  if (!value || typeof value !== 'object') return false;

  const state = value as Partial<ReviewReminderState>;
  return (
    typeof state.dismissedAt === 'number' &&
    Number.isFinite(state.dismissedAt) &&
    typeof state.snoozeUntil === 'number' &&
    Number.isFinite(state.snoozeUntil) &&
    typeof state.dueCountAtDismiss === 'number' &&
    Number.isFinite(state.dueCountAtDismiss) &&
    state.dueCountAtDismiss >= 0
  );
}

export function readReviewReminderState(userId: string, now = Date.now()): ReviewReminderState | null {
  if (typeof window === 'undefined' || !userId) return null;

  try {
    const key = getReviewReminderStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (now - parsed.dismissedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeReviewReminderState(userId: string, state: ReviewReminderState): void {
  if (typeof window === 'undefined' || !userId) return;

  try {
    window.localStorage.setItem(getReviewReminderStorageKey(userId), JSON.stringify(state));
  } catch {
    // Storage can be unavailable or full. The reminder remains usable in memory.
  }
}
