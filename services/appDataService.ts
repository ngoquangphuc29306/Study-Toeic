import type { Collection, StudyStats, Topic, Vocabulary } from '../lib/types';
import { deriveStudyStats } from '../lib/srs/deriveProgress';
import { getCollections, getTopics, getVocabByTopic } from './vocabService';
import { getDashboardMetrics, getWeekActivity, type DashboardMetrics } from './dashboardService';

export interface AppDataSnapshot {
  collections: Collection[];
  topics: Topic[];
  vocabularies: Vocabulary[];
  stats: StudyStats;
  dashboardMetrics: DashboardMetrics;
  weekActivity: Array<{ date: string; count: number }>;
}

/**
 * Loads the parent-owned app snapshot once. Consumers should render this
 * snapshot instead of fetching the same resources independently.
 */
export async function loadAppDataSnapshot(authenticatedUserId: string): Promise<AppDataSnapshot> {
  const [collections, topics, vocabularies, dashboardMetrics, weekActivity] = await Promise.all([
    getCollections(authenticatedUserId),
    getTopics(undefined, authenticatedUserId),
    getVocabByTopic('all', authenticatedUserId),
    getDashboardMetrics(authenticatedUserId),
    getWeekActivity(authenticatedUserId),
  ]);

  const composedCollections = collections.map((collection) => {
    const collectionTopicIds = new Set(
      topics
        .filter((topic) => topic.collection_id === collection.id)
        .map((topic) => topic.id)
    );

    return {
      ...collection,
      total_topics: collectionTopicIds.size,
      total_words: vocabularies.filter((vocabulary) => collectionTopicIds.has(vocabulary.topic_id)).length,
    };
  });

  return {
    collections: composedCollections,
    topics,
    vocabularies,
    stats: deriveStudyStats(vocabularies),
    dashboardMetrics,
    weekActivity,
  };
}
