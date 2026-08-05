'use client';

import { useState } from 'react';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ToeicHistoryError } from '../historyContracts';
import { startToeicWrongQuestionAttempt } from '../services/toeicHistoryService';

export function ToeicWrongQuestionRetryButton({ sourceAttemptId }: { sourceAttemptId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!idempotencyKey) return;
      const session = await startToeicWrongQuestionAttempt({ sourceAttemptId, idempotencyKey });
      setConfirming(false);
      setIdempotencyKey(null);
      router.push(`/app/tests/attempts/${session.attemptId}`);
    } catch (cause) {
      if (cause instanceof ToeicHistoryError && cause.code === 'NO_WRONG_QUESTIONS') {
        setError('Không có câu sai để luyện lại.');
        setIdempotencyKey(null);
        setConfirming(false);
      } else if (cause instanceof ToeicHistoryError && cause.code === 'DUPLICATE_ACTIVE_ATTEMPT') {
        setError('Bạn đang có một phiên luyện câu sai đang mở cho đề này.');
        setIdempotencyKey(null);
        setConfirming(false);
      } else {
        setError('Không thể tạo phiên luyện câu sai lúc này. Bấm xác nhận để thử lại cùng mã an toàn.');
        setConfirming(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!confirming ? (
        <button type="button" onClick={() => { setError(null); setIdempotencyKey(crypto.randomUUID()); setConfirming(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FBCFE8] px-4 text-sm font-bold text-[#9D174D] transition hover:bg-[#FFF1F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Làm lại câu sai
        </button>
      ) : (
        <div className="rounded-2xl border border-[#FBCFE8] bg-[#FFF8FA] p-4" role="group" aria-label="Xác nhận luyện lại câu sai">
          <p className="text-sm font-bold text-[#493B42]">Tạo một Practice mới từ các câu trả lời sai?</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">Attempt cũ không bị thay đổi. Server sẽ tự chọn các câu sai và không nhận danh sách câu từ trình duyệt.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void start()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F472B6] px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-60">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy ? 'Đang tạo phiên…' : 'Xác nhận'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="min-h-10 rounded-xl px-3 text-sm font-bold text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Hủy</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-[#9D174D]" role="alert">{error}</p>}
    </div>
  );
}
