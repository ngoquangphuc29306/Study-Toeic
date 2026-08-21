import { describe, expect, it } from 'vitest';
import { canCheckToeicPracticeAnswer } from './toeicPracticeFeedbackState';

const base = { isPractice: true, hasSelectedAnswer: true, canMutate: true, hasFeedback: false, loading: false } as const;

describe('TOEIC practice feedback gate', () => {
  it('opens only after a saved answer state is available', () => {
    expect(canCheckToeicPracticeAnswer({ ...base, autosaveStatus: 'saved' })).toBe(true);
    expect(canCheckToeicPracticeAnswer({ ...base, autosaveStatus: 'idle' })).toBe(true);
    expect(canCheckToeicPracticeAnswer({ ...base, autosaveStatus: 'pending' })).toBe(false);
    expect(canCheckToeicPracticeAnswer({ ...base, autosaveStatus: 'error' })).toBe(false);
  });

  it('blocks exam, empty, loading, and already checked states', () => {
    expect(canCheckToeicPracticeAnswer({ ...base, isPractice: false, autosaveStatus: 'saved' })).toBe(false);
    expect(canCheckToeicPracticeAnswer({ ...base, hasSelectedAnswer: false, autosaveStatus: 'saved' })).toBe(false);
    expect(canCheckToeicPracticeAnswer({ ...base, loading: true, autosaveStatus: 'saved' })).toBe(false);
    expect(canCheckToeicPracticeAnswer({ ...base, hasFeedback: true, autosaveStatus: 'saved' })).toBe(false);
  });
});
