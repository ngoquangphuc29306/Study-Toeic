/**
 * Study Session Types
 *
 * Phase 6: Session persistence and recovery
 */

export type StudyMode = 'new' | 'review';

export interface StudySessionSnapshot {
  version: 1;
  userId: string;
  mode: StudyMode;
  vocabularyIds: string[];
  currentIndex: number;
  selectedTopicId: string;
  initialStatus: 'all' | 'new' | 'learning' | 'mastered';
  startedAt: string;
  updatedAt: string;
}

export interface StudySessionState {
  snapshot: StudySessionSnapshot | null;
  isRestored: boolean;
}
