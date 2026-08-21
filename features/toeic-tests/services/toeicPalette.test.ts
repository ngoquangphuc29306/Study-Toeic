import { describe, expect, it } from 'vitest';
import { filterToeicPaletteQuestions } from './toeicPalette';

const questions = [
  { questionId: 'question-1', part: 5, position: 1 },
  { questionId: 'question-2', part: 5, position: 2 },
  { questionId: 'question-3', part: 5, position: 3 },
] as const;

const answers = {
  'question-1': { selectedAnswer: 'A', isFlagged: false },
  'question-2': { selectedAnswer: null, isFlagged: true },
};

describe('filterToeicPaletteQuestions', () => {
  it('filters only local answer and flag state without a correctness input', () => {
    expect(filterToeicPaletteQuestions(questions, answers, 'all').map((question) => question.questionId))
      .toEqual(['question-1', 'question-2', 'question-3']);
    expect(filterToeicPaletteQuestions(questions, answers, 'answered').map((question) => question.questionId))
      .toEqual(['question-1']);
    expect(filterToeicPaletteQuestions(questions, answers, 'unanswered').map((question) => question.questionId))
      .toEqual(['question-2', 'question-3']);
    expect(filterToeicPaletteQuestions(questions, answers, 'flagged').map((question) => question.questionId))
      .toEqual(['question-2']);
  });
});
