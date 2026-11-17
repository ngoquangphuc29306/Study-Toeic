import type { Vocabulary } from '../types';
import { uniqueQuizLabels } from './labels';
import { seededShuffle } from './seededShuffle';

export function createFlashcardQuizOptions(
  current: Vocabulary | undefined,
  activeVocabulary: readonly Vocabulary[],
): { options: string[]; correctAnswerIndex: number } {
  if (!current || !current.meaning.trim() || activeVocabulary.length === 0) {
    return { options: [], correctAnswerIndex: 0 };
  }
  const distractors = activeVocabulary.filter(v => v.id !== current.id).map(v => v.meaning);
  const distinctMeanings = uniqueQuizLabels([current.meaning, ...distractors]);
  const seededDistractors = seededShuffle(distinctMeanings.slice(1), current.id + '_distractors').slice(0, 3);
  const options = seededShuffle([current.meaning, ...seededDistractors], current.id + '_choices');
  return { options, correctAnswerIndex: options.indexOf(current.meaning) };
}
