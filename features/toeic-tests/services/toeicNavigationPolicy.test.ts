import { describe, expect, it } from 'vitest';
import { decideToeicNavigation } from './toeicNavigationPolicy';

const base = {
  mode: 'exam' as const,
  currentPart: 3 as const,
  targetPart: 3 as const,
  currentPosition: 31,
  targetPosition: 32,
  currentMediaGroupKey: 'passage:p3',
  targetMediaGroupKey: 'passage:p3',
  mediaHasStarted: true,
  mediaHasEnded: false,
};

describe('decideToeicNavigation', () => {
  it('keeps Practice navigation unrestricted', () => {
    expect(decideToeicNavigation({ ...base, mode: 'practice', action: 'previous' }).allowed).toBe(true);
  });

  it('denies manual Listening navigation and palette jumps in Exam', () => {
    for (const action of ['previous', 'next', 'palette-jump', 'part-jump'] as const) {
      expect(decideToeicNavigation({ ...base, action }).allowed).toBe(false);
    }
  });

  it('allows selecting another question inside the current shared group', () => {
    expect(decideToeicNavigation({ ...base, action: 'group-question' }).allowed).toBe(true);
  });

  it('allows only ended-media auto-advance to the next group', () => {
    expect(decideToeicNavigation({ ...base, action: 'auto-advance', targetPosition: 35, targetMediaGroupKey: 'passage:p4', mediaHasEnded: true }).allowed).toBe(true);
    expect(decideToeicNavigation({ ...base, action: 'auto-advance', targetPosition: 35, targetMediaGroupKey: 'passage:p4' }).allowed).toBe(false);
  });

  it('allows Reading navigation but never a jump back to Listening', () => {
    expect(decideToeicNavigation({ ...base, currentPart: 5, targetPart: 7, currentPosition: 100, targetPosition: 150, currentMediaGroupKey: 'question:100', targetMediaGroupKey: 'passage:p7', action: 'palette-jump' }).allowed).toBe(true);
    expect(decideToeicNavigation({ ...base, currentPart: 5, targetPart: 4, currentPosition: 100, targetPosition: 70, currentMediaGroupKey: 'question:100', targetMediaGroupKey: 'passage:p4', action: 'previous' }).allowed).toBe(false);
  });

  it('allows the Listening-to-Reading transition only through ended media', () => {
    expect(decideToeicNavigation({ ...base, action: 'auto-advance', currentPart: 4, targetPart: 5, currentPosition: 99, targetPosition: 100, currentMediaGroupKey: 'passage:p4', targetMediaGroupKey: 'question:p5', mediaHasEnded: true }).allowed).toBe(true);
  });
});

