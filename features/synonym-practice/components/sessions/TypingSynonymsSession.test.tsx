// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mapVocabularyToSynonymItems } from '../../services/synonymPracticeService';
import type { SynonymPracticeResult } from '../../types';
import { button, change, click, mount } from '../test-utils/dom';
import { TypingSynonymsSession } from './TypingSynonymsSession';

let dom: Awaited<ReturnType<typeof mount>>;
let results: SynonymPracticeResult[];
const items = mapVocabularyToSynonymItems([
  { id: 'a', word: 'rapid', meaning: 'nhanh', synonyms: 'fast', topic_id: 't' },
  { id: 'b', word: 'large', meaning: 'lớn', synonyms: 'big', topic_id: 't' },
  { id: 'c', word: 'small', meaning: 'nhỏ', synonyms: 'tiny', topic_id: 't' },
], [], []);
const input = () => dom.container.querySelector('input')!;
const enter = async (options: KeyboardEventInit = {}) => {
  await act(async () => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options }));
  });
};
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  results = [];
  dom = await mount(<TypingSynonymsSession items={items} onComplete={result => results.push(result)} onExit={() => {}} />);
});
afterEach(async () => { await dom.unmount(); vi.unstubAllGlobals(); });

it('keeps the submitted input focusable and advances with the second Enter, preserving score', async () => {
  await change(input(), 'fast'); await enter();
  expect(input().disabled).toBe(false);
  expect(input().readOnly).toBe(true);
  input().blur(); input().focus();
  expect(document.activeElement).toBe(input());
  expect(dom.container.textContent).toContain('Điểm 1');
  await enter();
  expect(dom.container.querySelector('h2')?.textContent).toBe('large');
  expect(input().readOnly).toBe(false);
  expect(input().value).toBe('');
  expect(document.activeElement).toBe(input());
  await change(input(), 'wrong'); await enter(); await enter();
  await change(input(), 'tiny'); await enter(); await enter();
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ totalQuestions: 3, correctAnswers: 2, scorePercentage: 67, bestStreak: 1 });
  expect(results[0].answers.map(answer => answer.userAnswers)).toEqual([['fast'], ['wrong'], ['tiny']]);
});

it('restores focus after a mouse click on Next', async () => {
  await change(input(), 'fast'); await enter();
  const next = button(dom.container, 'Câu tiếp theo');
  next.focus(); await click(next);
  expect(document.activeElement).toBe(input());
  expect(dom.container.querySelector('h2')?.textContent).toBe('large');
});

it('ignores composing and repeated Enter without recording or advancing twice', async () => {
  await change(input(), 'fast');
  await enter({ isComposing: true });
  expect(dom.container.textContent).not.toContain('Chính xác!');
  await enter({ repeat: true });
  expect(dom.container.textContent).not.toContain('Chính xác!');
  await enter();
  await enter({ repeat: true }); await enter({ isComposing: true });
  expect(dom.container.querySelector('h2')?.textContent).toBe('rapid');
  await enter();
  expect(dom.container.querySelector('h2')?.textContent).toBe('large');
  expect(dom.container.textContent).toContain('Điểm 1');
});
