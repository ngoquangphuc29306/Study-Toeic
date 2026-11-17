import type { FlashcardInitialFilter } from '../types';
import type { StudySessionSnapshot } from './types';

export function reconcileStudySession(input: {
  snapshot: StudySessionSnapshot | null;
  userId: string | null;
  topicId: string;
  status: FlashcardInitialFilter;
  availableVocabularyIds: ReadonlySet<string>;
}): { vocabularyIds: string[]; currentIndex: number } | null {
  const { snapshot, userId, topicId, status, availableVocabularyIds } = input;
  if (!snapshot || !userId || snapshot.version !== 1 || snapshot.userId !== userId ||
    snapshot.selectedTopicId !== topicId || snapshot.initialStatus !== status) return null;
  const vocabularyIds = snapshot.vocabularyIds.filter(id => availableVocabularyIds.has(id));
  if (vocabularyIds.length === 0) return null;
  return { vocabularyIds, currentIndex: Math.min(snapshot.currentIndex, vocabularyIds.length - 1) };
}
