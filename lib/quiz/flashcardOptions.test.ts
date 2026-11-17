import { describe, expect, it } from 'vitest';
import type { Vocabulary } from '../types';
import { createFlashcardQuizOptions } from './flashcardOptions';

const vocab = (id: string, meaning: string): Vocabulary => ({ id, topic_id: 'topic', word: id, meaning, part_of_speech: 'noun' });
const current = vocab('one', 'Answer');

describe('createFlashcardQuizOptions', () => {
  it('uses the existing seeded choice order for four unique labels', () => {
    const result = createFlashcardQuizOptions(current, [current, vocab('two', 'Two'), vocab('three', 'Three'), vocab('four', 'Four'), vocab('five', 'Five')]);
    expect(result).toEqual({ options: ['Three', 'Two', 'Answer', 'Five'], correctAnswerIndex: 2 });
    expect(result.options.filter(label => label === 'Answer')).toHaveLength(1);
    expect(result).toEqual(createFlashcardQuizOptions(current, [current, vocab('two', 'Two'), vocab('three', 'Three'), vocab('four', 'Four'), vocab('five', 'Five')]));
  });
  it('reserves correct label before case and whitespace deduplication', () => {
    const result = createFlashcardQuizOptions(current, [current, vocab('x', ' answer '), vocab('y', 'ANSWER'), vocab('z', 'Other')]);
    expect(result.options).toEqual(expect.arrayContaining(['Answer', 'Other']));
    expect(result.options).toHaveLength(2);
    expect(result.options[result.correctAnswerIndex]).toBe('Answer');
  });
  it.each([1, 2, 3])('returns %i unique choices when the pool is small', (count) => {
    const pool = [current, ...['A', 'B'].slice(0, count - 1).map((label, index) => vocab(String(index), label))];
    const result = createFlashcardQuizOptions(current, pool);
    expect(result.options).toHaveLength(count);
    expect(result.options[result.correctAnswerIndex]).toBe('Answer');
  });
  it('returns no options for missing or blank current meaning and empty pool', () => {
    expect(createFlashcardQuizOptions(undefined, [])).toEqual({ options: [], correctAnswerIndex: 0 });
    expect(createFlashcardQuizOptions(vocab('blank', '  '), [vocab('blank', '  ')])).toEqual({ options: [], correctAnswerIndex: 0 });
    expect(createFlashcardQuizOptions(current, [])).toEqual({ options: [], correctAnswerIndex: 0 });
  });
});
