import { describe, expect, it, vi } from 'vitest';
import type { Collection, Topic, Vocabulary } from '@/lib/types';
import { createToeicVocabularyAdapter } from './toeicVocabularyAdapter';

const collectionId = '11111111-1111-4111-8111-111111111111';
const sectionId = '22222222-2222-4222-8222-222222222222';
const collection: Collection = { id: collectionId, title: 'TOEIC' };
const topic: Topic = { id: sectionId, collection_id: collectionId, title: 'Part 5', description: '', icon: 'BookOpen' };
const vocabulary: Vocabulary = { id: '33333333-3333-4333-8333-333333333333', topic_id: sectionId, word: 'approve', part_of_speech: 'verb', meaning: 'phê duyệt' };

function adapter(overrides: Partial<{ vocab: Vocabulary[]; add: (input: Omit<Vocabulary, 'id'>) => Promise<Vocabulary> }> = {}) {
  return createToeicVocabularyAdapter({
    getCollections: async () => [collection],
    getTopics: async () => [topic],
    getVocabByTopic: async () => overrides.vocab ?? [],
    addVocabulary: overrides.add ?? (async () => vocabulary),
  });
}

describe('TOEIC vocabulary adapter', () => {
  it('returns duplicate instead of silently inserting the same normalized word', async () => {
    const add = vi.fn(async () => vocabulary);
    const result = await adapter({ vocab: [vocabulary], add }).saveVocabulary({ word: ' APPROVE ', meaningVi: 'phê duyệt', partOfSpeech: 'verb', collectionId, sectionId });
    expect(result.status).toBe('duplicate');
    expect(add).not.toHaveBeenCalled();
  });

  it('uses the existing vocabulary service shape and does not create containers', async () => {
    const add = vi.fn(async (input: Omit<Vocabulary, 'id'>) => ({ ...vocabulary, ...input }));
    const result = await adapter({ add }).saveVocabulary({ word: 'listen', meaningVi: 'lắng nghe', partOfSpeech: 'verb', collectionId, sectionId, source: 'TOEIC Part 5' });
    expect(result.status).toBe('created');
    expect(add).toHaveBeenCalledWith({ topic_id: sectionId, word: 'listen', meaning: 'lắng nghe', part_of_speech: 'verb' });
  });

  it('rejects a section outside the chosen collection', async () => {
    const foreignTopic: Topic = { ...topic, collection_id: '44444444-4444-4444-8444-444444444444' };
    const value = createToeicVocabularyAdapter({ getCollections: async () => [collection], getTopics: async () => [foreignTopic], getVocabByTopic: async () => [], addVocabulary: async () => vocabulary });
    await expect(value.saveVocabulary({ word: 'listen', meaningVi: 'nghe', partOfSpeech: 'verb', collectionId, sectionId })).rejects.toMatchObject({ code: 'SECTION_NOT_FOUND' });
  });
});
