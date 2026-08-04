'use client';

import { useEffect } from 'react';
import {
  installChunkLoadErrorRecovery,
  markChunkRecoverySuccessful,
} from '@/lib/runtime/chunkLoadRecovery';

const BOOT_SUCCESS_DELAY_MS = 2_000;

export function ChunkLoadRecovery() {
  useEffect(() => {
    const cleanup = installChunkLoadErrorRecovery();
    const successTimer = window.setTimeout(() => {
      try {
        markChunkRecoverySuccessful(window.sessionStorage);
      } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }
    }, BOOT_SUCCESS_DELAY_MS);

    return () => {
      cleanup();
      window.clearTimeout(successTimer);
    };
  }, []);

  return null;
}
