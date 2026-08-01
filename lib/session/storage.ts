/**
 * Study Session Storage
 *
 * Phase 6: User-scoped session persistence in sessionStorage
 */

import type { StudySessionSnapshot } from './types';

const SESSION_STORAGE_KEY_PREFIX = 'vocab_study_session_v1';

/**
 * Get user-scoped session storage key
 */
function getSessionKey(userId: string): string {
  return `${SESSION_STORAGE_KEY_PREFIX}:${userId}`;
}

/**
 * Save study session snapshot to sessionStorage
 */
export function saveStudySession(snapshot: StudySessionSnapshot): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    const key = getSessionKey(snapshot.userId);
    sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('Failed to save study session:', err);
  }
}

/**
 * Load study session snapshot from sessionStorage
 */
export function loadStudySession(userId: string): StudySessionSnapshot | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;

  try {
    const key = getSessionKey(userId);
    const stored = sessionStorage.getItem(key);

    if (!stored) return null;

    const snapshot = JSON.parse(stored) as StudySessionSnapshot;

    // Validate snapshot structure
    if (
      snapshot.version !== 1 ||
      snapshot.userId !== userId ||
      !Array.isArray(snapshot.vocabularyIds) ||
      typeof snapshot.currentIndex !== 'number'
    ) {
      console.warn('Invalid session snapshot, clearing');
      clearStudySession(userId);
      return null;
    }

    return snapshot;
  } catch (err) {
    console.warn('Failed to load study session:', err);
    return null;
  }
}

/**
 * Clear study session snapshot from sessionStorage
 */
export function clearStudySession(userId: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    const key = getSessionKey(userId);
    sessionStorage.removeItem(key);
  } catch (err) {
    console.warn('Failed to clear study session:', err);
  }
}

/**
 * Clear all study sessions (for logout/user switch)
 */
export function clearAllStudySessions(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(SESSION_STORAGE_KEY_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn('Failed to clear all study sessions:', err);
  }
}
