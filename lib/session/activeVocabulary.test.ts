import { describe, expect, it } from 'vitest';
import type { FlashcardInitialFilter, Vocabulary } from '../types';
import { isVocabularyDue } from '../../features/review-reminder/types';
import { selectActiveVocabulary } from './activeVocabulary';

const nowMs = Date.parse('2026-11-16T12:00:00.000Z');
const vocab = (id: string, status: Vocabulary['status'], next_review_at?: string | null, topic_id = 'a'): Vocabulary => ({
  id, topic_id, word: id, part_of_speech: 'noun', meaning: id, status, next_review_at,
});
const words = [
  vocab('future2', 'learning', '2026-11-18T12:00:00.000Z'),
  vocab('due2', 'learning', '2026-11-15T12:00:00.000Z'),
  vocab('new', 'new'),
  vocab('due1', 'learning', '2026-11-14T12:00:00.000Z'),
  vocab('mastered', 'mastered', '2026-11-14T12:00:00.000Z'),
  vocab('future1', 'learning', '2026-11-17T12:00:00.000Z'),
  vocab('blank', undefined),
  vocab('noDate', 'learning'),
  vocab('tie', 'learning', '2026-11-15T12:00:00.000Z'),
  vocab('other', 'new', undefined, 'b'),
];

// The pre-extraction component branch, kept local to characterize its ordering.
function reference(status: FlashcardInitialFilter, topicId: string, at: number): Vocabulary[] {
  const topic = topicId === 'all' ? words : words.filter(v => v.topic_id === topicId);
  if (status === 'new') return topic.filter(v => !v.status || v.status === 'new');
  if (status === 'mastered') return topic.filter(v => v.status === 'mastered');
  if (status === 'due') return topic.filter(v => isVocabularyDue(v, at));
  if (status === 'learning') return topic.filter(v => v.status === 'learning' && (!v.next_review_at || new Date(v.next_review_at).getTime() <= at));
  const due: Vocabulary[] = [], future: Vocabulary[] = [], fresh: Vocabulary[] = [], mastered: Vocabulary[] = [];
  topic.forEach(v => {
    if (v.status === 'learning') (isVocabularyDue(v, at) ? due : future).push(v);
    else if (v.status === 'mastered') mastered.push(v);
    else fresh.push(v);
  });
  const byDate = (a: Vocabulary, b: Vocabulary) => (a.next_review_at ? new Date(a.next_review_at).getTime() : 0) - (b.next_review_at ? new Date(b.next_review_at).getTime() : 0);
  due.sort(byDate); future.sort(byDate);
  return [...due, ...future, ...fresh, ...mastered];
}

describe('selectActiveVocabulary', () => {
  it.each([
    ['new', ['new', 'blank']],
    ['mastered', ['mastered']],
    ['due', ['due2', 'due1', 'tie']],
    ['learning', ['due2', 'due1', 'noDate', 'tie']],
    ['all', ['due1', 'due2', 'tie', 'noDate', 'future1', 'future2', 'new', 'blank', 'mastered']],
  ] as const)('preserves %s selection and order', (status, expected) => {
    const before = [...words];
    const result = selectActiveVocabulary({ vocabularies: words, topicId: 'a', status, nowMs });
    expect(result.map(v => v.id)).toEqual(expected);
    expect(result).toEqual(reference(status, 'a', nowMs));
    expect(words).toEqual(before);
  });

  it('uses the supplied topic and timestamp, including the due boundary', () => {
    expect(selectActiveVocabulary({ vocabularies: words, topicId: 'b', status: 'all', nowMs }).map(v => v.id)).toEqual(['other']);
    expect(selectActiveVocabulary({ vocabularies: words, topicId: 'all', status: 'new', nowMs }).map(v => v.id)).toEqual(['new', 'blank', 'other']);
    const at = Date.parse('2026-11-17T12:00:00.000Z');
    expect(selectActiveVocabulary({ vocabularies: words, topicId: 'a', status: 'due', nowMs: at }).map(v => v.id)).toEqual(['due2', 'due1', 'future1', 'tie']);
    expect(selectActiveVocabulary({ vocabularies: words, topicId: 'a', status: 'due', nowMs: at })).toEqual(reference('due', 'a', at));
  });
});
