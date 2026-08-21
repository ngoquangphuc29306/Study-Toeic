import type { ToeicAttemptQuestionRef } from '../attemptContracts';

export type ToeicPaletteFilter = 'all' | 'answered' | 'unanswered' | 'flagged';

export interface ToeicPaletteAnswerState {
  selectedAnswer: string | null;
  isFlagged: boolean;
}

/**
 * Presentation-only filter for the question palette. It deliberately accepts
 * no correctness field so the workspace cannot surface answer-key information
 * before an authorised learning/review response.
 */
export function filterToeicPaletteQuestions(
  questions: ReadonlyArray<ToeicAttemptQuestionRef>,
  answers: Readonly<Record<string, ToeicPaletteAnswerState>>,
  filter: ToeicPaletteFilter
): ReadonlyArray<ToeicAttemptQuestionRef> {
  if (filter === 'all') return questions;

  return questions.filter((question) => {
    const answer = answers[question.questionId] ?? { selectedAnswer: null, isFlagged: false };
    if (filter === 'answered') return answer.selectedAnswer !== null;
    if (filter === 'unanswered') return answer.selectedAnswer === null;
    return answer.isFlagged;
  });
}
