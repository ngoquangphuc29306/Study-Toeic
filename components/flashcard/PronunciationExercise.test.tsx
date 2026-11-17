// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PronunciationExercise } from './PronunciationExercise';
import { button, click, mount } from '../../features/synonym-practice/components/test-utils/dom';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const vocabulary = { id: 'one', word: 'Word', meaning: 'meaning', topic_id: 'topic' };
const mounted: Array<Awaited<ReturnType<typeof mount>>> = [];
afterEach(async () => { for (const dom of mounted) await dom.unmount(); });

it('renders idle, recording, and technical failure controls through callbacks', async () => {
  const start = vi.fn(); const stop = vi.fn(); const skip = vi.fn(); const play = vi.fn();
  const props = { currentVocab: vocabulary, isRecording: false, pronounceSubmitted: false, isPronounceCorrect: false, isPronunciationTechnicalIssue: false, pronunciationFeedback: { title: '', detail: '' }, transcriptText: '', onStartRecording: start, onStopRecording: stop, onSkip: skip, onPlayPronunciation: play };
  const dom = await mount(<PronunciationExercise {...props} />);
  mounted.push(dom);
  await click(dom.container.querySelector('button')!);
  expect(start).toHaveBeenCalledOnce();
  await dom.render(<PronunciationExercise {...props} isRecording />);
  await click(dom.container.querySelector('button')!);
  expect(stop).toHaveBeenCalledOnce();
  await dom.render(<PronunciationExercise {...props} pronounceSubmitted isPronunciationTechnicalIssue pronunciationFeedback={{ title: 'Không thể nhận diện', detail: 'Vui lòng thử lại.' }} />);
  expect(dom.container.textContent).toContain('Không thể nhận diện');
  await click(button(dom.container, 'Thử lại'));
  expect(start).toHaveBeenCalledTimes(2);
  await click(button(dom.container, 'Bỏ qua'));
  expect(skip).toHaveBeenCalledOnce();
  await click(button(dom.container, 'Nghe phát âm'));
  expect(play).toHaveBeenCalledWith('Word');
});
