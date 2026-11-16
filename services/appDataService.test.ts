import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCollections: vi.fn(),
  getTopics: vi.fn(),
  getVocabByTopic: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getWeekActivity: vi.fn(),
}));

vi.mock('./vocabService', () => ({
  getCollections: mocks.getCollections,
  getTopics: mocks.getTopics,
  getVocabByTopic: mocks.getVocabByTopic,
}));

vi.mock('./dashboardService', () => ({
  getDashboardMetrics: mocks.getDashboardMetrics,
  getWeekActivity: mocks.getWeekActivity,
}));

vi.mock('../lib/supabase/authRetry', () => ({
  withSessionRetry: <T,>(operation: () => Promise<T>) => operation(),
}));

import { loadAppCoreData, loadAppDataSnapshot } from './appDataService';

describe('loadAppDataSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCollections.mockResolvedValue([{ id: 'collection-1', title: 'Work' }]);
    mocks.getTopics.mockResolvedValue([{ id: 'topic-1', collection_id: 'collection-1', title: 'Meetings' }]);
    mocks.getVocabByTopic.mockResolvedValue([{
      id: 'vocab-1',
      topic_id: 'topic-1',
      word: 'agenda',
      meaning: 'chương trình nghị sự',
      part_of_speech: 'noun',
      status: 'new',
    }]);
    mocks.getDashboardMetrics.mockResolvedValue({
      totalVocabulary: 1,
      newVocabulary: 1,
      learningVocabulary: 0,
      masteredVocabulary: 0,
      dueVocabulary: 0,
      reviewsToday: 0,
      uniqueVocabularyStudiedToday: 0,
      newVocabularyStudiedToday: 0,
      studyStreak: 0,
      difficultVocabulary: 0,
    });
    mocks.getWeekActivity.mockResolvedValue([{ date: '2026-08-04', count: 1 }]);
  });

  it('commits core data when a dashboard aggregate fails', async () => {
    mocks.getDashboardMetrics.mockRejectedValue(new Error('dashboard temporarily unavailable'));

    const snapshot = await loadAppDataSnapshot('user-1');

    expect(snapshot.collections).toHaveLength(1);
    expect(snapshot.topics).toHaveLength(1);
    expect(snapshot.vocabularies).toHaveLength(1);
    expect(snapshot.dashboardMetrics).toBeNull();
    expect(snapshot.weekActivity).toEqual([{ date: '2026-08-04', count: 1 }]);
    expect(snapshot.aggregateErrors.dashboardMetrics).toBeInstanceOf(Error);
  });

  it('loads composed core data without waiting for or requesting aggregates', async () => {
    mocks.getDashboardMetrics.mockReturnValue(new Promise(() => undefined));
    mocks.getWeekActivity.mockReturnValue(new Promise(() => undefined));

    const core = await loadAppCoreData('user-1');

    expect(core.collections[0]).toMatchObject({ id: 'collection-1', total_topics: 1, total_words: 1 });
    expect(core.vocabularies[0].word).toBe('agenda');
    expect(core.stats).toMatchObject({ totalWords: 1, newCount: 1 });
    expect(mocks.getDashboardMetrics).not.toHaveBeenCalled();
    expect(mocks.getWeekActivity).not.toHaveBeenCalled();
    expect(mocks.getCollections).toHaveBeenCalledWith('user-1');
    expect(mocks.getTopics).toHaveBeenCalledWith(undefined, 'user-1', true);
    expect(mocks.getVocabByTopic).toHaveBeenCalledWith('all', 'user-1');
  });

  it('rejects a failed core read', async () => {
    mocks.getVocabByTopic.mockRejectedValue(new Error('core vocabulary failure'));
    await expect(loadAppCoreData('user-1')).rejects.toThrow('core vocabulary failure');
  });

  it('still rejects when core data fails', async () => {
    mocks.getVocabByTopic.mockRejectedValue(new Error('core vocabulary failure'));

    await expect(loadAppDataSnapshot('user-1')).rejects.toThrow('core vocabulary failure');
    expect(mocks.getDashboardMetrics).not.toHaveBeenCalled();
  });
});
