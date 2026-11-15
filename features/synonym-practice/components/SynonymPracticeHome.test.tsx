// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Collection, Topic, Vocabulary } from '../../../lib/types';
import { ToastProvider } from '../../../contexts/ToastContext';
import { SynonymPractice } from './SynonymPracticeHome';
import { button, change, click, mount } from './test-utils/dom';
import * as progression from '../services/sessionProgression';
import * as service from '../services/synonymPracticeService';

const collections: Collection[] = [{ id: 'c1', title: 'Collection A' }, { id: 'c2', title: 'Collection B' }];
const topics: Topic[] = [
  { id: 't1', collection_id: 'c1', title: 'Topic A', description: '', icon: '' },
  { id: 't2', collection_id: 'c2', title: 'Topic B', description: '', icon: '' },
];
const vocabulary = (count = 12, prefix = 'a', topic = 't1'): Vocabulary[] => Array.from({ length: count }, (_, i) => ({
  id: `${prefix}${i}`, word: `${prefix}word${i}`, meaning: `meaning ${i}`, synonyms: `${prefix}syn${i}`,
  topic_id: topic, part_of_speech: 'noun',
}));
const labels = ['Chọn đáp án', 'Chọn tất cả', 'Gõ đáp án'] as const;
let dom: Awaited<ReturnType<typeof mount>>;
const node = (words: Vocabulary[]) => <ToastProvider><SynonymPractice vocabularies={words} topics={topics} collections={collections} onOpenEditVocabulary={() => {}} onOpenVocabularyManager={() => {}} /></ToastProvider>;
const renderHome = async (words = vocabulary()) => { dom = await mount(node(words)); };
const press = async (name: string | RegExp) => click(button(dom.container, name));
const setup = async (label: typeof labels[number] | 'Nối cặp') => {
  const card = [...dom.container.querySelectorAll('article')].find(article => article.querySelector('h3')?.textContent === label)!;
  await click(card.querySelector('button')!);
};
const start = () => press('Bắt đầu luyện tập');
const newSession = async () => { await press('Bắt đầu phiên mới'); await start(); };

async function answer(wrong = false) {
  const word = dom.container.querySelector('h2')!.textContent!;
  const synonym = word.replace('word', 'syn');
  const input = dom.container.querySelector('input');
  if (input) await change(input, wrong ? 'incorrect' : synonym);
  else {
    const options = [...dom.container.querySelectorAll<HTMLButtonElement>('[aria-label="Các lựa chọn synonym"] button')];
    await click(options.find(option => wrong ? !option.textContent?.includes(synonym) : option.textContent?.includes(synonym))!);
  }
  await press(input || dom.container.querySelector('[role="radiogroup"]') ? 'Kiểm tra đáp án' : /^Xác nhận đáp án/);
  await press(/^(Câu tiếp theo|Xem kết quả)/);
  return word;
}

async function finish(wrongCount = 0) {
  const words: string[] = [];
  while (!dom.container.textContent?.includes('Hoàn thành phiên ôn tập')) {
    if (words.length >= 20) throw new Error('Session did not finish');
    words.push(await answer(words.length < wrongCount));
  }
  return words;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(async () => { if (dom) await dom.unmount(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reuses real eligibility across setup, answers and views, refreshing for source and filter changes', async () => {
  const eligibility = vi.spyOn(service, 'getEligibleSynonymItems');
  const badgeCounts = vi.spyOn(service, 'getEligibleCountByMode');
  const words = vocabulary();
  await renderHome(words);
  const initialCalls = eligibility.mock.calls.length;
  expect(badgeCounts).toHaveBeenCalledTimes(4);
  await setup('Chọn đáp án');
  await press('20');
  await start();
  expect(await finish()).toHaveLength(12);
  await press('Về trang tổng quan');
  expect(eligibility).toHaveBeenCalledTimes(initialCalls);
  expect(badgeCounts).toHaveBeenCalledTimes(4);
  await dom.render(node([...words, ...vocabulary(6, 'b', 't2')]));
  expect(eligibility).toHaveBeenCalledTimes(initialCalls + 1);
  expect(badgeCounts).toHaveBeenCalledTimes(8);
  await setup('Chọn đáp án');
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện18 từ');
  await press(/^Topic B/);
  expect(eligibility).toHaveBeenCalledTimes(initialCalls + 2);
  expect(badgeCounts).toHaveBeenCalledTimes(12);
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện6 từ');
});

describe.each(labels)('%s real session lifecycle', label => {
  it('covers three normal sessions of 10, 10 and 3 before rolling the cycle', async () => {
    await renderHome(vocabulary(23)); await setup(label); await start();
    const first = await finish();
    await newSession(); const second = await finish();
    await newSession(); const third = await finish();
    expect([first.length, second.length, third.length]).toEqual([10, 10, 3]);
    expect(new Set([...first, ...second, ...third]).size).toBe(23);
    await newSession(); expect(await finish()).toHaveLength(10);
  });

  it('covers 10 then 2, keeps new-session settings, then rolls over in a different order', async () => {
    const planner = vi.spyOn(progression, 'planSessionTargets');
    await renderHome(); await setup(label); await press(/^Topic A/); await start();
    const first = await finish();
    expect(first).toHaveLength(10);
    // The UI must honor the real planner's explicit order, without a builder reshuffle.
    expect(first).toEqual(planner.mock.results[0].value.targets.map((item: { word: string }) => item.word));
    await press('Bắt đầu phiên mới');
    expect(dom.container.querySelector('select')?.value).toBe('all');
    expect(button(dom.container, /^Topic A/).className).toContain('bg-[#F472B6]');
    await start();
    const last = await finish();
    expect(last).toHaveLength(2);
    expect(new Set([...first, ...last]).size).toBe(12);
    await newSession();
    const rollover = await finish();
    expect(rollover).toHaveLength(10);
    expect(rollover).not.toEqual(first);
  });

  it('retries one wrong target using the full pool without consuming normal coverage', async () => {
    const record = vi.spyOn(progression, 'recordCompletedTargets');
    await renderHome(); await setup(label); await start();
    const first = await finish(1);
    const normalCalls = record.mock.calls.length;
    await press('Ôn lại câu sai');
    expect(dom.container.textContent).not.toContain('Hoàn thành phiên ôn tập');
    expect(dom.container.querySelector('h2')?.textContent).toBe(first[0]);
    expect(await finish()).toEqual([first[0]]);
    expect(normalCalls).toBeGreaterThan(0);
    expect(record).toHaveBeenCalledTimes(normalCalls);
    await newSession();
    const next = await finish();
    expect(next).toHaveLength(2);
    expect(next.every(word => !first.includes(word))).toBe(true);
  });

  it('leaves partially answered aborted targets unseen', async () => {
    await renderHome(); await setup(label); await start();
    const first = await answer();
    await press('Thoát session'); await setup(label); await start();
    const completed = await finish();
    expect(completed).toHaveLength(10);
    expect(completed[0]).toBe(first);
  });

  it('keeps an exhausted cycle unchanged when its retry completes', async () => {
    const record = vi.spyOn(progression, 'recordCompletedTargets');
    await renderHome(); await setup(label); await start(); await finish();
    await newSession(); const last = await finish(1);
    const normalCalls = record.mock.calls.length;
    await press('Ôn lại câu sai'); expect(await finish()).toEqual([last[0]]);
    expect(record).toHaveBeenCalledTimes(normalCalls);
    await newSession(); expect(await finish()).toHaveLength(10);
  });
});

async function finishMatching(synonymFor = (word: string) => word.replace('word', 'syn')) {
  const words = [...dom.container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].map(element => element.textContent!);
  for (const word of words) {
    await press(word); await press(synonymFor(word));
  }
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
  return words;
}

async function missMatchingThenFinish() {
  const shown = [...dom.container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].map(element => element.textContent!);
  await press(shown[0]); await press(shown[1].replace('word', 'syn'));
  await act(async () => vi.advanceTimersByTime(450));
  await finishMatching();
  return shown;
}

it('retries a real matching miss with exactly one previously shown support without consuming unseen coverage', async () => {
  vi.useFakeTimers();
  const record = vi.spyOn(progression, 'recordCompletedTargets');
  await renderHome(vocabulary(9)); await setup('Nối cặp'); await start();
  const shown = await missMatchingThenFinish();
  expect(dom.container.textContent).toContain('Số câu đúng7 / 8');
  expect(dom.container.textContent).toContain('Độ chính xác88%');
  expect([...dom.container.querySelectorAll('p')].some(p => p.textContent === `Bạn trả lời: ${shown[1].replace('word', 'syn')}`)).toBe(true);
  expect(button(dom.container, 'Ôn lại câu sai').disabled).toBe(false);
  const normalCalls = record.mock.calls.length;
  await press('Ôn lại câu sai');
  const retried = await finishMatching();
  expect(retried).toHaveLength(2);
  expect(retried[0]).toBe(shown[0]);
  expect(retried.filter(word => word !== shown[0])).toHaveLength(1);
  expect(retried.every(word => shown.includes(word))).toBe(true);
  expect(dom.container.textContent).toContain('Số câu đúng2 / 2');
  expect(button(dom.container, 'Ôn lại câu sai').disabled).toBe(true);
  expect(normalCalls).toBe(1);
  expect(record).toHaveBeenCalledTimes(normalCalls);
  await newSession();
  const next = await finishMatching();
  expect(next).toHaveLength(2);
  expect(next.filter(word => !shown.includes(word))).toHaveLength(1);
  expect(next.filter(word => shown.includes(word))).toHaveLength(1);
  expect(record.mock.calls[normalCalls][2]).toHaveLength(1);
});

it('explains missing-source retry for a real matching miss while retaining its captured result', async () => {
  vi.useFakeTimers();
  await renderHome(vocabulary(3)); await setup('Nối cặp'); await start();
  const shown = await missMatchingThenFinish();
  expect(button(dom.container, 'Ôn lại câu sai').disabled).toBe(false);
  await dom.render(node([]));
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
  expect(dom.container.textContent).toContain('Số câu đúng2 / 3');
  shown.forEach(word => expect(dom.container.textContent).toContain(word));
  const retry = button(dom.container, 'Ôn lại câu sai');
  expect(retry.disabled).toBe(true);
  const reason = document.getElementById(retry.getAttribute('aria-describedby')!);
  expect(reason?.textContent).toMatch(/Không thể ôn lại.*không còn/);
  await click(retry);
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
});

it('preserves a partially matched captured round when all source vocabulary disappears', async () => {
  const original = vocabulary(9);
  await renderHome(original); await setup('Nối cặp'); await start();
  const shown = [...dom.container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].map(element => element.textContent!);
  await press(shown[0]); await press(shown[0].replace('word', 'syn'));
  expect(button(dom.container, shown[0]).disabled).toBe(true);
  await dom.render(node([]));
  expect(dom.container.querySelectorAll('button[aria-pressed]')).toHaveLength(8);
  expect(button(dom.container, shown[0]).disabled).toBe(true);
  for (const word of shown.slice(1)) {
    await press(word); await press(word.replace('word', 'syn'));
  }
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
  shown.forEach(word => expect(dom.container.textContent).toContain(word));
  expect(button(dom.container, 'Ôn lại câu sai').disabled).toBe(true);
  await click(button(dom.container, 'Ôn lại câu sai'));
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
  // Restore a changed pool: only the unshown survivor and added vocabulary are unseen.
  const survivor = original.find(word => !shown.includes(word.word))!;
  await dom.render(node([survivor, ...vocabulary(2, 'new')]));
  await newSession();
  const next = await finishMatching();
  expect(next).toHaveLength(3);
  expect(next).toContain(survivor.word);
  expect(next).toContain('newword0');
  expect(next).toContain('newword1');
});

it('retains completed matching results and unavailable retry when the source is removed afterward', async () => {
  await renderHome(vocabulary(3)); await setup('Nối cặp'); await start();
  const shown = await finishMatching();
  await dom.render(node([]));
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
  shown.forEach(word => expect(dom.container.textContent).toContain(word));
  const retry = button(dom.container, 'Ôn lại câu sai');
  expect(retry.disabled).toBe(true);
  await click(retry);
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
});

it('advances matching through 8 unseen then one unseen with minimal seen support', async () => {
  const planner = vi.spyOn(progression, 'planSessionTargets');
  const record = vi.spyOn(progression, 'recordCompletedTargets');
  await renderHome(vocabulary(9)); await setup('Nối cặp'); await start();
  const first = await finishMatching();
  expect(first).toHaveLength(8);
  expect(planner.mock.results).toHaveLength(1);
  expect(first).toEqual(planner.mock.results[0].value.targets.slice(0, 8).map((item: { word: string }) => item.word));
  expect(record.mock.calls[0][2]).toHaveLength(8);
  await newSession(); const second = await finishMatching();
  expect(second).toHaveLength(2);
  expect(second.filter(word => first.includes(word))).toHaveLength(1);
  expect(new Set([...first, ...second]).size).toBe(9);
  expect(planner.mock.results[1].value.targets).toHaveLength(1);
  expect(record.mock.calls[1][2]).toHaveLength(1);
  await newSession(); expect(await finishMatching()).toHaveLength(8);
});

it('offers duplicate-word vocabulary in later matching rounds without identical left options', async () => {
  const record = vi.spyOn(progression, 'recordCompletedTargets');
  const words = vocabulary(3);
  await renderHome([...words, { ...words[0], id: 'duplicate' }]); await setup('Nối cặp'); await start();
  const first = await finishMatching();
  expect(first).toHaveLength(3);
  expect(new Set(first).size).toBe(3);
  await newSession(); const second = await finishMatching();
  expect(second).toHaveLength(2);
  expect(new Set(second).size).toBe(2);
  expect(new Set(record.mock.calls.flatMap(call => call[2])).size).toBe(4);
  await newSession(); expect(await finishMatching()).toHaveLength(3);
});

it('leaves an aborted matching round unseen and keeps matching scope separate from typing', async () => {
  await renderHome(vocabulary(9)); await setup('Nối cặp'); await start();
  const first = [...dom.container.querySelectorAll('button[aria-pressed]')].map(element => element.textContent);
  await press('Thoát session'); await setup('Nối cặp'); await start();
  expect(await finishMatching()).toEqual(first);
  await press('Về trang tổng quan'); await setup('Gõ đáp án'); await start();
  expect(await finish()).toHaveLength(9);
  await press('Về trang tổng quan'); await setup('Nối cặp'); await start();
  expect(await finishMatching()).toHaveLength(2);
});

it('covers colliding matching candidates in later rounds using the distinct previous partner', async () => {
  const record = vi.spyOn(progression, 'recordCompletedTargets');
  const words = vocabulary(9).map((word, index) => ({ ...word, synonyms: index < 8 ? 'shared' : 'asyn8' }));
  await renderHome(words); await setup('Nối cặp'); await start();
  const seen = new Set<string>();
  for (let round = 0; round < 8; round += 1) {
    const shown = await finishMatching(word => word === 'aword8' ? 'asyn8' : 'shared');
    expect(shown).toHaveLength(2);
    expect(shown).toContain('aword8');
    shown.forEach(word => seen.add(word));
    if (round < 7) await newSession();
  }
  expect(seen.size).toBe(9);
  expect(new Set(record.mock.calls.flatMap(call => call[2])).size).toBe(9);
  expect(record.mock.calls.slice(1).every(call => call[2].length === 1)).toBe(true);
});

it('excludes an individually unusable matching leftover so completion can start a new cycle', async () => {
  const record = vi.spyOn(progression, 'recordCompletedTargets');
  const words = vocabulary(3);
  words[0] = { ...words[0], word: 'aword1', synonyms: 'asyn2' };
  await renderHome(words); await setup('Nối cặp'); await start();
  expect(await finishMatching()).toHaveLength(2);
  expect(record.mock.calls[0][1]).toEqual(['a1', 'a2']);
  await newSession(); expect(await finishMatching()).toHaveLength(2);
  expect(record.mock.calls[1][3]).toBe(1);
});

it('restores matching coverage independently for collection and topic scopes', async () => {
  await renderHome([...vocabulary(9), ...vocabulary(9, 'b', 't2')]); await setup('Nối cặp');
  await change(dom.container.querySelector('select')!, 'c1'); await press(/^Topic A/); await start();
  const first = await finishMatching();
  await press('Bắt đầu phiên mới'); await press(/^Tất cả /); await start();
  expect(await finishMatching()).toHaveLength(8);
  await press('Bắt đầu phiên mới'); await change(dom.container.querySelector('select')!, 'c2'); await start();
  expect((await finishMatching()).every(word => word.startsWith('b'))).toBe(true);
  await press('Bắt đầu phiên mới'); await change(dom.container.querySelector('select')!, 'c1'); await press(/^Topic A/); await start();
  const resumed = await finishMatching();
  expect(resumed).toHaveLength(2);
  expect(resumed.filter(word => !first.includes(word))).toHaveLength(1);
});

it('keeps separate mode, collection and topic scopes, and restores each scope', async () => {
  await renderHome([...vocabulary(), ...vocabulary(12, 'b', 't2')]);
  await setup('Gõ đáp án');
  await change(dom.container.querySelector('select')!, 'c1');
  await press(/^Topic A/); await start(); const scoped = await finish();
  await press('Bắt đầu phiên mới');
  await press(/^Tất cả /); await start(); const collection = await finish();
  expect(collection).toHaveLength(10);
  await press('Bắt đầu phiên mới');
  await change(dom.container.querySelector('select')!, 'c2'); await start();
  expect((await finish()).every(word => word.startsWith('b'))).toBe(true);
  await press('Về trang tổng quan'); await setup('Chọn đáp án');
  await change(dom.container.querySelector('select')!, 'c1'); await press(/^Topic A/); await start();
  expect(await finish()).toHaveLength(10);
  await press('Về trang tổng quan'); await setup('Gõ đáp án'); await start();
  const resumed = await finish();
  expect(resumed).toHaveLength(2);
  expect(resumed.every(word => !scoped.includes(word))).toBe(true);
});

it('resets coverage when the component unmounts', async () => {
  await renderHome(); await setup('Gõ đáp án'); await start(); const first = await finish();
  await dom.unmount(); await renderHome(); await setup('Gõ đáp án'); await start();
  expect(await finish()).toEqual(first);
});

it('reconciles a changed pool while recording completion in the captured session scope', async () => {
  const record = vi.spyOn(progression, 'recordCompletedTargets');
  const original = vocabulary();
  await renderHome(original); await setup('Gõ đáp án'); await start();
  const firstWord = await answer();
  // Change props while the session is active: session questions remain the captured ones.
  await dom.render(node([...original.filter(word => word.word !== firstWord), ...vocabulary(1, 'new')]));
  const rest = await finish();
  expect(record.mock.calls[0][1]).toEqual(original.map(word => word.id));
  expect(record.mock.calls[0][2]).toHaveLength(10);
  await newSession(); const remaining = await finish();
  expect(remaining).toHaveLength(3);
  expect(remaining).toContain('newword0');
  expect(remaining.some(word => rest.includes(word))).toBe(false);
});

it.each(['Chọn đáp án', 'Chọn tất cả'] as const)('disables %s retry if the filtered pool loses distractors', async label => {
  await renderHome([...vocabulary(), ...vocabulary(12, 'b', 't2')]); await setup(label); await press(/^Topic A/); await start();
  const first = await finish(1);
  const wrong = vocabulary().find(word => word.word === first[0])!;
  await dom.render(node([wrong, ...vocabulary(12, 'b', 't2')]));
  expect(button(dom.container, 'Ôn lại câu sai').disabled).toBe(true);
  expect(dom.container.textContent).toMatch(/Không thể ôn lại.*lựa chọn/);
});

it.each(labels)('does not silently drop a missing incorrect target from %s retry', async label => {
  await renderHome(); await setup(label); await start();
  const completed = await finish(2);
  await dom.render(node(vocabulary().filter(word => word.word !== completed[0])));
  const retry = button(dom.container, 'Ôn lại câu sai');
  expect(retry.disabled).toBe(true);
  expect(dom.container.textContent).toMatch(/Không thể ôn lại.*không còn/);
  await click(retry);
  expect(dom.container.textContent).toContain('Hoàn thành phiên ôn tập');
});

it('keeps a captured non-matching session and its result if all source vocabulary disappears', async () => {
  await renderHome(); await setup('Gõ đáp án'); await start(); await answer(true);
  await dom.render(node([]));
  expect(dom.container.querySelector('input')).not.toBeNull();
  expect(await finish()).toHaveLength(9);
  expect(button(dom.container, 'Ôn lại câu sai').disabled).toBe(true);
  expect(dom.container.textContent).toMatch(/Không thể ôn lại.*không còn/);
});


it.each([
  { count: 0, expected: [0, 0, 0, 0] },
  { count: 1, expected: [0, 0, 0, 1] },
  { count: 4, expected: [4, 4, 0, 4] },
  { count: 6, expected: [6, 6, 6, 6] },
])('shows each mode eligibility for a filtered pool of $count words', async ({ count, expected }) => {
  await renderHome([...vocabulary(count), ...vocabulary(8, 'b', 't2')]);
  await change(dom.container.querySelector('select')!, 'c1');
  for (const [index, card] of [...dom.container.querySelectorAll('article')].entries()) {
    expect(card.textContent).toContain(expected[index] ? 'Có dữ liệu' : 'Chưa đủ dữ liệu');
    expect(card.textContent).toContain(`${expected[index]} từ theo bộ lọc`);
  }
  await change(topicChooser(), 't1');
  expect(dom.container.querySelectorAll('article')[3].textContent).toContain(`${count} từ theo bộ lọc`);
  await change(dom.container.querySelector('select')!, 'c2');
  for (const card of dom.container.querySelectorAll('article')) {
    expect(card.textContent).toContain('Có dữ liệu');
    expect(card.textContent).toContain('8 từ theo bộ lọc');
  }
});

it('does not advertise matching when all synonym labels collide', async () => {
  await renderHome(vocabulary(6).map(word => ({ ...word, synonyms: 'same' })));
  const card = [...dom.container.querySelectorAll('article')].find(article => article.querySelector('h3')?.textContent === 'Nối cặp')!;
  expect(card.textContent).toContain('Chưa đủ dữ liệu');
  expect(card.textContent).toContain('0 từ theo bộ lọc');
});

it('names the setup exit independently of its hidden mobile text', async () => {
  await renderHome(); await setup('Gõ đáp án');
  const exit = button(dom.container, 'Thoát');
  exit.querySelector('span')!.style.display = 'none';
  expect(exit.getAttribute('aria-label')).toBe('Thoát');
  await click(exit);
  expect(dom.container.textContent).toContain('Chọn mode luyện tập');
});

const fullTopics: Topic[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: `full${i + 1}`, collection_id: 'c1', title: `Full topic ${i + 1}`, description: '', icon: '' })),
  { id: 'empty', collection_id: 'c1', title: 'Empty topic', description: '', icon: '' }, topics[1],
];
const fullWords = [...vocabulary(4, 'ninth', 'full9'), ...vocabulary(2, 'other', 't2'), ...vocabulary(1, 'empty', 'empty').map(word => ({ ...word, synonyms: '' }))];
const fullNode = (selectedTopicId = 'all', sourceTopics = fullTopics, words = fullWords) => <ToastProvider><SynonymPractice
  vocabularies={words} topics={sourceTopics} collections={collections} selectedTopicId={selectedTopicId}
  onOpenEditVocabulary={() => {}} onOpenVocabularyManager={() => {}}
/></ToastProvider>;
function topicChooser() {
  const label = [...dom.container.querySelectorAll('label')].find(element => element.textContent?.startsWith('Chọn từ tất cả học phần'));
  expect(label, 'visible associated full-topic label').toBeDefined();
  return label!.querySelector('select')!;
}

it.each([false, true])('retains a requested empty topic (entire pool empty: %s)', async entirePoolEmpty => {
  dom = await mount(fullNode('empty', fullTopics, entirePoolEmpty ? fullWords.filter(word => word.topic_id === 'empty') : fullWords));
  expect(dom.container.textContent).toContain('0 từ theo bộ lọc');
  expect(topicChooser().value).toBe('empty');
  expect(dom.container.querySelector('[role="status"]')?.textContent).toContain('bộ lọc');
  await setup('Gõ đáp án');
  expect(topicChooser().value).toBe('empty');
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện0 từ');
  expect(dom.container.querySelector('[role="status"]')?.textContent).toContain('bộ lọc');
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(true);
  await press('Thoát'); expect(topicChooser().value).toBe('empty');
});

it('falls back to all for a nonexistent requested topic', async () => {
  dom = await mount(fullNode('nonexistent'));
  expect(dom.container.textContent).toContain('6 từ theo bộ lọc');
  expect(topicChooser().value).toBe('all');
});

it('selects the ninth topic with synonyms and retains scope through setup, back and session', async () => {
  dom = await mount(fullNode());
  expect(dom.container.querySelector('[aria-label="Chọn học phần nhanh"]')?.querySelectorAll('button')).toHaveLength(7);
  await change(topicChooser(), 'full9');
  expect(dom.container.textContent).toContain('4 từ theo bộ lọc');
  await setup('Gõ đáp án'); expect(topicChooser().value).toBe('full9');
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện4 từ');
  await press('Thoát'); expect(topicChooser().value).toBe('full9');
  await setup('Gõ đáp án'); await start();
  expect(await finish()).toEqual(expect.arrayContaining(['ninthword0', 'ninthword1', 'ninthword2', 'ninthword3']));
});

it('scopes all-chip counts to collection and clears stale topics when collection changes', async () => {
  dom = await mount(fullNode('full9'));
  await change(dom.container.querySelector('select')!, 'c1');
  expect(button(dom.container, /^Tất cả /).textContent).toBe('Tất cả 4');
  expect(topicChooser().value).toBe('all');
  expect([...topicChooser().options].map(option => option.value)).toContain('empty');
  expect([...topicChooser().options].map(option => option.value)).not.toContain('t2');
  await change(topicChooser(), 'empty');
  await change(dom.container.querySelector('select')!, 'c2');
  expect(topicChooser().value).toBe('all');
  expect(button(dom.container, /^Tất cả /).textContent).toBe('Tất cả 2');
  await setup('Gõ đáp án'); expect(button(dom.container, /^Tất cả /).textContent).toBe('Tất cả 2');
});

it.each(['home', 'setup'])('clears removed source topics from %s selectors', async view => {
  dom = await mount(fullNode('full9'));
  if (view === 'setup') await setup('Gõ đáp án');
  await dom.render(fullNode('full9', fullTopics.filter(topic => topic.id !== 'full9'), fullWords.filter(word => word.topic_id !== 'full9')));
  expect(topicChooser().value).toBe('all');
  expect([...topicChooser().options].map(option => option.value)).not.toContain('full9');
  expect(dom.container.textContent).toContain(view === 'home' ? '2 từ theo bộ lọc' : 'Vocabulary đủ điều kiện2 từ');
});

it.each(['topic', 'collection'] as const)('preserves answers, results and captured coverage when the selected %s is removed', async removed => {
  const record = vi.spyOn(progression, 'recordCompletedTargets');
  const words = [...vocabulary(), ...vocabulary(6, 'b', 't2')];
  const render = (sourceTopics = topics, sourceCollections = collections) => <ToastProvider><SynonymPractice
    vocabularies={words} topics={sourceTopics} collections={sourceCollections}
    onOpenEditVocabulary={() => {}} onOpenVocabularyManager={() => {}}
  /></ToastProvider>;
  dom = await mount(render()); await setup('Gõ đáp án');
  await change(dom.container.querySelector('select')!, 'c1'); await press(/^Topic A/); await start();
  const first = await answer(true);
  const currentWord = dom.container.querySelector('h2')?.textContent;
  const sourceTopics = removed === 'topic' ? [topics[1]] : topics;
  const sourceCollections = removed === 'collection' ? [collections[1]] : collections;
  await dom.render(render(sourceTopics, sourceCollections));
  expect(dom.container.querySelector('h2')?.textContent).toBe(currentWord);
  expect(await finish()).toHaveLength(9);
  expect(dom.container.textContent).toContain(first);
  expect(dom.container.textContent).toContain('90%');
  expect(record.mock.calls).toHaveLength(1);
  expect(record.mock.calls[0][0]).toEqual({ cycle: 0, seenIds: [], orderIds: [] });
  expect(record.mock.calls[0][1]).toEqual(vocabulary().map(word => word.id));
  expect(record.mock.calls[0][2]).toHaveLength(10);
  // A second source update while viewing results must preserve the captured result.
  await dom.render(render([topics[1]], [collections[1]]));
  expect(dom.container.textContent).toContain('90%');
  expect(dom.container.textContent).toContain(first);
  await press('Bắt đầu phiên mới');
  expect(dom.container.querySelector('select')?.value).toBe('all');
  expect(topicChooser().value).toBe('all');
});
