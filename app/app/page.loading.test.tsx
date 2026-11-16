// @vitest-environment jsdom
import { act, StrictMode, type ComponentProps } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let AppPage: typeof import('./page').default;
import type { Dashboard } from '../../components/Dashboard';
import type { FlashcardMode } from '../../components/FlashcardMode';
import type { AppCoreData, AppDerivedData } from '../../services/appDataService';
import type { RatingResult } from '../../services/progressService';
import { AuthRetryExhaustedError, AuthSessionExpiredError } from '../../lib/supabase/authRetry';
import { button, click, mount } from '../../features/synonym-practice/components/test-utils/dom';

const mocks = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  core: vi.fn(), snapshot: vi.fn(), derived: vi.fn(), update: vi.fn(), edit: vi.fn(), replace: vi.fn(), toast: vi.fn(),
  emitInitialSession: false,
  getSession: vi.fn(),
  props: undefined as undefined | ComponentProps<typeof Dashboard>,
}));
vi.mock('next/navigation', () => { const router = { replace: mocks.replace }; return { useRouter: () => router }; });
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {
  onAuthStateChange: (listener: typeof mocks.listener) => {
    mocks.listener = listener;
    if (mocks.emitInitialSession) listener!('INITIAL_SESSION', { user: { id: 'user-a' } });
    return { data: { subscription: { unsubscribe() {} } } };
  },
  getSession: mocks.getSession,
} }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('../../services/appDataService', () => ({ loadAppCoreData: mocks.core, loadAppDataSnapshot: mocks.snapshot, loadAppDerivedData: mocks.derived }));
vi.mock('../../services/vocabService', () => ({ updateUserProgress: mocks.update }));
vi.mock('../../services/vocabularyService', () => ({ updateVocabulary: mocks.edit }));
vi.mock('../../features/review-reminder', () => ({ useReviewReminder: () => ({}), ReviewReminderPopup: () => null }));
vi.mock('../../components/Navbar', () => ({ Navbar: ({ currentStreak }: { currentStreak: number | null }) => <output data-streak>{currentStreak === null ? 'loading' : currentStreak}</output> }));
vi.mock('../../components/Dashboard', () => ({ Dashboard: (props: ComponentProps<typeof Dashboard>) => {
  mocks.props = props;
  return <><output data-words>{JSON.stringify(props.vocabularies)}</output><button onClick={() => props.onSelectTopicForFlashcard('all')}>Study</button></>;
} }));
vi.mock('next/dynamic', () => ({ default: () => (props: ComponentProps<typeof FlashcardMode>) => <>
  <p>Study available</p>
  <output data-edited-words>{JSON.stringify(props.vocabularies)}</output>
  <button onClick={() => void props.onEditVocabulary!('v', { word: 'edited agenda' })}>Edit vocabulary</button>
  <button onClick={props.onBackToDashboard}>Back to dashboard</button>
</> }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function core(word = 'agenda'): AppCoreData {
  return { collections: [], topics: [], vocabularies: [{ id: 'v', topic_id: 't', word, meaning: 'meaning', part_of_speech: 'noun', status: 'new' }], stats: { totalWords: 1, newCount: 1, masteredCount: 0, learningCount: 0, dailyStreak: 0, todayStudiedCount: 0 } };
}
function derived(streak = 7): AppDerivedData {
  return { dashboardMetrics: { totalVocabulary: 99, newVocabulary: 99, learningVocabulary: 0, masteredVocabulary: 0, dueVocabulary: 0, reviewsToday: 3, uniqueVocabularyStudiedToday: 2, newVocabularyStudiedToday: 1, studyStreak: streak, difficultVocabulary: 0 }, weekActivity: [{ date: '2026-11-16', count: streak }], aggregateErrors: {} };
}
const saved: RatingResult = { status: 'success', new_status: 'learning', interval_hours: 24, next_review_at: '2026-11-17T00:00:00Z', review_count: 1, again_count: 0 };
let dom: Awaited<ReturnType<typeof mount>> | undefined;
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function start() { dom = await mount(<AppPage />); await tick(); }
async function auth(userId: string | null) {
  await act(async () => mocks.listener!(userId ? 'SIGNED_IN' : 'SIGNED_OUT', userId ? { user: { id: userId } } : null));
  await tick();
}
beforeEach(async () => {
  vi.resetModules();
  AppPage = (await import('./page')).default;
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks();
  mocks.props = undefined;
  mocks.emitInitialSession = false;
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } }, error: null });
  mocks.core.mockImplementation(async () => core());
  mocks.derived.mockImplementation(async () => derived());
  mocks.snapshot.mockImplementation(async () => {
    const [data, aggregates] = await Promise.all([mocks.core(), mocks.derived()]);
    return { ...data, ...aggregates };
  });
  mocks.update.mockResolvedValue(saved);
  mocks.edit.mockResolvedValue(undefined);
});
afterEach(async () => { if (dom) await dom.unmount(); dom = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

it('makes vocabulary usable while review-log aggregates are delayed', async () => {
  const pending = deferred<AppDerivedData>(); mocks.derived.mockReturnValue(pending.promise);
  await start();
  expect(dom!.container.textContent).toContain('agenda');
  expect(mocks.props?.isLoadingMetrics).toBe(true);
  expect(mocks.props?.isLoadingWeekActivity).toBe(true);
  expect(dom!.container.querySelector('[data-streak]')?.textContent).toBe('loading');
  await click(button(dom!.container, 'Study'));
  expect(dom!.container.textContent).toContain('Study available');
  await act(async () => pending.resolve(derived()));
});

it('retains core and unknown metric readiness after the first aggregate failure', async () => {
  mocks.derived.mockResolvedValue({ dashboardMetrics: null, weekActivity: null, aggregateErrors: { dashboardMetrics: new Error('offline'), weekActivity: new Error('offline') } });
  await start();
  expect(dom!.container.textContent).toContain('agenda');
  expect(mocks.props?.isLoadingMetrics).toBe(true);
  expect(mocks.props?.isLoadingWeekActivity).toBe(true);
  expect(dom!.container.querySelector('[data-streak]')?.textContent).toBe('loading');
});

it.each(['metrics', 'week'] as const)('tracks %s readiness independently after partial success', async (field) => {
  const result = derived();
  mocks.derived.mockResolvedValue(field === 'metrics'
    ? { ...result, weekActivity: null, aggregateErrors: { weekActivity: new Error('offline') } }
    : { ...result, dashboardMetrics: null, aggregateErrors: { dashboardMetrics: new Error('offline') } });
  await start();
  expect(mocks.props?.isLoadingMetrics).toBe(field !== 'metrics');
  expect(mocks.props?.isLoadingWeekActivity).toBe(field !== 'week');
});

it('reconciles aggregates that arrive before core with the successful core snapshot', async () => {
  const pending = deferred<AppCoreData>(); mocks.core.mockReturnValue(pending.promise);
  await start(); await act(async () => pending.resolve(core()));
  expect(mocks.props?.dashboardMetrics).toMatchObject({ totalVocabulary: 1, newVocabulary: 1, studyStreak: 7, reviewsToday: 3 });
});

it('keeps the successful vocabulary snapshot and prior metrics on a failed refresh', async () => {
  await start();
  mocks.core.mockRejectedValue(new Error('core offline'));
  mocks.derived.mockResolvedValue({ dashboardMetrics: null, weekActivity: null, aggregateErrors: { dashboardMetrics: new Error('offline') } });
  await auth('user-a');
  expect(dom!.container.textContent).toContain('agenda');
  expect(dom!.container.querySelector('[role="alert"]')?.textContent).toContain('core offline');
  expect(mocks.props?.dashboardMetrics?.studyStreak).toBe(7);
  expect(mocks.props?.isLoadingMetrics).toBe(false);
  expect(mocks.props?.isLoadingWeekActivity).toBe(false);
});

it.each(['logout', 'switch', 'ABA'] as const)('ignores late core and aggregate results after %s', async (change) => {
  const oldCore = deferred<AppCoreData>(), oldDerived = deferred<AppDerivedData>();
  mocks.core.mockReturnValueOnce(oldCore.promise); mocks.derived.mockReturnValueOnce(oldDerived.promise);
  await start();
  await auth(change === 'logout' ? null : 'user-b');
  if (change === 'ABA') await auth('user-a');
  await act(async () => { oldCore.resolve(core('stale')); oldDerived.resolve(derived(99)); });
  expect(dom!.container.textContent).not.toContain('stale');
  expect(dom!.container.querySelector('[data-streak]')?.textContent).not.toBe('99');
  if (change !== 'logout') expect(dom!.container.textContent).toContain('agenda');
});

it('ignores superseded core and derived refreshes within the same account', async () => {
  await start();
  const oldCore = deferred<AppCoreData>(), oldDerived = deferred<AppDerivedData>();
  mocks.core.mockReturnValueOnce(oldCore.promise); mocks.derived.mockReturnValueOnce(oldDerived.promise);
  await auth('user-a');
  mocks.core.mockResolvedValue(core('fresh')); mocks.derived.mockResolvedValue(derived(8));
  await auth('user-a');
  expect(dom!.container.textContent).toContain('fresh');
  await act(async () => { oldCore.resolve(core('stale')); oldDerived.resolve(derived(99)); });
  expect(dom!.container.textContent).toContain('fresh');
  expect(dom!.container.querySelector('[data-streak]')?.textContent).toBe('8');
});

it('keeps a rating authoritative during an in-flight core fetch', async () => {
  await start(); const pending = deferred<AppCoreData>(); mocks.core.mockReturnValueOnce(pending.promise);
  await auth('user-a');
  await act(async () => { await mocks.props!.onUpdateProgress!('v', 'learning', 'good', 'key'); });
  await act(async () => pending.resolve(core()));
  expect(dom!.container.querySelector('[data-words]')?.textContent).toContain('"review_count":1');
});

it('starts a fresh post-rating aggregate request and rejects older review-log values', async () => {
  await start(); const old = deferred<AppDerivedData>(); mocks.derived.mockReturnValueOnce(old.promise);
  await auth('user-a');
  await act(async () => { await mocks.props!.onUpdateProgress!('v', 'learning', 'good', 'key'); });
  mocks.derived.mockResolvedValue(derived(8));
  await tick(5000);
  expect(mocks.props?.dashboardMetrics?.studyStreak).toBe(8);
  await act(async () => old.resolve(derived(99)));
  expect(mocks.props?.dashboardMetrics?.studyStreak).toBe(8);
  expect(mocks.props?.weekActivity).toEqual([{ date: '2026-11-16', count: 8 }]);
  expect(mocks.props?.dashboardMetrics?.learningVocabulary).toBe(1);
});

it('does not publish a pre-rating aggregate during the debounce window', async () => {
  await start(); const old = deferred<AppDerivedData>(); mocks.derived.mockReturnValueOnce(old.promise);
  await auth('user-a');
  await act(async () => { await mocks.props!.onUpdateProgress!('v', 'learning', 'good', 'key'); });
  await act(async () => old.resolve(derived(99)));
  expect(mocks.props?.dashboardMetrics?.studyStreak).toBe(7);
});

it('bounds aggregate background retry to one attempt and allows focus retry', async () => {
  mocks.derived.mockResolvedValue({ dashboardMetrics: null, weekActivity: null, aggregateErrors: { dashboardMetrics: new Error('offline') } });
  await start(); await tick(15000);
  expect(mocks.derived).toHaveBeenCalledTimes(2);
  await act(async () => window.dispatchEvent(new Event('focus'))); await tick(750);
  expect(mocks.derived).toHaveBeenCalledTimes(3);
});

it('stops aggregate retries after exhausted auth retry while leaving core usable', async () => {
  mocks.derived.mockResolvedValue({ dashboardMetrics: null, weekActivity: null, aggregateErrors: { dashboardMetrics: new AuthRetryExhaustedError() } });
  await start(); await tick(15000);
  expect(dom!.container.textContent).toContain('agenda');
  expect(mocks.derived).toHaveBeenCalledTimes(1);
  expect(mocks.props?.isLoadingMetrics).toBe(true);
});

it('redirects on current aggregate session expiry', async () => {
  mocks.derived.mockResolvedValue({ dashboardMetrics: null, weekActivity: null, aggregateErrors: { dashboardMetrics: new AuthSessionExpiredError() } });
  await start(); expect(mocks.replace).toHaveBeenCalledWith('/login?next=%2Fapp');
});

it('does not react to a late auth failure or schedule retries after unmount', async () => {
  const pending = deferred<AppDerivedData>(); mocks.derived.mockReturnValue(pending.promise);
  await start(); await dom!.unmount(); dom = undefined;
  await act(async () => pending.resolve({ dashboardMetrics: null, weekActivity: null, aggregateErrors: { dashboardMetrics: new AuthSessionExpiredError() } }));
  await tick(15000); expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.derived).toHaveBeenCalledTimes(1);
});

it.each(['pending initial aggregate', 'scheduled aggregate retry'] as const)('recovers aggregate readiness after a text edit during %s', async (state) => {
  const initial = deferred<AppDerivedData>();
  mocks.derived.mockReturnValueOnce(state === 'pending initial aggregate' ? initial.promise : Promise.resolve({
    dashboardMetrics: null, weekActivity: null,
    aggregateErrors: { dashboardMetrics: new Error('offline'), weekActivity: new Error('offline') },
  }));
  await start();
  expect(mocks.props?.isLoadingMetrics).toBe(true);
  expect(mocks.props?.isLoadingWeekActivity).toBe(true);
  await click(button(dom!.container, 'Study'));
  await click(button(dom!.container, 'Edit vocabulary'));
  expect(dom!.container.querySelector('[data-edited-words]')?.textContent).toContain('edited agenda');
  expect(mocks.edit).toHaveBeenCalledExactlyOnceWith('v', { word: 'edited agenda' });
  // Recovery must finish without requiring another mutation or focus event.
  await act(async () => initial.resolve(derived(99)));
  await tick(3000);
  await click(button(dom!.container, 'Back to dashboard'));
  expect(mocks.props?.isLoadingMetrics).toBe(false);
  expect(mocks.props?.isLoadingWeekActivity).toBe(false);
  expect(mocks.props?.dashboardMetrics?.studyStreak).toBe(7);
  expect(mocks.props?.weekActivity).toEqual([{ date: '2026-11-16', count: 7 }]);
  expect(dom!.container.querySelector('[data-words]')?.textContent).toContain('edited agenda');
  await act(async () => window.dispatchEvent(new Event('focus')));
  await tick(750);
  expect(mocks.derived).toHaveBeenCalledTimes(2);
  expect(mocks.core).toHaveBeenCalledTimes(1);
  expect(mocks.update).not.toHaveBeenCalled();
});

it.each(['subscription first', 'getSession first'] as const)('shares one startup load across duplicate INITIAL_SESSION notifications: %s', async (order) => {
  const pendingCore = deferred<AppCoreData>(), pendingDerived = deferred<AppDerivedData>();
  mocks.core.mockReturnValue(pendingCore.promise);
  mocks.derived.mockReturnValue(pendingDerived.promise);
  if (order === 'subscription first') {
    mocks.emitInitialSession = true;
    // The provider callback starts loading before explicit restoration resolves.
    const restored = deferred<{ data: { session: { user: { id: string } } }; error: null }>();
    mocks.getSession.mockReturnValue(restored.promise);
    await start();
    await act(async () => restored.resolve({ data: { session: { user: { id: 'user-a' } } }, error: null }));
  } else {
    await start();
    await act(async () => mocks.listener!('INITIAL_SESSION', { user: { id: 'user-a' } }));
  }
  await tick();
  expect(mocks.core).toHaveBeenCalledTimes(1);
  expect(mocks.derived).toHaveBeenCalledTimes(1);
  await act(async () => pendingCore.resolve(core()));
  expect(dom!.container.textContent).toContain('agenda');
  expect(mocks.props?.isLoadingMetrics).toBe(true);
  await act(async () => pendingDerived.resolve(derived()));
  expect(mocks.props?.isLoadingMetrics).toBe(false);
  expect(mocks.props?.isLoadingWeekActivity).toBe(false);
  // A later provider INITIAL_SESSION must not start another logical load either.
  await act(async () => mocks.listener!('INITIAL_SESSION', { user: { id: 'user-a' } }));
  await tick();
  expect(mocks.core).toHaveBeenCalledTimes(1);
  expect(mocks.derived).toHaveBeenCalledTimes(1);
});

it('keeps one startup load when StrictMode repeats the auth subscription effect', async () => {
  mocks.emitInitialSession = true;
  const pendingCore = deferred<AppCoreData>(), pendingDerived = deferred<AppDerivedData>();
  mocks.core.mockReturnValue(pendingCore.promise);
  mocks.derived.mockReturnValue(pendingDerived.promise);
  dom = await mount(<StrictMode><AppPage /></StrictMode>);
  await tick();
  expect(mocks.core).toHaveBeenCalledTimes(1);
  expect(mocks.derived).toHaveBeenCalledTimes(1);
  await act(async () => { pendingCore.resolve(core()); pendingDerived.resolve(derived()); });
  expect(dom.container.textContent).toContain('agenda');
  expect(mocks.props?.isLoadingMetrics).toBe(false);
});
