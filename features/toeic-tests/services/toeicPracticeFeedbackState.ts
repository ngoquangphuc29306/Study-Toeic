import type { ToeicAutosaveStatus } from './toeicAutosaveController';

export function canCheckToeicPracticeAnswer(input: {
  isPractice: boolean;
  hasSelectedAnswer: boolean;
  canMutate: boolean;
  hasFeedback: boolean;
  loading: boolean;
  autosaveStatus: ToeicAutosaveStatus;
}): boolean {
  return input.isPractice && input.hasSelectedAnswer && input.canMutate && !input.hasFeedback && !input.loading &&
    input.autosaveStatus !== 'pending' && input.autosaveStatus !== 'saving' && input.autosaveStatus !== 'error';
}
