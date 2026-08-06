import type { ToeicTestMode, ToeicTestPart } from '../types';

export interface ToeicMediaPolicyInput {
  mode: ToeicTestMode;
  part: ToeicTestPart;
  hasStarted: boolean;
  hasEnded: boolean;
}

export interface ToeicMediaPlaybackPolicy {
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
  canReplay: boolean;
  canChangeSpeed: boolean;
  canMute: boolean;
  forcePlaybackRate: number | null;
  autoAdvanceOnEnded: boolean;
}

const PRACTICE_POLICY: ToeicMediaPlaybackPolicy = {
  canPlay: true,
  canPause: true,
  canSeek: true,
  canReplay: true,
  canChangeSpeed: true,
  canMute: true,
  forcePlaybackRate: null,
  autoAdvanceOnEnded: false,
};

export function getToeicMediaPlaybackPolicy({
  mode,
  part,
  hasStarted,
  hasEnded,
}: ToeicMediaPolicyInput): ToeicMediaPlaybackPolicy {
  if (mode === 'practice' || part >= 5) return PRACTICE_POLICY;

  return {
    canPlay: !hasEnded,
    canPause: false,
    canSeek: false,
    canReplay: false,
    canChangeSpeed: false,
    canMute: true,
    forcePlaybackRate: 1,
    autoAdvanceOnEnded: true,
    // Keep the parameter explicit in the contract: after playback has
    // started, the same locked policy continues until the media ends.
    ...(hasStarted ? {} : {}),
  };
}

