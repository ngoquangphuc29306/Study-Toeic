import { describe, expect, it } from 'vitest';
import type { Collection, Topic, Vocabulary } from '../types';
import { composeCollectionStats } from './collectionStats';

function topic(id: string, collectionId?: string): Topic {
  return { id, collection_id: collectionId, title: id, description: '', icon: 'BookOpen' };
}

function vocabulary(id: string, topicId: string): Vocabulary {
  return { id, topic_id: topicId, word: id, meaning: id, part_of_speech: 'noun' };
}

// Captured from services/appDataService.ts at baseline 5f9a279d.
function originalCollectionStats(
  collections: Collection[],
  topics: Topic[],
  vocabularies: Vocabulary[],
): Collection[] {
  return collections.map((collection) => {
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
}

function seededFixture(seed: number, vocabularyCount: number) {
  let state = seed >>> 0;
  const next = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  const collectionCount = next(30);
  const collections: Collection[] = Array.from({ length: collectionCount }, (_, index) => ({
    id: `collection-${next(Math.max(1, collectionCount))}`,
    title: `Collection ${index}`,
    description: `Seed ${seed}`,
    total_topics: 999,
    total_words: 999,
  }));
  const topics: Topic[] = Array.from({ length: next(120) }, () => topic(
    `topic-${next(40)}`,
    next(5) === 0 ? undefined : `collection-${next(collectionCount + 5)}`,
  ));
  const vocabularies: Vocabulary[] = Array.from({ length: vocabularyCount }, () => vocabulary(
    `vocabulary-${next(Math.max(1, vocabularyCount / 2))}`,
    `topic-${next(50)}`,
  ));
  return { collections, topics, vocabularies };
}

describe('composeCollectionStats', () => {
  it('returns an empty array for empty inputs', () => {
    expect(composeCollectionStats([], [], [])).toEqual([]);
  });

  it('returns no collections when only topics and vocabularies exist', () => {
    expect(composeCollectionStats([], [topic('t', 'missing')], [vocabulary('v', 't')])).toEqual([]);
  });

  it('overwrites stale counts with zero when topics are missing', () => {
    expect(composeCollectionStats(
      [{ id: 'c', title: 'Empty', total_topics: 10, total_words: 20 }],
      [],
      [vocabulary('v', 'missing')],
    )).toEqual([{ id: 'c', title: 'Empty', total_topics: 0, total_words: 0 }]);
  });

  it('counts topics even when no vocabulary exists', () => {
    expect(composeCollectionStats(
      [{ id: 'c', title: 'Work' }], [topic('t1', 'c'), topic('t2', 'c')], [],
    )).toEqual([{ id: 'c', title: 'Work', total_topics: 2, total_words: 0 }]);
  });

  it('ignores unassigned topics, unknown collections and orphan vocabulary', () => {
    expect(composeCollectionStats(
      [{ id: 'c', title: 'Work' }],
      [topic('owned', 'c'), topic('unassigned'), topic('unknown', 'missing')],
      [vocabulary('v1', 'owned'), vocabulary('v2', 'unassigned'),
        vocabulary('v3', 'unknown'), vocabulary('v4', 'orphan')],
    )).toEqual([{ id: 'c', title: 'Work', total_topics: 1, total_words: 1 }]);
  });

  it('counts duplicate topic IDs once within a collection', () => {
    expect(composeCollectionStats(
      [{ id: 'c', title: 'Work' }], [topic('t', 'c'), topic('t', 'c')],
      [vocabulary('v1', 't'), vocabulary('v2', 't')],
    )).toEqual([{ id: 'c', title: 'Work', total_topics: 1, total_words: 2 }]);
  });

  it('counts a shared topic ID in each collection that references it', () => {
    expect(composeCollectionStats(
      [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
      [topic('shared', 'a'), topic('shared', 'a'), topic('shared', 'b'), topic('extra', 'b')],
      [vocabulary('v1', 'shared'), vocabulary('v2', 'shared'), vocabulary('v3', 'extra')],
    )).toEqual([
      { id: 'a', title: 'A', total_topics: 1, total_words: 2 },
      { id: 'b', title: 'B', total_topics: 2, total_words: 3 },
    ]);
  });

  it('counts every vocabulary row including duplicate IDs and repeated objects', () => {
    const repeated = vocabulary('duplicate', 't');
    expect(composeCollectionStats(
      [{ id: 'c', title: 'Work' }], [topic('t', 'c')],
      [repeated, repeated, vocabulary('duplicate', 't')],
    )).toEqual([{ id: 'c', title: 'Work', total_topics: 1, total_words: 3 }]);
  });

  it('preserves collection order, duplicate collection rows and metadata', () => {
    const collections: Collection[] = [
      { id: 'b', title: 'First', description: 'Keep me', icon: 'Folder',
        created_at: '2026-01-01', updated_at: '2026-01-02', total_topics: 50, total_words: 60 },
      { id: 'a', title: 'Second' },
      { id: 'b', title: 'Duplicate ID' },
    ];
    expect(composeCollectionStats(collections, [topic('t', 'b')], [vocabulary('v', 't')])).toEqual([
      { ...collections[0], total_topics: 1, total_words: 1 },
      { id: 'a', title: 'Second', total_topics: 0, total_words: 0 },
      { id: 'b', title: 'Duplicate ID', total_topics: 1, total_words: 1 },
    ]);
  });

  it('matches empty-string IDs and treats object property names as ordinary IDs', () => {
    expect(composeCollectionStats(
      [{ id: '', title: 'Empty ID' }, { id: '__proto__', title: 'Special ID' }],
      [topic('', ''), topic('constructor', '__proto__'), topic('unassigned')],
      [vocabulary('v1', ''), vocabulary('v2', 'constructor'), vocabulary('v3', 'unassigned')],
    )).toEqual([
      { id: '', title: 'Empty ID', total_topics: 1, total_words: 1 },
      { id: '__proto__', title: 'Special ID', total_topics: 1, total_words: 1 },
    ]);
  });

  it('does not mutate input arrays or records and returns fresh collection records', () => {
    const collections: Collection[] = [{ id: 'c', title: 'Work', total_topics: 8, total_words: 9 }];
    const topics = [topic('t', 'c')];
    const vocabularies = [vocabulary('v', 't')];
    const before = structuredClone({ collections, topics, vocabularies });
    for (const records of [collections, topics, vocabularies]) {
      records.forEach((record) => Object.freeze(record));
      Object.freeze(records);
    }

    const result = composeCollectionStats(collections, topics, vocabularies);

    expect({ collections, topics, vocabularies }).toEqual(before);
    expect(result).not.toBe(collections);
    expect(result[0]).not.toBe(collections[0]);
    expect(result).toEqual([{ id: 'c', title: 'Work', total_topics: 1, total_words: 1 }]);
  });

  const cases = Array.from({ length: 12 }, (_, index) => index + 1).flatMap((seed) =>
    [0, 100, 1000, 5000].map((vocabularyCount) => ({ seed, vocabularyCount }))
  );

  it.each(cases)('matches the original algorithm for seed $seed with $vocabularyCount vocabulary rows', ({
    seed, vocabularyCount,
  }) => {
    const { collections, topics, vocabularies } = seededFixture(seed, vocabularyCount);
    expect(composeCollectionStats(collections, topics, vocabularies)).toEqual(
      originalCollectionStats(collections, topics, vocabularies),
    );
  });
});
