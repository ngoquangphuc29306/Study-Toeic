'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlashcardInitialFilter, Vocabulary } from '../lib/types';
import type { SrsRating } from '../services/vocabService';
import { selectActiveVocabulary } from '../lib/session/activeVocabulary';
import { applyRatingToQueue } from '../lib/session/queueTransition';
import { reconcileStudySession } from '../lib/session/restoreStudySession';
import { clearStudySession, loadStudySession, saveStudySession } from '../lib/session/storage';
import type { StudySessionSnapshot } from '../lib/session/types';

export type StudySubMode = 'flashcard' | 'quiz' | 'typing' | 'pronounce';
export interface SessionStats { mastered: number; learningVocabularyIds: string[]; needsReview: number }
interface SessionState {
  filterTopic: string;
  filterStatus: FlashcardInitialFilter;
  studyQueue: string[];
  currentIndex: number;
  isSessionRestored: boolean;
  isCompleted: boolean;
  sessionStats: SessionStats;
  subMode: StudySubMode;
}
interface Options {
  userId: string | null;
  vocabularies: Vocabulary[];
  selectedTopicId: string;
  initialStatus?: FlashcardInitialFilter;
  onCompleted?: () => void;
}
export interface PreparedRating {
  isCurrent(): boolean;
  commit(): boolean;
  isComplete: boolean;
}
export interface FlashcardSessionController extends SessionState {
  nowMs: number;
  topicVocabulary: Vocabulary[];
  activeVocabulary: Vocabulary[];
  safeIndex: number;
  currentVocabulary: Vocabulary | undefined;
  prepareRating(rating: SrsRating, isMastered: boolean): PreparedRating | null;
  selectTopic(topicId: string): void;
  selectStatus(status: FlashcardInitialFilter): void;
  setSubMode(mode: StudySubMode): void;
  advanceMode(): void;
  removeCurrentAfterDelete(): void;
  restart(): void;
}
const emptyStats = (): SessionStats => ({ mastered: 0, learningVocabularyIds: [], needsReview: 0 });
const initialState = (topic: string, status: FlashcardInitialFilter): SessionState => ({
  filterTopic: topic || 'all', filterStatus: status || 'new', studyQueue: [], currentIndex: 0,
  isSessionRestored: false, isCompleted: false, sessionStats: emptyStats(), subMode: 'flashcard',
});

export function useFlashcardSession(options: Options): FlashcardSessionController {
  const { userId, vocabularies, selectedTopicId, initialStatus, onCompleted } = options;
  const [state, setState] = useState(() => initialState(selectedTopicId, initialStatus || 'new'));
  const stateRef = useRef(state);
  const generationRef = useRef(0);
  const [nowMs] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const contextRef = useRef({ userId, selectedTopicId, initialStatus });
  const latestRef = useRef({ userId, onCompleted, currentId: '' as string | undefined });
  useEffect(() => { stateRef.current = state; }, [state]);

  const update = useCallback((next: SessionState) => { stateRef.current = next; setState(next); }, []);
  const reset = useCallback((topic: string, status: FlashcardInitialFilter, clear: boolean) => {
    generationRef.current += 1;
    update(initialState(topic, status));
    if (clear && userId) clearStudySession(userId);
  }, [update, userId]);

  useEffect(() => {
    const previous = contextRef.current;
    if (previous.userId === userId && previous.selectedTopicId === selectedTopicId && previous.initialStatus === initialStatus) return;
    contextRef.current = { userId, selectedTopicId, initialStatus };
    reset(selectedTopicId, initialStatus || 'new', previous.userId === userId);
  }, [userId, selectedTopicId, initialStatus, reset]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; generationRef.current += 1; };
  }, []);

  const topicVocabulary = useMemo(() => state.filterTopic === 'all' ? vocabularies : vocabularies.filter(v => v.topic_id === state.filterTopic), [vocabularies, state.filterTopic]);
  const activeVocabulary = useMemo(() => {
    if (state.isSessionRestored && state.studyQueue.length > 0) {
      const byId = new Map(topicVocabulary.map(v => [v.id, v]));
      return state.studyQueue.map(id => byId.get(id)).filter((v): v is Vocabulary => v !== undefined);
    }
    return selectActiveVocabulary({ vocabularies: topicVocabulary, topicId: 'all', status: state.filterStatus, nowMs });
  }, [topicVocabulary, state.filterStatus, state.isSessionRestored, state.studyQueue, nowMs]);
  const safeIndex = activeVocabulary.length === 0 ? 0 : Math.max(0, Math.min(state.currentIndex, activeVocabulary.length - 1));
  const currentVocabulary = activeVocabulary[safeIndex];
  useEffect(() => {
    latestRef.current = { userId, onCompleted, currentId: currentVocabulary?.id };
  }, [userId, onCompleted, currentVocabulary?.id]);

  useEffect(() => {
    if (state.isSessionRestored || activeVocabulary.length === 0) return;
    const restored = userId ? reconcileStudySession({
      snapshot: loadStudySession(userId), userId, topicId: state.filterTopic, status: state.filterStatus,
      availableVocabularyIds: new Set(topicVocabulary.map(v => v.id)),
    }) : null;
    update({ ...stateRef.current, studyQueue: restored?.vocabularyIds || activeVocabulary.map(v => v.id),
      currentIndex: restored?.currentIndex || 0, isSessionRestored: true });
  }, [state.isSessionRestored, state.filterTopic, state.filterStatus, activeVocabulary, topicVocabulary, userId, update]);

  const prepareRating = useCallback((rating: SrsRating, isMastered: boolean): PreparedRating | null => {
    const captured = stateRef.current;
    const cardId = currentVocabulary?.id;
    if (!userId || !cardId || captured.isCompleted || !captured.isSessionRestored) return null;
    const generation = generationRef.current;
    const index = safeIndex;
    const queue = captured.studyQueue;
    const transition = applyRatingToQueue(rating, queue, index, cardId);
    let committed = false;
    const isCurrent = () => mountedRef.current && !committed && latestRef.current.userId === userId &&
      generationRef.current === generation && stateRef.current.studyQueue === queue &&
      stateRef.current.currentIndex === captured.currentIndex && latestRef.current.currentId === cardId &&
      !stateRef.current.isCompleted;
    return {
      isComplete: transition.isComplete,
      isCurrent,
      commit: () => {
        if (!isCurrent()) return false;
        committed = true;
        const previous = stateRef.current;
        update({ ...previous, studyQueue: transition.queue, currentIndex: transition.currentIndex,
          isCompleted: transition.isComplete,
          sessionStats: {
            mastered: previous.sessionStats.mastered + (isMastered || rating === 'mastered' ? 1 : 0),
            learningVocabularyIds: !isMastered && rating !== 'mastered' && !previous.sessionStats.learningVocabularyIds.includes(cardId)
              ? [...previous.sessionStats.learningVocabularyIds, cardId] : previous.sessionStats.learningVocabularyIds,
            needsReview: previous.sessionStats.needsReview + (!isMastered && rating !== 'mastered' ? 1 : 0),
          },
        });
        if (transition.isComplete) {
          latestRef.current.onCompleted?.();
          clearStudySession(userId);
        } else if (transition.queue.length > 0) {
          const timestamp = new Date().toISOString();
          const snapshot: StudySessionSnapshot = { version: 1, userId, mode: previous.filterStatus === 'new' ? 'new' : 'review',
            vocabularyIds: transition.queue, currentIndex: transition.currentIndex, selectedTopicId: previous.filterTopic,
            initialStatus: previous.filterStatus, startedAt: timestamp, updatedAt: timestamp };
          saveStudySession(snapshot);
        }
        return true;
      },
    };
  }, [userId, update, currentVocabulary?.id, safeIndex]);

  const selectTopic = useCallback((topic: string) => reset(topic, stateRef.current.filterStatus, false), [reset]);
  const selectStatus = useCallback((status: FlashcardInitialFilter) => reset(stateRef.current.filterTopic, status, false), [reset]);
  const setSubMode = useCallback((mode: StudySubMode) => update({ ...stateRef.current, subMode: mode }), [update]);
  const advanceMode = useCallback(() => {
    const mode = stateRef.current.subMode;
    setSubMode(mode === 'flashcard' ? 'quiz' : mode === 'quiz' ? 'typing' : mode === 'typing' ? 'pronounce' : 'flashcard');
  }, [setSubMode]);
  const removeCurrentAfterDelete = useCallback(() => {
    const current = stateRef.current;
    if (current.currentIndex >= activeVocabulary.length - 1) {
      generationRef.current += 1;
      update({ ...current, currentIndex: Math.max(0, activeVocabulary.length - 2) });
    }
  }, [activeVocabulary.length, update]);
  const restart = useCallback(() => reset(stateRef.current.filterTopic, stateRef.current.filterStatus, true), [reset]);
  return { ...state, nowMs, topicVocabulary, activeVocabulary, safeIndex, currentVocabulary,
    prepareRating, selectTopic, selectStatus, setSubMode, advanceMode, removeCurrentAfterDelete, restart };
}
