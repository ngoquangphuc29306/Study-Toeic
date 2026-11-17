// @vitest-environment jsdom
import { act, createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { TypingExercise } from './TypingExercise';
import { button, change, click, mount } from '../../features/synonym-practice/components/test-utils/dom';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const vocabulary = { id: 'one', word: 'Word', meaning: 'meaning', topic_id: 'topic', part_of_speech: 'noun' };
const mounted: Array<Awaited<ReturnType<typeof mount>>> = [];
afterEach(async () => { for (const dom of mounted) await dom.unmount(); });

it('preserves controlled input, hint, feedback ref, and guarded Enter', async () => {
  const inputRef = createRef<HTMLInputElement>();
  const feedbackRef = createRef<HTMLDivElement>();
  const onChange = vi.fn();
  const check = vi.fn();
  const hint = vi.fn();
  const props = { currentVocab: vocabulary, showPartOfSpeech: true, typedInput: '', typingSubmitted: false, isTypingCorrect: null, showHint: false, typingInputRef: inputRef, typingFeedbackRef: feedbackRef, onTypedInputChange: onChange, onCheckTyping: check, onToggleHint: hint };
  const dom = await mount(<TypingExercise {...props} />);
  mounted.push(dom);
  expect(inputRef.current).toBe(dom.container.querySelector('input'));
  await change(inputRef.current!, 'Word');
  expect(onChange).toHaveBeenCalledWith('Word');
  await click(button(dom.container, 'Kiểm tra'));
  expect(check).toHaveBeenCalledTimes(1);
  await act(async () => { inputRef.current!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, repeat: true })); });
  expect(check).toHaveBeenCalledTimes(1);
  await dom.render(<TypingExercise {...props} typedInput="Word" typingSubmitted isTypingCorrect showHint />);
  expect(feedbackRef.current?.textContent).toContain('Chính xác! Word');
  expect(dom.container.textContent).toContain('Gợi ý:');
});
