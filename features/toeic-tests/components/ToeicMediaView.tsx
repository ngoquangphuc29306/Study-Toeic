'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { ToeicMediaClient } from '../services/toeicMediaClient';

interface ToeicMediaViewProps {
  testId: string;
  path: string | null;
  kind: 'audio' | 'image';
  alt?: string;
  mediaClient: ToeicMediaClient;
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return '00:00';
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

export function ToeicMediaView({ testId, path, kind, alt = 'Nội dung hình ảnh của câu hỏi', mediaClient }: ToeicMediaViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [zoomed, setZoomed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!path || !mountedRef.current) return;
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
    if (path) void Promise.resolve().then(load);
    return () => { mountedRef.current = false; requestIdRef.current += 1; };
  }, [load, path]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (!zoomed) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [zoomed]);

  if (!path) return null;
  if (state === 'loading' || state === 'idle') return <div className="rounded-xl border border-[#FCE7F3] bg-[#FFF8FA] p-3 text-sm text-gray-500" aria-live="polite">Đang tải media…</div>;
  if (state === 'error') return <div className="flex items-center justify-between gap-3 rounded-xl border border-[#FBCFE8] bg-[#FFF1F2] p-3 text-sm text-[#9D174D]" role="alert"><span>Không thể tải media của câu hỏi.</span><button type="button" onClick={() => void load()} className="min-h-9 rounded-lg bg-white px-3 font-bold text-[#DB2777] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Thử lại</button></div>;
  if (!url) return null;

  if (kind === 'audio') {
    const toggle = async () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        try {
          await audio.play();
        } catch {
          // Browsers can reject playback until a valid user gesture is available.
          // Keep the player idle instead of surfacing an unhandled promise rejection.
          setPlaying(false);
        }
      } else {
        audio.pause();
      }
    };
    return <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#FCE7F3] bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(236,72,153,0.05)]" aria-label="Điều khiển audio"><audio ref={audioRef} preload="metadata" src={url} muted={muted} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} /><button type="button" onClick={() => void toggle()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F472B6] text-white shadow-sm transition-colors hover:bg-[#EC4899] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2" aria-label={playing ? 'Tạm dừng audio' : 'Phát audio'}>{playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />}</button><div className="min-w-[7rem]"><p className="text-xs font-extrabold text-slate-900">Audio TOEIC</p><p className="text-[10px] font-medium text-slate-500">{formatSeconds(currentTime)} / {formatSeconds(duration)}</p></div><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrentTime(next); }} className="h-1.5 min-w-24 flex-1 accent-[#F472B6]" aria-label="Tiến độ audio" /><button type="button" onClick={() => setSpeed((value) => value === 1 ? 1.25 : value === 1.25 ? 1.5 : 1)} className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" aria-label="Đổi tốc độ audio">{speed}x</button><button type="button" onClick={() => setMuted((value) => !value)} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-pink-50 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>{muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}</button></section>;
  }

  return <><figure className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2"><img src={url} alt={alt} className="max-h-80 w-full rounded-xl object-contain" /><button type="button" onClick={() => setZoomed(true)} className="absolute right-4 top-4 inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" aria-label="Phóng to hình ảnh"><Maximize2 className="h-4 w-4" aria-hidden="true" /></button></figure>{zoomed && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4" role="dialog" aria-modal="true" aria-label="Hình ảnh phóng to" onClick={() => setZoomed(false)}><div className="relative max-h-[88dvh] max-w-full" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setZoomed(false)} className="absolute right-3 top-3 z-10 inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-white/95 text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" aria-label="Đóng hình ảnh phóng to"><X className="h-4 w-4" aria-hidden="true" /></button><img src={url} alt={alt} className="max-h-[88dvh] max-w-full rounded-2xl object-contain shadow-2xl" /></div></div>}</>;
}
