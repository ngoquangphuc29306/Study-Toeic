import type { Collection, Topic, Vocabulary } from '../types';

export function composeCollectionStats(
  collections: Collection[],
  topics: Topic[],
  vocabularies: Vocabulary[],
): Collection[] {
  const wordCountsByTopic = new Map<string, number>();
  for (const vocabulary of vocabularies) {
    wordCountsByTopic.set(vocabulary.topic_id, (wordCountsByTopic.get(vocabulary.topic_id) ?? 0) + 1);
  }

  const topicIdsByCollection = new Map<string, Set<string>>();
  for (const topic of topics) {
    if (topic.collection_id === undefined) continue;

    let topicIds = topicIdsByCollection.get(topic.collection_id);
    if (!topicIds) {
      topicIds = new Set<string>();
      topicIdsByCollection.set(topic.collection_id, topicIds);
    }
    topicIds.add(topic.id);
  }

  return collections.map((collection) => {
    const topicIds = topicIdsByCollection.get(collection.id);
    let totalWords = 0;
    if (topicIds) {
      for (const topicId of topicIds) {
        totalWords += wordCountsByTopic.get(topicId) ?? 0;
      }
    }

    return { ...collection, total_topics: topicIds?.size ?? 0, total_words: totalWords };
  });
}
