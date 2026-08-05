'use client';

import { useEffect, useRef } from 'react';

interface ToeicAbandonDialogProps {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ToeicAbandonDialog({ open, busy = false, onCancel, onConfirm }: ToeicAbandonDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Tab') {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [onCancel, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#321C2B]/45 p-4" role="presentation">
      <div className="w-full max-w-md rounded-3xl border border-[#FCE7F3] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="abandon-title" aria-describedby="abandon-description">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F472B6]">Thoát phiên luyện đề</p>
        <h2 id="abandon-title" className="mt-2 text-xl font-extrabold text-[#493B42]">Bạn muốn bỏ bài?</h2>
        <p id="abandon-description" className="mt-2 text-sm leading-6 text-gray-600">Bài làm hiện tại sẽ được giữ để bạn có thể tiếp tục khi quay lại. Chỉ chọn “Bỏ bài” nếu bạn muốn đóng phiên này.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-[#FBCFE8] px-4 font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Ở lại</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy} className="min-h-11 rounded-xl bg-[#E11D48] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-60">{busy ? 'Đang xử lý…' : 'Bỏ bài'}</button>
        </div>
      </div>
    </div>
  );
}
