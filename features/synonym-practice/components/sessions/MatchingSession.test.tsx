// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchingQuestion, SynonymPracticeResult } from '../../types';
import { button, click, mount } from '../test-utils/dom';
import { MatchingSession } from './MatchingSession';

let dom: Awaited<ReturnType<typeof mount>>;
let results: SynonymPracticeResult[];
const question = (count = 2): MatchingQuestion => ({
  id: 'matching-fixture',
  pairs: Array.from({ length: count }, (_, index) => ({
    id: `pair-${index}`, synonym: `synonym ${index}`,
    item: { vocabularyId: `v${index}`, word: `word ${index}`, meaning: `meaning ${index}`,
      synonyms: [`synonym ${index}`],
      source: { id: `v${index}`, word: `word ${index}`, meaning: `meaning ${index}`, synonyms: `synonym ${index}`, topic_id: 't1', part_of_speech: 'noun' },
    },
  })),
});
const render = async (count = 2) => {
  dom = await mount(<MatchingSession question={question(count)} onComplete={result => results.push(result)} onExit={() => {}} />);
};
const choose = async (left: number, right: number) => {
  await click(button(dom.container, `word ${left}`));
  await click(button(dom.container, `synonym ${right}`));
};
const clearWrong = async () => { await act(async () => vi.advanceTimersByTime(450)); };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  results = [];
});
afterEach(async () => {
  if (dom) await dom.unmount();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('matching first-attempt accuracy with the real session hook', () => {
  it('keeps a newer left selection when the old wrong-attempt deadline passes', async () => {
    await render(3); await choose(0, 1);
    await act(async () => vi.advanceTimersByTime(200));
    await click(button(dom.container, 'word 2'));
    await clearWrong();
    expect(button(dom.container, 'word 2').getAttribute('aria-pressed')).toBe('true');
    await click(button(dom.container, 'synonym 2'));
    expect(button(dom.container, 'word 2').disabled).toBe(true);
    await choose(0, 0); await choose(1, 1);
    expect(results[0]).toMatchObject({ correctAnswers: 2, scorePercentage: 67 });
  });

  it('gives a newer wrong attempt its full 450ms feedback window', async () => {
    await render(3); await choose(0, 1);
    await act(async () => vi.advanceTimersByTime(300));
    await click(button(dom.container, 'synonym 2'));
    await act(async () => vi.advanceTimersByTime(449));
    expect(dom.container.textContent).toContain('Chưa đúng, hãy thử lại.');
    expect(button(dom.container, 'word 0').getAttribute('aria-pressed')).toBe('true');
    await act(async () => vi.advanceTimersByTime(1));
    expect(dom.container.textContent).not.toContain('Chưa đúng, hãy thử lại.');
    expect(button(dom.container, 'word 0').getAttribute('aria-pressed')).toBe('false');
  });

  it('clears wrong feedback on a correct match and protects the next selection', async () => {
    await render(3); await choose(0, 1);
    await click(button(dom.container, 'synonym 0'));
    expect(dom.container.textContent).not.toContain('Chưa đúng, hãy thử lại.');
    await click(button(dom.container, 'word 2')); await clearWrong();
    expect(button(dom.container, 'word 2').getAttribute('aria-pressed')).toBe('true');
  });

  it('cancels pending feedback on unmount', async () => {
    await render(); await choose(0, 1);
    await dom.unmount();
    expect(vi.getTimerCount()).toBe(0);
    // afterEach still owns cleanup of a mounted root.
    await render(); await clearWrong();
    expect(button(dom.container, 'word 0').getAttribute('aria-pressed')).toBe('false');
  });

  it('scores one first-correct and one wrong-then-right pair as 50% with the first right LABEL', async () => {
    await render();
    await choose(1, 0); await clearWrong();
    await choose(0, 0); await choose(1, 1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ mode: 'matching', totalQuestions: 2, correctAnswers: 1, scorePercentage: 50 });
    expect(results[0].answers).toEqual([
      { vocabularyId: 'v1', word: 'word 1', userAnswers: ['synonym 0'], correctAnswers: ['synonym 1'], isCorrect: false },
      { vocabularyId: 'v0', word: 'word 0', userAnswers: ['synonym 0'], correctAnswers: ['synonym 0'], isCorrect: true },
    ]);
    expect(results[0].answers.filter(answer => !answer.isCorrect).map(answer => answer.vocabularyId)).toEqual(['v1']);
  });

  it('keeps one row per pair and the original label after repeated different wrong attempts', async () => {
    await render(3);
    await choose(0, 1); await clearWrong();
    await choose(0, 2); await clearWrong();
    await choose(0, 1); await clearWrong();
    await choose(0, 0); await choose(1, 1); await choose(2, 2);
    expect(results).toHaveLength(1);
    expect(results[0].answers).toHaveLength(3);
    expect(new Set(results[0].answers.map(answer => answer.vocabularyId)).size).toBe(3);
    expect(results[0].answers[0]).toMatchObject({ vocabularyId: 'v0', userAnswers: ['synonym 1'], isCorrect: false });
    expect(results[0]).toMatchObject({ correctAnswers: 2, scorePercentage: 67 });
  });

  it('reports 100% when every first attempt is correct, including the synchronous final pair', async () => {
    await render();
    await choose(1, 1); await choose(0, 0);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ totalQuestions: 2, correctAnswers: 2, scorePercentage: 100, bestStreak: 2 });
    expect(results[0].answers.map(answer => answer.vocabularyId)).toEqual(['v1', 'v0']);
  });

  it('does not finish after all first attempts until every pair is eventually matched', async () => {
    await render();
    await choose(1, 0); await clearWrong(); await choose(0, 0);
    expect(results).toHaveLength(0);
    expect(button(dom.container, 'word 0').disabled).toBe(true);
    expect(button(dom.container, 'word 1').disabled).toBe(false);
    await click(button(dom.container, 'synonym 1'));
    expect(results).toHaveLength(0);
    await choose(1, 1);
    expect(results).toHaveLength(1);
  });

  it('computes first-correct streaks in attempt order rather than board or final-match order', async () => {
    await render(4);
    await choose(2, 2);
    await choose(0, 1); await clearWrong();
    await choose(1, 1); await choose(3, 3); await choose(0, 0);
    expect(results[0]).toMatchObject({ correctAnswers: 3, scorePercentage: 75, bestStreak: 2 });
    expect(results[0].answers.map(answer => answer.vocabularyId)).toEqual(['v2', 'v0', 'v1', 'v3']);
  });
});
