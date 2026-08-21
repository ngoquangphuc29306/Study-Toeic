'use client';

import { useEffect, useRef } from 'react';

interface ToeicSubmitDialogProps {
  open: boolean;
  busy?: boolean;
  answered: number;
  unanswered: number;
  flagged: number;
  remainingLabel: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ToeicSubmitDialog({ open, busy = false, answered, unanswered, flagged, remainingLabel, errorMessage, onRetry, onCancel, onConfirm }: ToeicSubmitDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key === 'Tab') {
        const first = cancelRef.current;
        const last = submitRef.current;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [busy, onCancel, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#321C2B]/45 p-4" role="presentation">
      <div className="w-full max-w-md rounded-3xl border border-[#FCE7F3] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="submit-title" aria-describedby="submit-description">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F472B6]">Xác nhận nộp bài</p>
        <h2 id="submit-title" className="mt-2 text-xl font-extrabold text-[#493B42]">Bạn muốn kết thúc phiên?</h2>
        <p id="submit-description" className="mt-2 text-sm leading-6 text-gray-600">Sau khi nộp, bạn không thể chỉnh sửa đáp án trong phiên này.</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-[#F0FDF4] p-3"><dt className="text-gray-600">Đã trả lời</dt><dd className="mt-1 text-lg font-black text-emerald-700">{answered}</dd></div><div className="rounded-xl bg-[#FFF7ED] p-3"><dt className="text-gray-600">Chưa trả lời</dt><dd className="mt-1 text-lg font-black text-orange-700">{unanswered}</dd></div><div className="rounded-xl bg-[#FFFBEB] p-3"><dt className="text-gray-600">Đã đánh dấu</dt><dd className="mt-1 text-lg font-black text-amber-700">{flagged}</dd></div><div className="rounded-xl bg-[#FFF1F2] p-3"><dt className="text-gray-600">Thời gian</dt><dd className="mt-1 text-lg font-black text-[#9D174D]">{remainingLabel}</dd></div></dl>
        {errorMessage && <p className="mt-4 rounded-xl bg-[#FFF1F2] p-3 text-sm text-[#9D174D]" role="alert">{errorMessage}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-[#FBCFE8] px-4 font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Tiếp tục làm bài</button>{errorMessage && onRetry && <button type="button" onClick={onRetry} disabled={busy} className="min-h-11 rounded-xl border border-[#F9A8D4] px-4 font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Thử lưu lại</button>}<button ref={submitRef} type="button" onClick={onConfirm} disabled={busy || Boolean(errorMessage)} className="min-h-11 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Đang nộp…' : errorMessage ? 'Chưa thể nộp' : 'Nộp bài'}</button></div>
      </div>
    </div>
  );
}
