import type { FlashcardInitialFilter, Vocabulary } from '../types';
import { isVocabularyDue } from '../../features/review-reminder/types';

export function selectActiveVocabulary(input: {
  vocabularies: readonly Vocabulary[];
  topicId: string;
  status: FlashcardInitialFilter;
  nowMs: number;
}): Vocabulary[] {
  const { vocabularies, topicId, status, nowMs } = input;
  const topicVocabs = topicId === 'all' ? vocabularies : vocabularies.filter(v => v.topic_id === topicId);

  if (status === 'new') return topicVocabs.filter(v => !v.status || v.status === 'new');
  if (status === 'mastered') return topicVocabs.filter(v => v.status === 'mastered');
  if (status === 'due') return topicVocabs.filter(v => isVocabularyDue(v, nowMs));
  if (status === 'learning') {
    return topicVocabs.filter(v => v.status === 'learning' && (!v.next_review_at || new Date(v.next_review_at).getTime() <= nowMs));
  }

  const dueWords: Vocabulary[] = [];
  const notDueWords: Vocabulary[] = [];
  const newWords: Vocabulary[] = [];
  const masteredWords: Vocabulary[] = [];
  topicVocabs.forEach(v => {
    if (v.status === 'learning') {
      (isVocabularyDue(v, nowMs) ? dueWords : notDueWords).push(v);
    } else if (v.status === 'mastered') {
      masteredWords.push(v);
    } else {
      newWords.push(v);
    }
  });

  const byNextReview = (a: Vocabulary, b: Vocabulary) => {
    const timeA = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
    const timeB = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
    return timeA - timeB;
  };
  dueWords.sort(byNextReview);
  notDueWords.sort(byNextReview);
  return [...dueWords, ...notDueWords, ...newWords, ...masteredWords];
}
