// @vitest-environment jsdom
import { createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { FlashcardExercise } from './FlashcardExercise';
import { button, click, mount } from '../../features/synonym-practice/components/test-utils/dom';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const vocabulary = { id: 'one', word: 'Word', meaning: 'meaning', topic_id: 'topic', phonetic_us: '/word/', phonetic_uk: '/wɜːd/', example: 'Example', example_translation: 'Ví dụ', collocations: 'word pair', synonyms: 'term', part_of_speech: 'noun' };
const mounted: Array<Awaited<ReturnType<typeof mount>>> = [];
afterEach(async () => { for (const dom of mounted) await dom.unmount(); });

it('keeps the animation ref, card faces, click flip, and nested audio stopPropagation', async () => {
  const cardRef = createRef<HTMLDivElement>(); const flip = vi.fn(); const play = vi.fn();
  const props = { currentVocab: vocabulary, isFlipped: false, showPartOfSpeech: true, showExamples: true, showCollocations: true, showSynonyms: true, cardTransitionRef: cardRef, onFlip: flip, onPlayPronunciation: play };
  const dom = await mount(<FlashcardExercise {...props} />);
  mounted.push(dom);
  expect(cardRef.current).toBe(dom.container.firstElementChild);
  expect(dom.container.textContent).toContain('meaning');
  await click(button(dom.container, /US/));
  expect(play).toHaveBeenCalledWith('Word', 'en-US');
  expect(flip).not.toHaveBeenCalled();
  await click(cardRef.current!.firstElementChild as HTMLElement);
  expect(flip).toHaveBeenCalledOnce();
  await dom.render(<FlashcardExercise {...props} isFlipped showExamples={false} showSynonyms={false} />);
  expect(cardRef.current?.querySelector('[class*="rotateY(180deg)"]')).not.toBeNull();
  expect(dom.container.textContent).not.toContain('Example');
});
