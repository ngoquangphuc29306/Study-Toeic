'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToeicMediaClient } from '../services/toeicMediaClient';

interface ToeicMediaViewProps {
  testId: string;
  path: string | null;
  kind: 'audio' | 'image';
  alt?: string;
  mediaClient: ToeicMediaClient;
}

export function ToeicMediaView({ testId, path, kind, alt = 'Nội dung hình ảnh của câu hỏi', mediaClient }: ToeicMediaViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    if (!mountedRef.current) return;
    const requestId = ++requestIdRef.current;
    setState('loading');
    try {
      const result = await mediaClient.get(testId, path);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setUrl(result.signedUrl);
      setState('ready');
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setUrl(null);
      setState('error');
    }
  }, [mediaClient, path, testId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!path) {
      // Resetting media state is required when the current question changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      setState('idle');
      return;
    }
    void load().catch(() => undefined);
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [load, path]);

  if (!path) return null;
  if (state === 'loading' || state === 'idle') {
    return <div className="rounded-xl border border-[#FCE7F3] bg-[#FFF8FA] p-3 text-sm text-gray-500" aria-live="polite">Đang tải media…</div>;
  }
  if (state === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#FBCFE8] bg-[#FFF1F2] p-3 text-sm text-[#9D174D]" role="alert">
        <span>Không thể tải media của câu hỏi.</span>
        <button type="button" onClick={() => void load()} className="min-h-9 rounded-lg bg-white px-3 font-bold text-[#DB2777] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Thử lại</button>
      </div>
    );
  }
  if (!url) return null;
  if (kind === 'audio') {
    return <audio controls preload="metadata" src={url} className="w-full" aria-label="Audio câu hỏi" />;
  }
  // Signed media URLs cannot be statically optimized by next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="max-h-72 w-full rounded-xl object-contain" />;
}
