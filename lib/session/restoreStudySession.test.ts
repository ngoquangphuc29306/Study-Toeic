import { describe, expect, it } from 'vitest';
import type { StudySessionSnapshot } from './types';
import { reconcileStudySession } from './restoreStudySession';

const snapshot: StudySessionSnapshot = {
  version: 1, userId: 'user', mode: 'new', vocabularyIds: ['a', 'missing', 'b'], currentIndex: 8,
  selectedTopicId: 'topic', initialStatus: 'new', startedAt: '2026-11-16', updatedAt: '2026-11-16',
};
const input = { snapshot, userId: 'user', topicId: 'topic', status: 'new' as const, availableVocabularyIds: new Set(['a', 'b']) };

describe('reconcileStudySession', () => {
  it('filters missing IDs in snapshot order and bounds the index', () => {
    expect(reconcileStudySession(input)).toEqual({ vocabularyIds: ['a', 'b'], currentIndex: 1 });
  });
  it('rejects absent or mismatched snapshot context', () => {
    expect(reconcileStudySession({ ...input, snapshot: null })).toBeNull();
    expect(reconcileStudySession({ ...input, userId: 'other' })).toBeNull();
    expect(reconcileStudySession({ ...input, topicId: 'other' })).toBeNull();
    expect(reconcileStudySession({ ...input, status: 'due' })).toBeNull();
  });
  it('falls back when no snapshot IDs are available', () => {
    expect(reconcileStudySession({ ...input, availableVocabularyIds: new Set() })).toBeNull();
  });
  it('keeps a valid index and duplicate queue IDs', () => {
    expect(reconcileStudySession({ ...input, snapshot: { ...snapshot, vocabularyIds: ['b', 'a', 'b'], currentIndex: 1 } })).toEqual({ vocabularyIds: ['b', 'a', 'b'], currentIndex: 1 });
  });
});
