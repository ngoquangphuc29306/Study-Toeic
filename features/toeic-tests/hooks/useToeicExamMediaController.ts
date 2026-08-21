'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToeicTestMode, ToeicTestPart } from '../types';
import {
  getToeicMediaPlaybackPolicy,
  type ToeicMediaPlaybackPolicy,
} from '../services/toeicMediaPlaybackPolicy';

export type ToeicMediaStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'ended'
  | 'error';

interface UseToeicExamMediaControllerInput {
  mode: ToeicTestMode;
  part: ToeicTestPart;
  mediaKey: string | null;
}

export interface ToeicExamMediaController {
  status: ToeicMediaStatus;
  hasStarted: boolean;
  hasEnded: boolean;
  lastAllowedTime: number;
  policy: ToeicMediaPlaybackPolicy;
  handleLoading: () => void;
  handleReady: () => void;
  handlePlaybackStart: () => void;
  handlePlaybackEnd: () => void;
  handlePlaybackError: () => void;
  handleTimeUpdate: (currentTime: number) => void;
}

export function useToeicExamMediaController({
  mode,
  part,
  mediaKey,
}: UseToeicExamMediaControllerInput): ToeicExamMediaController {
  const [status, setStatus] = useState<ToeicMediaStatus>('idle');
  const [hasStarted, setHasStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [lastAllowedTime, setLastAllowedTime] = useState(0);
  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = false;
    // A media-key change is the controller's external lifecycle boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('idle');
    setHasStarted(false);
    setHasEnded(false);
    setLastAllowedTime(0);
  }, [mediaKey]);

  const policy = useMemo(
    () => getToeicMediaPlaybackPolicy({ mode, part, hasStarted, hasEnded }),
    [hasEnded, hasStarted, mode, part],
  );

  const handleLoading = useCallback(() => setStatus('loading'), []);
  const handleReady = useCallback(() => setStatus('ready'), []);
  const handlePlaybackStart = useCallback(() => {
    if (endedRef.current) return;
    setHasStarted(true);
    setStatus('playing');
  }, []);
  const handlePlaybackEnd = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setHasEnded(true);
    setStatus('ended');
  }, []);
  const handlePlaybackError = useCallback(() => setStatus('error'), []);
  const handleTimeUpdate = useCallback((currentTime: number) => {
    if (Number.isFinite(currentTime)) setLastAllowedTime(currentTime);
  }, []);

  return {
    status,
    hasStarted,
    hasEnded,
    lastAllowedTime,
    policy,
    handleLoading,
    handleReady,
    handlePlaybackStart,
    handlePlaybackEnd,
    handlePlaybackError,
    handleTimeUpdate,
  };
}
