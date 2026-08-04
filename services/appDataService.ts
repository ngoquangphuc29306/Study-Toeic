import type { Collection, StudyStats, Topic, Vocabulary } from '../lib/types';
import { deriveStudyStats } from '../lib/srs/deriveProgress';
import { getCollections, getTopics, getVocabByTopic } from './vocabService';
import { getDashboardMetrics, getWeekActivity, type DashboardMetrics } from './dashboardService';
import { withSessionRetry } from '../lib/supabase/authRetry';

export interface AppDerivedData {
  dashboardMetrics: DashboardMetrics | null;
  weekActivity: Array<{ date: string; count: number }> | null;
  aggregateErrors: {
    dashboardMetrics?: unknown;
    weekActivity?: unknown;
  };
}

export interface AppDataSnapshot {
  collections: Collection[];
  topics: Topic[];
  vocabularies: Vocabulary[];
  stats: StudyStats;
  dashboardMetrics: DashboardMetrics | null;
  weekActivity: Array<{ date: string; count: number }> | null;
  aggregateErrors: AppDerivedData['aggregateErrors'];
}

/**
 * Aggregates are useful but non-critical. Their failure must not prevent the
 * core vocabulary snapshot from reaching the page.
 */
export async function loadAppDerivedData(authenticatedUserId: string): Promise<AppDerivedData> {
  const [metricsResult, weekResult] = await Promise.allSettled([
    withSessionRetry(() => getDashboardMetrics(authenticatedUserId)),
    withSessionRetry(() => getWeekActivity(authenticatedUserId)),
  ]);

  return {
    dashboardMetrics: metricsResult.status === 'fulfilled' ? metricsResult.value : null,
    weekActivity: weekResult.status === 'fulfilled' ? weekResult.value : null,
    aggregateErrors: {
      ...(metricsResult.status === 'rejected' ? { dashboardMetrics: metricsResult.reason } : {}),
      ...(weekResult.status === 'rejected' ? { weekActivity: weekResult.reason } : {}),
    },
  };
}

/**
 * Loads the parent-owned app snapshot once. Consumers should render this
 * snapshot instead of fetching the same resources independently.
 */
export async function loadAppDataSnapshot(authenticatedUserId: string): Promise<AppDataSnapshot> {
  const [collections, topics, vocabularies] = await Promise.all([
    withSessionRetry(() => getCollections(authenticatedUserId)),
    withSessionRetry(() => getTopics(undefined, authenticatedUserId)),
    withSessionRetry(() => getVocabByTopic('all', authenticatedUserId)),
  ]);
  const derived = await loadAppDerivedData(authenticatedUserId);

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
    ...derived,
  };
}
