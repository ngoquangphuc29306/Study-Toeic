'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ClipboardCheck, Clock3, ListChecks, RefreshCcw, Search } from 'lucide-react';
import { listPublishedToeicTests } from '../services/toeicTestReadService';
import type { ToeicTestCatalogItem } from '../readContracts';
import { ToeicReadError } from '../readContracts';

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} phút`;
}

export function ToeicTestCatalogPage() {
  const [tests, setTests] = useState<ReadonlyArray<ToeicTestCatalogItem>>([]);
  const [year, setYear] = useState('');
  const [setName, setSetName] = useState('');
  const [source, setSource] = useState('');
  const [applied, setApplied] = useState({ year: '', setName: '', source: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPublishedToeicTests({
        year: applied.year ? Number(applied.year) : null,
        setName: applied.setName || null,
        source: applied.source || null,
        limit: 50,
        offset: 0,
      });
      setTests(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách đề'));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setApplied({ year: year.trim(), setName: setName.trim(), source: source.trim() });
  };

  return (
    <main className="min-h-screen bg-[#FFF9FA] px-4 py-6 sm:px-6 lg:px-8" id="main-content">
      <div className="mx-auto max-w-7xl">
        <Link href="/app" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Về trang tổng quan
        </Link>
        <header className="mt-6 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F472B6]">Luyện đề TOEIC</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#493B42] sm:text-4xl">Chọn một đề để bắt đầu</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">Làm bài theo đúng tập câu của đề. Đáp án được lưu tự động trong phiên để bạn có thể quay lại bất cứ lúc nào.</p>
        </header>

        <form onSubmit={applyFilters} className="mt-7 grid gap-3 rounded-3xl border border-[#FCE7F3] bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-semibold text-[#493B42]">Năm
            <input value={year} onChange={(event) => setYear(event.target.value)} type="number" min="2000" max="2100" placeholder="Tất cả" className="mt-1 min-h-11 w-full rounded-xl border border-[#FBCFE8] bg-[#FFFDFD] px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" />
          </label>
          <label className="text-sm font-semibold text-[#493B42]">Bộ đề
            <input value={setName} onChange={(event) => setSetName(event.target.value)} placeholder="Ví dụ: ETS 2024" className="mt-1 min-h-11 w-full rounded-xl border border-[#FBCFE8] bg-[#FFFDFD] px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" />
          </label>
          <label className="text-sm font-semibold text-[#493B42]">Nguồn
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Tất cả nguồn" className="mt-1 min-h-11 w-full rounded-xl border border-[#FBCFE8] bg-[#FFFDFD] px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]" />
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white shadow-sm transition hover:bg-[#DB2777] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2">
            <Search className="h-4 w-4" aria-hidden="true" /> Lọc đề
          </button>
        </form>

        {loading && <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-live="polite">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-3xl border border-[#FCE7F3] bg-white" />)}</div>}
        {!loading && error && (
          <div className="mt-8 rounded-3xl border border-[#FBCFE8] bg-[#FFF1F2] p-6 text-[#9D174D]" role="alert">
            <p className="font-bold">{error instanceof ToeicReadError && error.code === 'UNAUTHENTICATED' ? 'Phiên đăng nhập đã hết.' : 'Không thể tải danh sách đề lúc này.'}</p>
            <p className="mt-1 text-sm">Hãy thử lại sau giây lát.</p>
            <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại</button>
          </div>
        )}
        {!loading && !error && tests.length === 0 && <div className="mt-8 rounded-3xl border border-dashed border-[#F9A8D4] bg-white p-10 text-center"><ClipboardCheck className="mx-auto h-10 w-10 text-[#F472B6]" aria-hidden="true" /><h2 className="mt-3 text-xl font-extrabold text-[#493B42]">Chưa có đề phù hợp</h2><p className="mt-2 text-sm text-gray-600">Thử xoá bộ lọc hoặc quay lại sau khi đề được phát hành.</p></div>}
        {!loading && !error && tests.length > 0 && (
          <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Danh sách đề TOEIC">
            {tests.map((test) => (
              <article key={test.id} className="flex min-h-56 flex-col rounded-3xl border border-[#FCE7F3] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#F472B6]">{test.setName}</p><h2 className="mt-1 text-lg font-extrabold text-[#493B42]">{test.name}</h2></div><span className="rounded-full bg-[#FFF1F2] px-2.5 py-1 text-xs font-bold text-[#9D174D]">{test.year}</span></div>
                {test.description && <p className="mt-3 line-clamp-2 text-sm text-gray-600">{test.description}</p>}
                <div className="mt-auto grid grid-cols-2 gap-2 pt-5 text-xs font-semibold text-gray-500"><span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-[#F472B6]" aria-hidden="true" />{test.totalQuestions} câu</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-[#F472B6]" aria-hidden="true" />{formatDuration(test.durationSeconds)}</span></div>
                <Link href={`/app/tests/${test.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F472B6] px-4 text-sm font-extrabold text-white transition hover:bg-[#DB2777] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] focus-visible:ring-offset-2">Xem đề và bắt đầu <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
