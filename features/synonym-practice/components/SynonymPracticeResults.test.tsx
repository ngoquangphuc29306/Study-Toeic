// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SynonymPracticeResults } from './SynonymPracticeResults';
import type { SynonymPracticeResult } from '../types';
import { button, click, mount } from './test-utils/dom';

let dom: Awaited<ReturnType<typeof mount>>;
const result: SynonymPracticeResult = { mode: 'multiple-choice', totalQuestions: 1, correctAnswers: 0, scorePercentage: 0, elapsedSeconds: 2, bestStreak: 0,
  answers: [{ vocabularyId: '1', word: 'fast', userAnswers: ['slow'], correctAnswers: ['quick'], isCorrect: false }],
};
beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
afterEach(async () => { await dom.unmount(); vi.unstubAllGlobals(); });

it('disables unavailable retry and associates its explanation with the button', async () => {
  let retries = 0;
  dom = await mount(<SynonymPracticeResults result={result} hasIncorrect retryAvailable={false} retryUnavailableReason="Không thể ôn lại: bộ lọc hiện tại không đủ lựa chọn." onRetryIncorrect={() => retries++} onNewSession={() => {}} onHome={() => {}} />);
  const retry = button(dom.container, 'Ôn lại câu sai');
  expect(retry.disabled).toBe(true);
  const reason = document.getElementById(retry.getAttribute('aria-describedby') || '');
  expect(reason?.textContent).toContain('không đủ lựa chọn');
  await click(retry); expect(retries).toBe(0);
});

it.each([true, false])('allows retry only with incorrect answers (hasIncorrect=%s)', async hasIncorrect => {
  let retries = 0;
  dom = await mount(<SynonymPracticeResults result={result} hasIncorrect={hasIncorrect} retryAvailable onRetryIncorrect={() => retries++} onNewSession={() => {}} onHome={() => {}} />);
  await click(button(dom.container, 'Ôn lại câu sai'));
  expect(retries).toBe(hasIncorrect ? 1 : 0);
});
