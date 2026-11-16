import type { Collection, StudyStats, Topic, Vocabulary } from '../lib/types';
import { deriveStudyStats } from '../lib/srs/deriveProgress';
import { composeCollectionStats } from '../lib/data/collectionStats';
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

export interface AppCoreData {
  collections: Collection[];
  topics: Topic[];
  vocabularies: Vocabulary[];
  stats: StudyStats;
}

export interface AppDataSnapshot extends AppCoreData, AppDerivedData {}

/** Core readiness is independent of review-log aggregates. */
export async function loadAppCoreData(authenticatedUserId: string): Promise<AppCoreData> {
  const [collections, topics, vocabularies] = await Promise.all([
    withSessionRetry(() => getCollections(authenticatedUserId)),
    withSessionRetry(() => getTopics(undefined, authenticatedUserId, true)),
    withSessionRetry(() => getVocabByTopic('all', authenticatedUserId)),
  ]);

  return {
    collections: composeCollectionStats(collections, topics, vocabularies),
    topics,
    vocabularies,
    stats: deriveStudyStats(vocabularies),
  };
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
  // Performance: Run all 4 fetches in parallel instead of fetching derived data
  // sequentially after the core snapshot. This eliminates a ~1-2s waterfall.
  const [collections, topics, vocabularies, derived] = await Promise.all([
    withSessionRetry(() => getCollections(authenticatedUserId)),
    withSessionRetry(() => getTopics(undefined, authenticatedUserId, true)),
    withSessionRetry(() => getVocabByTopic('all', authenticatedUserId)),
    loadAppDerivedData(authenticatedUserId),
  ]);

  const composedCollections = composeCollectionStats(collections, topics, vocabularies);

  return {
    collections: composedCollections,
    topics,
    vocabularies,
    stats: deriveStudyStats(vocabularies),
    ...derived,
  };
}
