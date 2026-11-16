// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppPage from './page';
import type { Dashboard } from '../../components/Dashboard';
import type { FlashcardMode } from '../../components/FlashcardMode';
import type { RatingResult } from '../../services/progressService';
import type { Vocabulary } from '../../lib/types';
import { button, click, mount } from '../../features/synonym-practice/components/test-utils/dom';

const mocks = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  snapshot: vi.fn(), derived: vi.fn(), update: vi.fn(), replace: vi.fn(),
  rate: undefined as undefined | ComponentProps<typeof Dashboard>['onUpdateProgress'],
}));
vi.mock('next/navigation', () => { const router = { replace: mocks.replace }; return { useRouter: () => router }; });
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {
  onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe() {} } } }; },
  getSession: async () => ({ data: { session: { user: { id: 'user-a' } } }, error: null }),
} }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../services/appDataService', () => ({ loadAppCoreData: mocks.snapshot, loadAppDataSnapshot: mocks.snapshot, loadAppDerivedData: mocks.derived }));
vi.mock('../../services/vocabService', () => ({ updateUserProgress: mocks.update }));
vi.mock('../../features/review-reminder', () => ({ useReviewReminder: () => ({}), ReviewReminderPopup: () => null }));
vi.mock('../../components/Navbar', () => ({ Navbar: () => null }));
vi.mock('../../components/Dashboard', () => ({ Dashboard: (props: ComponentProps<typeof Dashboard>) => {
  mocks.rate = props.onUpdateProgress;
  return <><output>{JSON.stringify(props.vocabularies)}</output><button onClick={() => props.onSelectTopicForFlashcard('all')}>Study</button></>;
} }));
vi.mock('next/dynamic', () => ({ default: () => (props: ComponentProps<typeof FlashcardMode>) => <output>{props.userId}:{JSON.stringify(props.vocabularies)}</output> }));

let dom: Awaited<ReturnType<typeof mount>>;
const word: Vocabulary = { id: 'shared-id', topic_id: 't', word: 'word', meaning: 'meaning', part_of_speech: 'noun', status: 'new' };
const saved: RatingResult = { status: 'success', new_status: 'learning', interval_hours: 24, next_review_at: '2026-11-16T00:00:00Z', review_count: 1, again_count: 0 };
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
async function auth(userId: string | null) {
  await act(async () => mocks.listener!(userId ? 'SIGNED_IN' : 'SIGNED_OUT', userId ? { user: { id: userId } } : null));
  await settle();
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.snapshot.mockImplementation(async () => ({ collections: [], topics: [], vocabularies: [{ ...word }], stats: {}, dashboardMetrics: null, weekActivity: [], aggregateErrors: {} }));
  mocks.derived.mockResolvedValue({ dashboardMetrics: null, weekActivity: [], aggregateErrors: {} });
  dom = await mount(<AppPage />);
  await settle();
});
afterEach(async () => { await dom.unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('passes the authenticated page identity to Flashcard', async () => {
  await click(button(dom.container, 'Study'));
  expect(dom.container.querySelector('output')?.textContent).toContain('user-a:');
});
it('patches the server result for the current identity', async () => {
  mocks.update.mockResolvedValue(saved);
  await act(async () => { await mocks.rate!('shared-id', 'learning', 'good', 'key'); });
  expect(dom.container.querySelector('output')?.textContent).toContain('"review_count":1');
});
it.each(['switch', 'logout', 'logout-and-return'] as const)('does not patch a late rating or refresh aggregates after %s', async (change) => {
  let resolve!: (result: RatingResult) => void;
  mocks.update.mockReturnValueOnce(new Promise<RatingResult>(yes => { resolve = yes; }));
  let pending!: Promise<RatingResult>;
  await act(async () => { pending = mocks.rate!('shared-id', 'learning', 'good', 'key'); });
  await auth(change === 'switch' ? 'user-b' : null);
  if (change === 'logout-and-return') await auth('user-a');
  mocks.derived.mockClear();
  vi.useFakeTimers();
  await act(async () => { resolve(saved); await pending; });
  expect(dom.container.textContent).not.toContain('"review_count":1');
  await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
  expect(mocks.derived).not.toHaveBeenCalled();
});
it('still applies an in-flight rating after a same-user session notification', async () => {
  let resolve!: (result: RatingResult) => void;
  mocks.update.mockReturnValueOnce(new Promise<RatingResult>(yes => { resolve = yes; }));
  let pending!: Promise<RatingResult>;
  await act(async () => { pending = mocks.rate!('shared-id', 'learning', 'good', 'key'); });
  await auth('user-a');
  await act(async () => { resolve(saved); await pending; });
  expect(dom.container.querySelector('output')?.textContent).toContain('"review_count":1');
});
