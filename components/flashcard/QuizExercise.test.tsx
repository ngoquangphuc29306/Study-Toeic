// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { QuizExercise } from './QuizExercise';
import { button, click, mount } from '../../features/synonym-practice/components/test-utils/dom';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const vocabulary = { id: 'one', word: 'word', meaning: 'meaning', topic_id: 'topic', phonetic_us: '/wɜːd/', part_of_speech: 'noun' };
const mounted: Array<Awaited<ReturnType<typeof mount>>> = [];
afterEach(async () => { for (const dom of mounted) await dom.unmount(); });

it('renders choices and feedback with unchanged option hooks and click callback', async () => {
  const select = vi.fn();
  const dom = await mount(<QuizExercise currentVocab={vocabulary} showPartOfSpeech quizOptions={['meaning', 'other']} correctQuizIndex={0} selectedQuizIndex={null} quizAnswered={false} onPlayPronunciation={vi.fn()} onQuizSelect={select} />);
  mounted.push(dom);
  expect(dom.container.querySelectorAll('[data-flash-quiz-option]')).toHaveLength(2);
  await click(button(dom.container, '1meaning'));
  expect(select).toHaveBeenCalledWith(0);
  await dom.render(<QuizExercise currentVocab={vocabulary} showPartOfSpeech quizOptions={['meaning', 'other']} correctQuizIndex={0} selectedQuizIndex={1} quizAnswered onPlayPronunciation={vi.fn()} onQuizSelect={select} />);
  expect(dom.container.querySelector('[data-flash-quiz-feedback]')?.textContent).toContain('Chưa đúng!');
  expect(dom.container.querySelectorAll('button:disabled')).toHaveLength(2);
});
