import type { Collection, Topic, Vocabulary } from '../../../lib/types';
import {
  buildMatchingQuestion,
  buildMultipleChoiceQuestion,
  buildSelectAllQuestion,
  mapVocabularyToSynonymItems,
} from './synonymPracticeService';

const vocabulary = (id: string, word: string, synonyms: string): Vocabulary => ({
  id,
  topic_id: 'topic-1',
  word,
  meaning: `${word} meaning`,
  part_of_speech: 'noun',
  synonyms,
});

const topics: Topic[] = [{ id: 'topic-1', title: 'Topic', description: '', icon: 'BookOpen' }];
const collections: Collection[] = [{ id: 'collection-1', title: 'Collection' }];

describe('synonym question generation', () => {
  test('is deterministic and does not mutate input', () => {
    const source = [
      vocabulary('1', 'rapid', 'fast, quick'),
      vocabulary('2', 'large', 'big, huge'),
      vocabulary('3', 'smart', 'clever, bright'),
      vocabulary('4', 'safe', 'secure, protected'),
    ];
    const items = mapVocabularyToSynonymItems(source, topics, collections);
    const original = JSON.stringify(items);

    expect(buildMultipleChoiceQuestion(items[0], items)).toEqual(buildMultipleChoiceQuestion(items[0], items));
    expect(buildMatchingQuestion(items, 4)).toEqual(buildMatchingQuestion(items, 4));
    expect(buildSelectAllQuestion(items[0], items)).toEqual(buildSelectAllQuestion(items[0], items));
    expect(JSON.stringify(items)).toBe(original);
  });

  test('does not generate duplicate normalized labels and handles a small pool', () => {
    const source = [vocabulary('1', 'rapid', 'fast, FAST'), vocabulary('2', 'large', 'big')];
    const items = mapVocabularyToSynonymItems(source, topics, collections);

    expect(buildMultipleChoiceQuestion(items[0], items)).toBeNull();
    expect(buildMatchingQuestion(items, 4)?.pairs.length).toBe(2);
  });
});
