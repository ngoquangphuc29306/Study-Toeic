// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FlashcardMode } from './FlashcardMode';
import { loadPendingRatingAction, loadStudySession, savePendingRatingAction, saveStudySession } from '../lib/session/storage';
import { updateUserProgress } from '../services/vocabService';
import type { RatingResult } from '../services/progressService';
import type { Vocabulary } from '../lib/types';
import { button, change, click, mount } from '../features/synonym-practice/components/test-utils/dom';

vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
const requests = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getUser: requests.getUser }, rpc: requests.rpc }) }));
vi.mock('../hooks/use-prefers-reduced-motion', () => ({ usePrefersReducedMotion: () => true }));
vi.mock('gsap', () => ({ default: { context: (callback: () => void) => { callback(); return { revert() {} }; }, set() {} } }));

let dom: Awaited<ReturnType<typeof mount>>;
const onUpdateProgress = vi.fn();
const vocabs: Vocabulary[] = ['Correct', ...Array(12).fill(' correct '), ...Array(12).fill('Other'), 'Third', 'Fourth'].map((meaning, index) => ({
  id: `v${index}`, word: `word${index}`, meaning, topic_id: 't', part_of_speech: 'noun',
}));
const view = (vocabularies = vocabs, userId: string | null = 'user-a') => <FlashcardMode userId={userId} vocabularies={vocabularies} topics={[]} selectedTopicId="all" onUpdateProgress={onUpdateProgress} onBackToDashboard={() => {}} onSwitchToSynonyms={() => {}} />;
async function key(target: EventTarget, code: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: code === 'Space' ? ' ' : code, code, bubbles: true, cancelable: true, ...options });
  await act(async () => { target.dispatchEvent(event); });
  return event;
}
const mode = (number: number) => expect(dom.container.textContent).toContain(`Chế độ ${number}/4`);
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear();
  requests.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'wrong-user' } } });
  requests.rpc.mockReset().mockResolvedValue({ data: savedRating, error: null });
  onUpdateProgress.mockReset().mockImplementation(updateUserProgress);
  dom = await mount(view());
});
afterEach(async () => { await dom.unmount(); vi.unstubAllGlobals(); });

it('leaves focused native button Enter to its click action instead of cycling exercise', async () => {
  await key(document.body, 'Space');
  const remembered = button(dom.container, 'Đã thuộc');
  remembered.focus();
  const event = await key(remembered.querySelector('span')!, 'Enter');
  expect(event.defaultPrevented).toBe(false);
  mode(1);
  // jsdom does not synthesize the browser default click from keyboard events.
  await click(remembered);
  expect(dom.container.textContent).toContain('Đánh giá mức độ thuộc:');
  expect(onUpdateProgress).not.toHaveBeenCalled();
});

it.each(['Tab', 'ShiftTab'])('preserves native %s navigation without revealing ratings', async (shortcut) => {
  await key(document.body, 'Space');
  const event = await key(document.body, 'Tab', { shiftKey: shortcut === 'ShiftTab' });
  expect(event.defaultPrevented).toBe(false);
  expect(dom.container.textContent).not.toContain('Đánh giá mức độ thuộc:');
});

it.each([
  '<input>', '<textarea></textarea>', '<select><option>x</option></select>', '<a href="#"><span>x</span></a>',
  '<div contenteditable="true"><span>x</span></div>', '<div role="button" tabindex="0"><span>x</span></div>',
  '<div role="dialog"><span>x</span></div>', '<div tabindex="0"><span>x</span></div>',
])('ignores interactive ancestors: %s', async (html) => {
  const host = document.createElement('div'); host.innerHTML = html; dom.container.append(host);
  const target = host.querySelector('span') || host.firstElementChild!;
  expect((await key(target, 'Enter')).defaultPrevented).toBe(false);
  mode(1);
});

it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }, { repeat: true }])('ignores modified or non-discrete shortcuts %j', async (options) => {
  expect((await key(document.body, 'Enter', options)).defaultPrevented).toBe(false);
  mode(1);
  await key(document.body, 'Space', options);
  expect(dom.container.textContent).not.toContain('Chưa nhớ');
});

it('respects a previously handled event', async () => {
  const target = document.createElement('div'); dom.container.append(target);
  target.addEventListener('keydown', event => event.preventDefault());
  await key(target, 'Enter'); mode(1);
});

it('keeps body/context exercise shortcuts and quiz digits working', async () => {
  const context = document.createElement('div'); dom.container.append(context);
  await key(context, 'Space');
  expect(dom.container.textContent).toContain('Chưa nhớ');
  await key(context, 'Enter'); mode(2);
  await key(context, 'Digit1');
  expect(dom.container.querySelector('[data-flash-quiz-option="0"]')?.getAttribute('disabled')).not.toBeNull();
  expect(onUpdateProgress).not.toHaveBeenCalled();
});

it('blocks shortcuts while settings dialog is open even from the body', async () => {
  await click(dom.container.querySelector<HTMLButtonElement>('[title="Cài đặt thẻ"]')!);
  await key(document.body, 'Enter'); mode(1);
});

it('submits typing locally once and ignores composition, repeat and modifiers', async () => {
  await key(document.body, 'Enter'); await key(document.body, 'Enter'); mode(3);
  const input = dom.container.querySelector<HTMLInputElement>('input[placeholder="Gõ từ tiếng Anh..."]')!;
  await change(input, 'word0');
  for (const options of [{ isComposing: true }, { repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }]) {
    await key(input, 'Enter', options);
    expect(input.disabled).toBe(false);
  }
  expect((await key(input, 'Enter')).defaultPrevented).toBe(true);
  expect(input.disabled).toBe(true);
  mode(3);
  expect(dom.container.textContent).not.toContain('Đánh giá mức độ thuộc:');
  expect(onUpdateProgress).not.toHaveBeenCalled();
  await key(document.body, 'Enter');
  expect(dom.container.textContent).toContain('Đánh giá mức độ thuộc:');
});

it('samples distinct normalized meanings before limiting choices and preserves deterministic order', async () => {
  await key(document.body, 'Enter');
  const options = () => [...dom.container.querySelectorAll('[data-flash-quiz-option]')].map(node => node.querySelector('span.font-semibold')!.textContent!.trim());
  const first = options();
  expect(first).toHaveLength(4);
  expect(first.map(label => label.toLowerCase()).sort()).toEqual(['correct', 'fourth', 'other', 'third']);
  await dom.render(view([...vocabs]));
  expect(options()).toEqual(first);
});

it('uses only real alternatives for small meaning pools', async () => {
  await dom.unmount(); dom = await mount(view(vocabs.slice(0, 3)));
  await key(document.body, 'Enter');
  const options = dom.container.querySelectorAll('[data-flash-quiz-option]');
  expect(options).toHaveLength(1);
  expect(options[0].textContent).toContain('Correct');
});


it('ignores body-dispatched shortcuts while an interactive control retains focus', async () => {
  const control = dom.container.querySelector<HTMLButtonElement>('[title="Cài đặt thẻ"]')!;
  control.focus();
  expect((await key(document.body, 'Enter')).defaultPrevented).toBe(false);
  mode(1);
});

it('does not flip the card on Space from a native control', async () => {
  const control = dom.container.querySelector<HTMLButtonElement>('[title="Cài đặt thẻ"]')!;
  control.focus();
  expect((await key(control, 'Space')).defaultPrevented).toBe(false);
  expect(dom.container.textContent).not.toContain('Chưa nhớ');
});

it('does not select a quiz answer when a control owns the digit event', async () => {
  await key(document.body, 'Enter');
  const control = dom.container.querySelector<HTMLButtonElement>('[data-flash-quiz-option="0"]')!;
  control.focus();
  await key(control, 'Digit1');
  expect(control.disabled).toBe(false);
});

it('retains shortcuts from noninteractive semantic study context', async () => {
  const context = document.createElement('section'); context.setAttribute('role', 'region'); dom.container.append(context);
  await key(context, 'Enter'); mode(2);
});

it('recognizes the single correct choice after shuffling', async () => {
  await key(document.body, 'Enter');
  const correct = [...dom.container.querySelectorAll<HTMLButtonElement>('[data-flash-quiz-option]')].find(option => option.querySelector('span.font-semibold')?.textContent === 'Correct')!;
  await click(correct);
  expect(dom.container.querySelector('[data-flash-quiz-feedback]')?.textContent).toContain('Chính xác');
  expect(onUpdateProgress).not.toHaveBeenCalled();
});

it('does not render a blank correct meaning or invent an answer for invalid data', async () => {
  await dom.unmount(); dom = await mount(view([{ ...vocabs[0], meaning: '   ' }, ...vocabs.slice(-2)]));
  await key(document.body, 'Enter');
  expect(dom.container.querySelectorAll('[data-flash-quiz-option]')).toHaveLength(0);
});

it.each([2, 3])('renders exactly %i real choices for a small distinct pool', async (size) => {
  const meanings = ['Correct', 'Other', 'Third'].slice(0, size);
  const pool = meanings.map((meaning, index) => ({ ...vocabs[index], meaning }));
  // Duplicate and empty alternatives must not become extra options.
  pool.push({ ...vocabs[10], meaning: ' correct ' }, { ...vocabs[11], meaning: '   ' });
  await dom.unmount(); dom = await mount(view(pool));
  await key(document.body, 'Enter');
  const labels = [...dom.container.querySelectorAll('[data-flash-quiz-option] span.font-semibold')].map(node => node.textContent);
  expect(labels).toHaveLength(size);
  expect(labels.sort()).toEqual(meanings.sort());
});
const savedRating: RatingResult = { status: 'success', new_status: 'learning', interval_hours: 24, next_review_at: '2026-11-16T00:00:00Z', review_count: 1, again_count: 0 };
async function rate(label = 'Tốt') {
  await key(document.body, 'Space');
  await click(button(dom.container, 'Đã thuộc'));
  await click(button(dom.container, new RegExp(`^${label}`)));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
it('rates with one RPC and zero Auth requests, saving the page user snapshot', async () => {
  requests.getUser.mockClear();
  await rate();
  expect(requests.getUser).not.toHaveBeenCalled();
  expect(requests.rpc).toHaveBeenCalledTimes(1);
  expect(requests.rpc).toHaveBeenCalledWith('submit_vocabulary_rating', { p_vocabulary_id: 'v0', p_rating: 'good', p_idempotency_key: expect.any(String) });
  expect(loadStudySession('user-a')).toMatchObject({ userId: 'user-a', currentIndex: 1 });
  expect(loadStudySession('wrong-user')).toBeNull();
  expect(loadPendingRatingAction('user-a')).toBeNull();
});
it('keeps a failed save on the same card and explicitly retries the original key', async () => {
  requests.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await rate();
  expect(loadStudySession('user-a')).toBeNull();
  const pending = loadPendingRatingAction('user-a');
  expect(pending).toMatchObject({ vocabularyId: 'v0', rating: 'good', status: 'retrying' });
  expect(dom.container.textContent).toContain('word0');
  requests.rpc.mockResolvedValueOnce({ data: { ...savedRating, status: 'already_processed' }, error: null });
  await click(button(dom.container, 'Thử lại'));
  expect(requests.rpc).toHaveBeenCalledTimes(2);
  expect(requests.rpc.mock.calls[1][1].p_idempotency_key).toBe(pending?.idempotencyKey);
  expect(loadStudySession('user-a')?.currentIndex).toBe(1);
  expect(loadPendingRatingAction('user-a')).toBeNull();
  expect(requests.getUser).not.toHaveBeenCalled();
});
it.each(['retrying', 'confirmed'] as const)('restores only the page user session and %s action without auto-submitting', async (status) => {
  await dom.unmount();
  saveStudySession({ version: 1, userId: 'user-a', mode: 'new', vocabularyIds: ['v1', 'v0'], currentIndex: 0, selectedTopicId: 'all', initialStatus: 'new', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  savePendingRatingAction('user-a', { vocabularyId: 'v1', isMastered: false, rating: 'good', idempotencyKey: 'original-key', startedAt: Date.now(), status });
  savePendingRatingAction('wrong-user', { vocabularyId: 'v1', isMastered: false, rating: 'easy', idempotencyKey: 'foreign-key', startedAt: Date.now(), status });
  dom = await mount(view());
  expect(requests.rpc).not.toHaveBeenCalled();
  expect(dom.container.textContent).toContain('word1');
  await click(button(dom.container, 'Thử lại'));
  expect(requests.rpc.mock.calls[0][1]).toMatchObject({ p_vocabulary_id: 'v1', p_rating: 'good', p_idempotency_key: 'original-key' });
  expect(loadPendingRatingAction('wrong-user')?.idempotencyKey).toBe('foreign-key');
});
it.each([['user-b', false], [null, false], ['user-b', true], [null, true]] as const)('ignores an in-flight response after identity becomes %s (failure=%s)', async (nextUser, fails) => {
  const request = deferred<RatingResult>();
  onUpdateProgress.mockReturnValueOnce(request.promise);
  await rate();
  await dom.render(view(vocabs, nextUser));
  sessionStorage.clear(); // logout cleanup must not be undone by a late response
  await act(async () => { if (fails) request.reject(new Error('late failure')); else request.resolve(savedRating); });
  expect(sessionStorage.length).toBe(0);
  expect(dom.container.textContent).toContain('word0');
  expect(dom.container.textContent).not.toContain('late failure');
  if (nextUser) {
    await rate();
    expect(loadStudySession(nextUser)?.currentIndex).toBe(1);
  }
});
it('does not submit or write recovery storage without an authenticated page identity', async () => {
  await dom.render(view(vocabs, null));
  await rate();
  expect(onUpdateProgress).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});
it('keeps an expired-session save pending and retries the same key after reauthentication', async () => {
  requests.rpc.mockResolvedValueOnce({ data: null, error: { status: 401, code: 'PGRST301', message: 'JWT expired' } });
  await rate();
  expect(dom.container.textContent).toContain('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  expect(loadStudySession('user-a')).toBeNull();
  const pending = loadPendingRatingAction('user-a');
  expect(pending).toMatchObject({ vocabularyId: 'v0', status: 'retrying' });
  await click(button(dom.container, 'Thử lại'));
  expect(requests.rpc.mock.calls[1][1].p_idempotency_key).toBe(pending?.idempotencyKey);
  expect(loadStudySession('user-a')?.currentIndex).toBe(1);
  expect(requests.getUser).not.toHaveBeenCalled();
});
it('holds the submission lock until the RPC settles and keeps the original key across remount', async () => {
  const request = deferred<RatingResult>();
  onUpdateProgress.mockReturnValueOnce(request.promise);
  await rate();
  await key(document.body, 'Space');
  await key(document.body, 'Digit3');
  expect(onUpdateProgress).toHaveBeenCalledTimes(1);
  const pending = loadPendingRatingAction('user-a');
  await dom.unmount();
  await act(async () => request.resolve(savedRating));
  expect(loadPendingRatingAction('user-a')?.idempotencyKey).toBe(pending?.idempotencyKey);
  dom = await mount(view());
  expect(onUpdateProgress).toHaveBeenCalledTimes(1);
  await click(button(dom.container, 'Thử lại'));
  expect(onUpdateProgress.mock.calls[1][3]).toBe(pending?.idempotencyKey);
  expect(loadStudySession('user-a')?.currentIndex).toBe(1);
});
it('keeps a successful RPC committed when browser recovery storage is unavailable', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await rate();
    expect(requests.rpc).toHaveBeenCalledTimes(1);
    expect(dom.container.textContent).toContain('word1');
    expect(dom.container.textContent).not.toContain('Không thể lưu');
    expect(loadPendingRatingAction('user-a')).toBeNull();
  } finally {
    storage.mockRestore();
    warning.mockRestore();
  }
});
