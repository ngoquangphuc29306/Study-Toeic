import type { StudyStats, Vocabulary } from '../types';
import type { DashboardMetrics } from '../../services/dashboardService';

export interface VocabularyProgressCounts {
  totalVocabulary: number;
  newVocabulary: number;
  learningVocabulary: number;
  masteredVocabulary: number;
  dueVocabulary: number;
  difficultVocabulary: number;
}

export function deriveStudyStats(vocabularies: Vocabulary[]): StudyStats {
  // Performance: Single pass instead of 3 separate .filter() calls
  let masteredCount = 0;
  let learningCount = 0;
  let newCount = 0;

  for (const vocabulary of vocabularies) {
    if (vocabulary.status === 'mastered') {
      masteredCount++;
    } else if (vocabulary.status === 'learning') {
      learningCount++;
    } else {
      newCount++;
    }
  }

  return {
    totalWords: vocabularies.length,
    masteredCount,
    learningCount,
    newCount,
    dailyStreak: 0,
    todayStudiedCount: 0,
  };
}

export function deriveVocabularyProgressCounts(
  vocabularies: Vocabulary[],
  referenceDate: Date = new Date()
): VocabularyProgressCounts {
  let dueVocabulary = 0;
  let difficultVocabulary = 0;

  for (const vocabulary of vocabularies) {
    if (
      vocabulary.status !== 'mastered' &&
      vocabulary.next_review_at &&
      new Date(vocabulary.next_review_at) <= referenceDate
    ) {
      dueVocabulary += 1;
    }

    if ((vocabulary.again_count ?? 0) >= 5 || vocabulary.is_difficult) {
      difficultVocabulary += 1;
    }
  }

  const masteredVocabulary = vocabularies.filter((vocabulary) => vocabulary.status === 'mastered').length;
  const learningVocabulary = vocabularies.filter((vocabulary) => vocabulary.status === 'learning').length;

  return {
    totalVocabulary: vocabularies.length,
    newVocabulary: vocabularies.length - masteredVocabulary - learningVocabulary,
    learningVocabulary,
    masteredVocabulary,
    dueVocabulary,
    difficultVocabulary,
  };
}

export function mergeVocabularyProgressIntoMetrics(
  metrics: DashboardMetrics,
  vocabularies: Vocabulary[],
  referenceDate: Date = new Date()
): DashboardMetrics {
  return {
    ...metrics,
    ...deriveVocabularyProgressCounts(vocabularies, referenceDate),
  };
}
