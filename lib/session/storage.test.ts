// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  clearAllStudySessions, clearPendingRatingAction, clearStudySession,
  loadPendingRatingAction, loadStudySession, savePendingRatingAction, saveStudySession,
  type PendingRatingAction,
} from './storage';
import type { StudySessionSnapshot } from './types';

const snapshot: StudySessionSnapshot = {
  version: 1, userId: 'user-a', mode: 'new', vocabularyIds: ['b', 'a', 'b'],
  currentIndex: 1, selectedTopicId: 'topic', initialStatus: 'new',
  startedAt: '2026-11-16T00:00:00Z', updatedAt: '2026-11-16T00:01:00Z',
};
const action: PendingRatingAction = {
  vocabularyId: 'a', isMastered: false, rating: 'good', idempotencyKey: 'original-key',
  startedAt: 1794787200000, status: 'pending',
};
beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('round-trips v1 verbatim and isolates user snapshots and pending actions when clearing', () => {
  saveStudySession(snapshot);
  saveStudySession({ ...snapshot, userId: 'user-b', currentIndex: 2 });
  savePendingRatingAction('user-a', action);
  savePendingRatingAction('user-b', { ...action, idempotencyKey: 'b-key' });
  expect(loadStudySession('user-a')).toEqual(snapshot);
  expect(loadStudySession('missing')).toBeNull();
  expect(loadPendingRatingAction('missing')).toBeNull();
  clearStudySession('user-a');
  expect(loadStudySession('user-a')).toBeNull();
  expect(loadPendingRatingAction('user-a')).toEqual(action);
  clearPendingRatingAction('user-a');
  expect(loadPendingRatingAction('user-a')).toBeNull();
  expect(loadStudySession('user-b')).toEqual({ ...snapshot, userId: 'user-b', currentIndex: 2 });
  expect(loadPendingRatingAction('user-b')?.idempotencyKey).toBe('b-key');
});

it.each([
  { version: 2 }, { userId: 'user-b' }, { vocabularyIds: 'a' }, { currentIndex: '1' },
])('rejects and removes structurally invalid snapshots: %j', invalid => {
  sessionStorage.setItem('vocab_study_session_v1:user-a', JSON.stringify({ ...snapshot, ...invalid }));
  expect(loadStudySession('user-a')).toBeNull();
  expect(sessionStorage.getItem('vocab_study_session_v1:user-a')).toBeNull();
});

it.each(['pending', 'retrying', 'confirmed'] as const)('round-trips %s without replacing the idempotency key', status => {
  savePendingRatingAction('user-a', { ...action, status });
  expect(loadPendingRatingAction('user-a')).toEqual({ ...action, status });
});

it.each([{ vocabularyId: 1 }, { isMastered: 'false' }, { rating: 'invalid' }, { idempotencyKey: null }])('clears invalid pending action: %j', invalid => {
  sessionStorage.setItem('vocab_pending_rating_v1:user-a', JSON.stringify({ ...action, ...invalid }));
  expect(loadPendingRatingAction('user-a')).toBeNull();
  expect(sessionStorage.getItem('vocab_pending_rating_v1:user-a')).toBeNull();
});

it('defaults absent legacy pending metadata while preserving the original action key', () => {
  vi.spyOn(Date, 'now').mockReturnValue(123456);
  sessionStorage.setItem('vocab_pending_rating_v1:user-a', JSON.stringify({ ...action, startedAt: undefined, status: undefined }));
  expect(loadPendingRatingAction('user-a')).toEqual({ ...action, startedAt: 123456, status: 'pending' });
});

it.each(['{broken', 'null'])('tolerates malformed stored data %s without throwing', raw => {
  sessionStorage.setItem('vocab_study_session_v1:user-a', raw);
  sessionStorage.setItem('vocab_pending_rating_v1:user-a', raw);
  expect(loadStudySession('user-a')).toBeNull();
  expect(loadPendingRatingAction('user-a')).toBeNull();
});

it('clears both recovery namespaces for every user but preserves unrelated storage', () => {
  for (const userId of ['user-a', 'user-b']) {
    saveStudySession({ ...snapshot, userId });
    savePendingRatingAction(userId, action);
  }
  sessionStorage.setItem('settings', 'keep');
  clearAllStudySessions();
  expect(Object.keys(sessionStorage)).toEqual(['settings']);
  expect(sessionStorage.getItem('settings')).toBe('keep');
});

it.each(['getItem', 'setItem', 'removeItem'] as const)('tolerates storage.%s failures', method => {
  saveStudySession(snapshot);
  savePendingRatingAction('user-a', action);
  vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('storage unavailable'); });
  expect(() => {
    saveStudySession(snapshot);
    savePendingRatingAction('user-a', action);
    if (method === 'getItem') {
      expect(loadStudySession('user-a')).toBeNull();
      expect(loadPendingRatingAction('user-a')).toBeNull();
    }
    clearStudySession('user-a');
    clearPendingRatingAction('user-a');
    clearAllStudySessions();
  }).not.toThrow();
});

it.each(['server', 'missing storage'])('no-ops with unavailable browser storage: %s', environment => {
  vi.stubGlobal('window', environment === 'server' ? undefined : { sessionStorage: undefined });
  expect(loadStudySession('user-a')).toBeNull();
  expect(loadPendingRatingAction('user-a')).toBeNull();
  expect(() => {
    saveStudySession(snapshot);
    savePendingRatingAction('user-a', action);
    clearStudySession('user-a');
    clearPendingRatingAction('user-a');
    clearAllStudySessions();
  }).not.toThrow();
});

it('characterizes the existing uncaught error when the sessionStorage getter itself is blocked', () => {
  // Pre-existing limitation: guards read this property outside their try/catch.
  // Keep the observed behavior visible without changing production in C2.1.
  vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage blocked', 'SecurityError');
  });
  const operations = [
    () => loadStudySession('user-a'), () => loadPendingRatingAction('user-a'),
    () => saveStudySession(snapshot), () => savePendingRatingAction('user-a', action),
    () => clearStudySession('user-a'), () => clearPendingRatingAction('user-a'),
    () => clearAllStudySessions(),
  ];
  for (const operation of operations) expect(operation).toThrow('Storage blocked');
});
