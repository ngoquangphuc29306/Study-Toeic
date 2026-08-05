'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, History, RefreshCcw } from 'lucide-react';
import {
  type ToeicAttemptHistoryItem,
  type ToeicAttemptHistoryFilters,
  type ToeicHistoryAttemptStatus,
} from '../historyContracts';
import type { ToeicTestMode } from '../types';
import { listToeicAttemptHistory } from '../services/toeicHistoryService';
import { ToeicWrongQuestionRetryButton } from './ToeicWrongQuestionRetryButton';

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status: ToeicHistoryAttemptStatus) {
  return status === 'submitted' ? 'Đã nộp' : status === 'abandoned' ? 'Đã bỏ' : 'Hết giờ';
}

function historySummary(item: ToeicAttemptHistoryItem) {
  if (item.status !== 'submitted' || item.correctQuestions === null) return 'Chưa có điểm';
  return `${item.correctQuestions}/${item.totalQuestions} câu đúng`;
}

export function ToeicAttemptHistoryPage() {
  const [items, setItems] = useState<ReadonlyArray<ToeicAttemptHistoryItem>>([]);
  const [mode, setMode] = useState<ToeicTestMode | ''>('');
  const [status, setStatus] = useState<ToeicHistoryAttemptStatus | ''>('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters: ToeicAttemptHistoryFilters = {
      mode: mode || null,
      status: status || null,
      limit: PAGE_SIZE,
      offset,
    };
    try {
      const page = await listToeicAttemptHistory(filters);
      setItems(page.items);
      setTotal(page.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải lịch sử làm bài'));
    } finally {
      setLoading(false);
    }
  }, [mode, offset, status]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const applyFilter = (nextMode: ToeicTestMode | '', nextStatus: ToeicHistoryAttemptStatus | '') => {
    setMode(nextMode);
    setStatus(nextStatus);
    setOffset(0);
  };

  return (
    <main className="min-h-screen bg-[#FFF9FA] px-4 py-6 sm:px-6 lg:px-8" id="main-content">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/app/tests" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh sách đề</Link>
          <Link href="/app" className="text-sm font-semibold text-gray-500 underline-offset-4 hover:underline">Trang tổng quan</Link>
        </div>
        <header className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F472B6]">Theo dõi tiến độ</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#493B42] sm:text-4xl">Lịch sử làm bài</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">Kết quả được lấy từ các attempt đã lưu trên server. Practice và Exam được giữ riêng để bạn so sánh đúng phạm vi.</p>
        </header>

        <section className="mt-7 flex flex-wrap gap-3 rounded-3xl border border-[#FCE7F3] bg-white p-4 shadow-sm" aria-label="Bộ lọc lịch sử">
          <label className="text-sm font-bold text-[#493B42]">Chế độ<select value={mode} onChange={(event) => applyFilter(event.target.value as ToeicTestMode | '', status)} className="mt-1 min-h-11 rounded-xl border border-[#FBCFE8] bg-[#FFFDFD] px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><option value="">Tất cả</option><option value="exam">Exam</option><option value="practice">Practice</option></select></label>
          <label className="text-sm font-bold text-[#493B42]">Trạng thái<select value={status} onChange={(event) => applyFilter(mode, event.target.value as ToeicHistoryAttemptStatus | '')} className="mt-1 min-h-11 rounded-xl border border-[#FBCFE8] bg-[#FFFDFD] px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><option value="">Tất cả</option><option value="submitted">Đã nộp</option><option value="abandoned">Đã bỏ</option><option value="expired">Hết giờ</option></select></label>
        </section>

        {loading && <div className="mt-6 space-y-3" aria-live="polite">{[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl border border-[#FCE7F3] bg-white" />)}</div>}
        {!loading && error && <div className="mt-6 rounded-3xl border border-[#FBCFE8] bg-[#FFF1F2] p-6 text-[#9D174D]" role="alert"><p className="font-bold">Không thể tải lịch sử lúc này.</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại</button></div>}
        {!loading && !error && items.length === 0 && <div className="mt-6 rounded-3xl border border-dashed border-[#F9A8D4] bg-white p-10 text-center"><History className="mx-auto h-10 w-10 text-[#F472B6]" aria-hidden="true" /><h2 className="mt-3 text-xl font-extrabold text-[#493B42]">Chưa có lịch sử phù hợp</h2><p className="mt-2 text-sm text-gray-600">Hãy hoàn thành một phiên Practice hoặc Exam để kết quả xuất hiện ở đây.</p></div>}
        {!loading && !error && items.length > 0 && <section className="mt-6 space-y-3" aria-label="Danh sách lịch sử làm bài">{items.map((item) => <article key={item.attemptId} className="rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-sm transition hover:shadow-md"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#F472B6]">{item.setName} · {item.source}</p><h2 className="mt-1 text-lg font-extrabold text-[#493B42]">{item.testName}</h2><p className="mt-1 text-sm text-gray-500">{formatDate(item.startedAt)} · Part {item.selectedParts.join(', ')}</p></div><span className="rounded-full bg-[#FFF1F2] px-3 py-1 text-xs font-bold text-[#9D174D]">{item.mode === 'exam' ? 'Exam' : 'Practice'} · {statusLabel(item.status)}</span></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600"><span className="font-bold text-[#493B42]">{historySummary(item)}</span>{item.answeredQuestions !== null && <span>Đã trả lời {item.answeredQuestions}/{item.totalQuestions}</span>}{item.status === 'submitted' && item.listeningCorrect !== null && <span>Listening {item.listeningCorrect}/{item.listeningTotal}</span>}{item.status === 'submitted' && item.readingCorrect !== null && <span>Reading {item.readingCorrect}/{item.readingTotal}</span>}</div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/app/tests/attempts/${item.attemptId}/result`} className="inline-flex min-h-10 items-center rounded-xl bg-[#F472B6] px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Xem kết quả</Link>{item.status === 'submitted' && <Link href={`/app/tests/attempts/${item.attemptId}/review`} className="inline-flex min-h-10 items-center rounded-xl border border-[#FBCFE8] px-3 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Xem lại</Link>}{item.status === 'submitted' && <ToeicWrongQuestionRetryButton sourceAttemptId={item.attemptId} />}</div></article>)}</section>}
        {!loading && !error && total > PAGE_SIZE && <nav className="mt-6 flex items-center justify-between rounded-2xl border border-[#FCE7F3] bg-white p-3" aria-label="Phân trang lịch sử"><button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Trước</button><span className="text-sm font-semibold text-gray-500">{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}</span><button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset((value) => value + PAGE_SIZE)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-40">Sau <ChevronRight className="h-4 w-4" aria-hidden="true" /></button></nav>}
      </div>
    </main>
  );
}
