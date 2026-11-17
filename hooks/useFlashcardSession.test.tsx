// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from '../features/synonym-practice/components/test-utils/dom';
import { loadStudySession, saveStudySession } from '../lib/session/storage';
import type { Vocabulary } from '../lib/types';
import { useFlashcardSession, type FlashcardSessionController } from './useFlashcardSession';

const words: Vocabulary[] = ['a', 'b', 'c'].map((id, index) => ({
  id, word: id, meaning: id, topic_id: index === 2 ? 'other' : 'topic', part_of_speech: 'noun',
}));
let session: FlashcardSessionController;
let dom: Awaited<ReturnType<typeof mount>>;
const completed = vi.fn();
interface HarnessProps { topic: string; status: 'new' | 'all'; vocabularies: Vocabulary[]; userId: string | null }
function Harness({ topic, status, vocabularies, userId }: HarnessProps) {
  const current = useFlashcardSession({ userId, vocabularies, selectedTopicId: topic, initialStatus: status, onCompleted: completed });
  useEffect(() => { session = current; }, [current]);
  return <span>{current.currentVocabulary?.id}</span>;
}
const view = (topic = 'all', status: HarnessProps['status'] = 'new', vocabularies = words, userId: string | null = 'user') =>
  <Harness topic={topic} status={status} vocabularies={vocabularies} userId={userId} />;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); completed.mockReset();
  dom = await mount(view());
});
afterEach(async () => { await dom.unmount(); vi.unstubAllGlobals(); });

it('restores a v1 queue and clamps its index after deleted words', async () => {
  await dom.unmount();
  saveStudySession({ version: 1, userId: 'user', mode: 'new', vocabularyIds: ['deleted', 'b', 'a'], currentIndex: 99,
    selectedTopicId: 'all', initialStatus: 'new', startedAt: 'old', updatedAt: 'old' });
  dom = await mount(view());
  expect(session.activeVocabulary.map(word => word.id)).toEqual(['b', 'a']);
  expect(session.currentIndex).toBe(1);
  expect(session.currentVocabulary?.id).toBe('a');
});

it('commits a prepared action once, saves the exact next queue, and completes after the final card', async () => {
  const first = session.prepareRating('good', false)!;
  expect(loadStudySession('user')).toBeNull();
  await act(async () => { expect(first.commit()).toBe(true); expect(first.commit()).toBe(false); });
  expect(session.currentVocabulary?.id).toBe('b');
  expect(session.sessionStats.needsReview).toBe(1);
  expect(loadStudySession('user')).toMatchObject({ version: 1, vocabularyIds: ['a', 'b', 'c'], currentIndex: 1, initialStatus: 'new' });
  await act(async () => { session.prepareRating('good', false)!.commit(); });
  await act(async () => { expect(session.prepareRating('mastered', true)!.commit()).toBe(true); });
  expect(session.isCompleted).toBe(true);
  expect(session.sessionStats.mastered).toBe(1);
  expect(loadStudySession('user')).toBeNull();
  expect(completed).toHaveBeenCalledTimes(1);
});

it('rejects old prepared actions after a same-card context change and A-B-A reset', async () => {
  const action = session.prepareRating('good', false)!;
  await dom.render(view('topic'));
  await dom.render(view('all'));
  expect(session.currentVocabulary?.id).toBe('a');
  await act(async () => { expect(action.isCurrent()).toBe(false); expect(action.commit()).toBe(false); });
  expect(session.sessionStats.needsReview).toBe(0);
  expect(loadStudySession('user')).toBeNull();
});

it('rejects prepared actions after user, current-card, and unmount changes', async () => {
  const oldUser = session.prepareRating('good', false)!;
  await dom.render(view('all', 'new', words, 'another'));
  expect(oldUser.commit()).toBe(false);
  const oldCard = session.prepareRating('good', false)!;
  await dom.render(view('all', 'new', words.slice(1), 'another'));
  expect(session.currentVocabulary?.id).toBe('b');
  expect(oldCard.commit()).toBe(false);
  const unmounted = session.prepareRating('good', false)!;
  await dom.unmount();
  expect(unmounted.commit()).toBe(false);
  dom = await mount(view());
});

it('resets mode, stats, queue, and snapshot on restart and manual filters', async () => {
  await act(async () => { session.setSubMode('quiz'); session.prepareRating('good', false)!.commit(); });
  expect(loadStudySession('user')).not.toBeNull();
  await act(async () => { session.restart(); });
  expect(session.subMode).toBe('flashcard');
  expect(session.sessionStats.needsReview).toBe(0);
  expect(session.currentIndex).toBe(0);
  expect(loadStudySession('user')).toBeNull();
  await act(async () => { session.selectTopic('topic'); session.selectStatus('all'); });
  expect(session.filterTopic).toBe('topic');
  expect(session.filterStatus).toBe('all');
  expect(session.activeVocabulary.map(v => v.id)).toEqual(['a', 'b']);
});

it('keeps fixed due-time and adjusts the index when the final visible word is deleted', async () => {
  await act(async () => { session.prepareRating('good', false)!.commit(); });
  await act(async () => { session.prepareRating('good', false)!.commit(); });
  const now = session.nowMs;
  await act(async () => { session.removeCurrentAfterDelete(); });
  expect(session.nowMs).toBe(now);
  expect(session.currentIndex).toBe(1);
  expect(session.currentVocabulary?.id).toBe('b');
});

it('uses the rendered safe index when the available list shrinks after queue restore', async () => {
  await act(async () => { session.prepareRating('good', false)!.commit(); });
  await act(async () => { session.prepareRating('good', false)!.commit(); });
  expect(session.currentVocabulary?.id).toBe('c');
  await dom.render(view('all', 'new', words.slice(0, 2)));
  expect(session.safeIndex).toBe(1);
  expect(session.currentVocabulary?.id).toBe('b');
  const action = session.prepareRating('good', false)!;
  expect(action.isComplete).toBe(false);
  await act(async () => { action.commit(); });
  expect(session.isCompleted).toBe(false);
  expect(loadStudySession('user')?.currentIndex).toBe(2);
});

it('offers all words from an empty new filter and keeps topic vocabulary counts', async () => {
  const mastered = words.map(word => ({ ...word, status: 'mastered' as const }));
  await dom.render(view('topic', 'new', mastered));
  expect(session.activeVocabulary).toHaveLength(0);
  expect(session.topicVocabulary).toHaveLength(2);
  await act(async () => { session.selectStatus('all'); });
  expect(session.activeVocabulary.map(word => word.id)).toEqual(['a', 'b']);
  expect(session.topicVocabulary).toHaveLength(2);
});

it('initializes an unauthenticated queue without reading or writing a user snapshot', async () => {
  await dom.render(view('all', 'new', words, null));
  expect(session.isSessionRestored).toBe(true);
  expect(session.studyQueue).toEqual(['a', 'b', 'c']);
  expect(session.currentVocabulary?.id).toBe('a');
  expect(session.prepareRating('good', false)).toBeNull();
  expect(loadStudySession('user')).toBeNull();
});

it('restores once and commits once under StrictMode effect replay', async () => {
  await dom.unmount();
  dom = await mount(<StrictMode>{view()}</StrictMode>);
  expect(session.studyQueue).toEqual(['a', 'b', 'c']);
  const action = session.prepareRating('good', false)!;
  await act(async () => { expect(action.commit()).toBe(true); expect(action.commit()).toBe(false); });
  expect(session.currentVocabulary?.id).toBe('b');
  expect(session.sessionStats.needsReview).toBe(1);
  expect(loadStudySession('user')?.currentIndex).toBe(1);
});
