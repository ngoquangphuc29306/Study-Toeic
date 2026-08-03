import type { Vocabulary } from '../../lib/types';

export interface ReviewReminderState {
  dismissedAt: number;
  snoozeUntil: number;
  dueCountAtDismiss: number;
}

export type ReviewReminderAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type ReviewReminderDataStatus = 'idle' | 'loading' | 'success' | 'error';

export function isVocabularyDue(vocabulary: Vocabulary, now = Date.now()): boolean {
  if (vocabulary.status === 'mastered' || vocabulary.next_review_at == null) {
    return false;
  }

  const nextReviewAt = Date.parse(vocabulary.next_review_at);
  return Number.isFinite(nextReviewAt) && nextReviewAt <= now;
}

export function getDueVocabularyIds(vocabularies: Vocabulary[], now = Date.now()): string[] {
  return vocabularies.filter((vocabulary) => isVocabularyDue(vocabulary, now)).map((vocabulary) => vocabulary.id);
}
