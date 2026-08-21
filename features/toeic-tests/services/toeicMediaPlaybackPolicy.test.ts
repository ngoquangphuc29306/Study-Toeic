import { describe, expect, it } from 'vitest';
import { getToeicMediaPlaybackPolicy } from './toeicMediaPlaybackPolicy';

describe('getToeicMediaPlaybackPolicy', () => {
  it('keeps all media controls available in Practice', () => {
    expect(getToeicMediaPlaybackPolicy({ mode: 'practice', part: 3, hasStarted: true, hasEnded: false })).toEqual({
      canPlay: true,
      canPause: true,
      canSeek: true,
      canReplay: true,
      canChangeSpeed: true,
      canMute: true,
      forcePlaybackRate: null,
      autoAdvanceOnEnded: false,
    });
  });

  it('allows the first Exam Listening playback but locks controls', () => {
    const policy = getToeicMediaPlaybackPolicy({ mode: 'exam', part: 1, hasStarted: false, hasEnded: false });
    expect(policy).toMatchObject({ canPlay: true, canPause: false, canSeek: false, canReplay: false, canChangeSpeed: false, canMute: true, forcePlaybackRate: 1, autoAdvanceOnEnded: true });
  });

  it('keeps Exam Listening locked during playback and disallows replay after ended', () => {
    expect(getToeicMediaPlaybackPolicy({ mode: 'exam', part: 4, hasStarted: true, hasEnded: false })).toMatchObject({ canPlay: true, canPause: false, canSeek: false, canReplay: false, canChangeSpeed: false, forcePlaybackRate: 1 });
    expect(getToeicMediaPlaybackPolicy({ mode: 'exam', part: 4, hasStarted: true, hasEnded: true })).toMatchObject({ canPlay: false, canReplay: false, autoAdvanceOnEnded: true });
  });

  it('does not apply Listening restrictions to Exam Reading', () => {
    expect(getToeicMediaPlaybackPolicy({ mode: 'exam', part: 5, hasStarted: true, hasEnded: false })).toMatchObject({ canPause: true, canSeek: true, canReplay: true, canChangeSpeed: true, forcePlaybackRate: null, autoAdvanceOnEnded: false });
  });
});

