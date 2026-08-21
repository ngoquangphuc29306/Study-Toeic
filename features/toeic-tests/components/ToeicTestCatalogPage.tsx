'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardCheck,
  Clock3,
  FileText,
  History,
  Layers,
  Play,
  RefreshCcw,
  RotateCcw,
  StickyNote,
  X,
} from 'lucide-react';
import { listPublishedToeicTests } from '../services/toeicTestReadService';
import type { ToeicTestCatalogItem } from '../readContracts';
import { ToeicReadError } from '../readContracts';
import { getToeicTestProgress, setToeicTestProgressVisibility } from '../services/toeicHistoryService';
import type { ToeicTestProgressSummary } from '../historyContracts';
import type { ToeicTestMode, ToeicTestPart } from '../types';
import { toeicPrototype as ui } from '../styles/toeicPrototypeTokens';

type CatalogTab = 'study' | 'progress';
type ProgressView = 'practice' | 'exam';

const ALL_PARTS: ReadonlyArray<ToeicTestPart> = [1, 2, 3, 4, 5, 6, 7];

function formatDuration(seconds: number) {
  return `${Math.round(seconds / 60)} phút`;
}

function MetricCard({ icon, label, value, note }: { icon: ReactNode; label: string; value: string | number; note?: string }) {
  return <div className={`${ui.surface} flex min-h-28 items-center gap-4 rounded-2xl p-4`}><span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-50">{icon}</span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p>{note && <p className="mt-0.5 text-[11px] font-medium text-slate-400">{note}</p>}</div></div>;
}

function ProgressPlaceholder({ title, description }: { title: string; description: string }) {
  return <section className={`${ui.surface} rounded-3xl p-5`}><h2 className="text-sm font-extrabold text-slate-900">{title}</h2><div className="mt-4 space-y-4">{ALL_PARTS.map((part) => <div key={part}><div className="flex items-center justify-between text-xs font-bold text-slate-600"><span>{title.includes('Kỹ năng') ? (part === 1 ? 'Listening (Part 1–4)' : part === 2 ? 'Reading (Part 5–7)' : null) : `Part ${part}`}</span><span>{title.includes('Kỹ năng') && part > 2 ? null : '—'}</span></div>{(!title.includes('Kỹ năng') || part < 3) && <div className="mt-2 h-2 rounded-full bg-pink-50" />}</div>)}</div><p className="mt-5 rounded-xl border border-dashed border-pink-200 bg-pink-50/50 p-3 text-xs leading-5 text-slate-500">{description}</p></section>;
}

function CardToolActions({
  hidden,
  busy,
  onVisibilityChange,
}: {
  hidden: boolean;
  busy: boolean;
  onVisibilityChange: (hidden: boolean) => void;
}) {
  return <div className="flex flex-row-reverse items-center gap-1" aria-label="Công cụ của đề">
    <button type="button" title={hidden ? 'Hiện lại tiến độ' : 'Ẩn tiến độ'} aria-label={hidden ? 'Hiện lại tiến độ' : 'Ẩn tiến độ'} onClick={() => onVisibilityChange(!hidden)} disabled={busy} className={`${ui.iconButton} min-h-8 min-w-8 rounded-lg disabled:opacity-50`}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /></button>
    <Link href="/app/tests/history" title="Xem lịch sử làm đề" aria-label="Xem lịch sử làm đề" className={`${ui.iconButton} min-h-8 min-w-8 rounded-lg`}><History className="h-3.5 w-3.5" aria-hidden="true" /></Link>
    <span title="Chọn một attempt đã nộp trong Lịch sử để làm lại câu sai" aria-label="Làm lại câu sai: chọn attempt trong Lịch sử" className="inline-flex min-h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /></span>
    <span title="Ghi chú chỉ mở trong phiên làm bài" aria-label="Ghi chú trong phiên làm bài" className="inline-flex min-h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"><StickyNote className="h-3.5 w-3.5" aria-hidden="true" /></span>
    <span title="Từ vựng đã lưu được xem trong Review/Practice; chưa có tổng hợp theo đề" aria-label="Từ vựng theo đề chưa có tổng hợp" className="inline-flex min-h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"><BookMarked className="h-3.5 w-3.5" aria-hidden="true" /></span>
  </div>;
}

function StartModeDialog({ test, initialMode, onClose }: { test: ToeicTestCatalogItem; initialMode: ToeicTestMode; onClose: () => void }) {
  const [mode, setMode] = useState<ToeicTestMode>(initialMode);
  const [selectedParts, setSelectedParts] = useState<ReadonlyArray<ToeicTestPart>>([...ALL_PARTS]);
  const selectedCount = mode === 'exam' ? test.totalQuestions : '—';
  const togglePart = (part: ToeicTestPart) => setSelectedParts((current) => current.includes(part) ? current.filter((item) => item !== part) : [...current, part].sort((a, b) => a - b) as ToeicTestPart[]);
  const href = `/app/tests/${test.id}?mode=${mode}&parts=${selectedParts.join(',')}`;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="toeic-start-mode-title" className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-pink-100 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between border-b border-pink-100 px-6 py-5"><div><h2 id="toeic-start-mode-title" className="text-lg font-extrabold text-slate-900">Chọn chế độ</h2><p className="mt-0.5 text-xs font-medium text-slate-500">{test.name}</p></div><button type="button" onClick={onClose} aria-label="Đóng" className={`${ui.iconButton} min-h-9 min-w-9`}><X className="h-4 w-4" aria-hidden="true" /></button></header>
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-2 rounded-2xl bg-pink-50 p-1" role="tablist" aria-label="Chế độ làm đề">
          {(['exam', 'practice'] as const).map((candidate) => <button key={candidate} type="button" role="tab" aria-selected={mode === candidate} onClick={() => { setMode(candidate); if (candidate === 'exam') setSelectedParts([...ALL_PARTS]); }} className={`min-h-10 rounded-xl px-3 text-xs font-extrabold transition ${mode === candidate ? 'bg-white text-slate-900 shadow-sm' : 'text-pink-600'}`}>{candidate === 'exam' ? 'Luyện thi' : 'Luyện tập'}</button>)}
        </div>
        <p className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-xs leading-5 text-pink-800">{mode === 'exam' ? `Chế độ Luyện thi: làm toàn bộ đề trong ${formatDuration(test.durationSeconds)}. Thời lượng do server quy định.` : 'Chế độ Luyện tập: chọn một hoặc nhiều Part, không giới hạn thời gian.'}</p>
        {mode === 'exam' && <div><p className="mb-2 text-xs font-extrabold text-slate-800">Thời gian luyện thi</p><div className="grid grid-cols-3 gap-2"><span className="rounded-xl border border-pink-300 bg-pink-50 px-3 py-2 text-center text-xs font-extrabold text-pink-700">{formatDuration(test.durationSeconds)}</span><button type="button" disabled title="Chưa có server contract cho thời lượng tuỳ chỉnh" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">60 phút</button><button type="button" disabled title="Chưa có server contract cho thời lượng tuỳ chỉnh" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">Tuỳ chỉnh</button></div></div>}
        <fieldset><legend className="text-xs font-extrabold text-slate-800">Chọn Part để luyện tập</legend><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => mode === 'practice' && setSelectedParts(selectedParts.length === ALL_PARTS.length ? [] : [...ALL_PARTS])} disabled={mode === 'exam'} className={`col-span-2 min-h-10 rounded-xl border px-3 text-left text-xs font-bold disabled:cursor-not-allowed ${selectedParts.length === ALL_PARTS.length ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-pink-100 text-slate-600'}`}>✓ Chọn tất cả 7 Part <span className="float-right">{mode === 'exam' ? test.totalQuestions : '—'} câu</span></button>{ALL_PARTS.map((part) => <button key={part} type="button" onClick={() => mode === 'practice' && togglePart(part)} disabled={mode === 'exam'} className={`min-h-10 rounded-xl border px-3 text-left text-xs font-bold disabled:cursor-not-allowed ${selectedParts.includes(part) ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-pink-100 text-slate-600'}`}>✓ Part {part}<span className="float-right text-slate-400">—</span></button>)}</div></fieldset>
        <div className="flex items-center justify-between gap-4"><p className="text-xs text-slate-500">{selectedCount === '—' ? 'Số câu theo Part sẽ được server xác định khi tạo phiên.' : `${selectedCount} câu`}</p><Link href={href} onClick={onClose} className={`${ui.primaryButton} min-h-10 px-5 text-xs ${selectedParts.length === 0 ? 'pointer-events-none opacity-50' : ''}`}>Bắt đầu</Link></div>
      </div>
    </section>
  </div>;
}

function ProgressCard({ test, summary, progressLoading, progressError, onVisibilityChange, busy }: {
  test: ToeicTestCatalogItem;
  summary: ToeicTestProgressSummary | undefined;
  progressLoading: boolean;
  progressError: Error | null;
  onVisibilityChange: (hidden: boolean) => void;
  busy: boolean;
}) {
  const latest = summary?.latestCorrectQuestions !== null && summary?.latestCorrectQuestions !== undefined && summary.latestTotalQuestions !== null && summary?.latestTotalQuestions !== undefined
    ? `${summary.latestCorrectQuestions}/${summary.latestTotalQuestions}`
    : null;
  const best = summary?.bestCorrectQuestions !== null && summary?.bestCorrectQuestions !== undefined && summary.bestTotalQuestions !== null && summary?.bestTotalQuestions !== undefined
    ? `${summary.bestCorrectQuestions}/${summary.bestTotalQuestions}`
    : null;

  return (
    <article className="rounded-2xl border border-pink-200 bg-white p-4 shadow-[0_5px_16px_rgba(236,72,153,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold text-slate-900">{test.name}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">{test.setName} · {test.year}</p>
        </div>
        {summary?.hasActiveAttempt && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-800">Đang làm</span>}
      </div>
      {progressLoading ? <div className="mt-4 space-y-2" aria-label="Đang tải tiến độ"><div className="h-3 w-32 animate-pulse rounded bg-pink-100" /><div className="h-3 w-48 animate-pulse rounded bg-pink-100" /></div> : progressError ? <p className="mt-4 text-sm text-slate-500">Tiến độ tạm thời chưa tải được.</p> : summary?.hiddenFromProgress ? <p className="mt-4 text-sm text-slate-500">Tiến độ đang được ẩn.</p> : <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-pink-50 p-2"><p className="text-[10px] font-bold text-slate-500">Lần làm</p><p className="mt-1 text-base font-black text-pink-700">{summary?.totalAttempts ?? 0}</p></div><div className="rounded-xl bg-emerald-50 p-2"><p className="text-[10px] font-bold text-slate-500">Gần nhất</p><p className="mt-1 text-base font-black text-emerald-700">{latest ?? '—'}</p></div><div className="rounded-xl bg-sky-50 p-2"><p className="text-[10px] font-bold text-slate-500">Tốt nhất</p><p className="mt-1 text-base font-black text-sky-700">{best ?? '—'}</p></div></div>}
      <button type="button" onClick={() => onVisibilityChange(!(summary?.hiddenFromProgress ?? false))} disabled={busy} className="mt-3 text-xs font-bold text-pink-700 underline-offset-4 hover:underline disabled:opacity-50">{summary?.hiddenFromProgress ? 'Hiện lại tiến độ' : 'Ẩn tiến độ'}</button>
    </article>
  );
}

export function ToeicTestCatalogPage() {
  const [tests, setTests] = useState<ReadonlyArray<ToeicTestCatalogItem>>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<CatalogTab>('study');
  const [progressView, setProgressView] = useState<ProgressView>('practice');
  const [startDialog, setStartDialog] = useState<{ test: ToeicTestCatalogItem; mode: ToeicTestMode } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ReadonlyArray<ToeicTestProgressSummary>>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<Error | null>(null);
  const [visibilityBusy, setVisibilityBusy] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPublishedToeicTests({ limit: 50, offset: 0 });
      setTests(result);
      setProgressLoading(true);
      setProgressError(null);
      try {
        setProgress(await getToeicTestProgress(result.map((test) => test.id)));
      } catch (cause) {
        setProgressError(cause instanceof Error ? cause : new Error('Không thể tải tiến độ'));
      } finally {
        setProgressLoading(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách đề'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const toggleProgressVisibility = async (testId: string, hidden: boolean) => {
    setVisibilityBusy((current) => new Set(current).add(testId));
    try {
      const nextHidden = await setToeicTestProgressVisibility(testId, hidden);
      setProgress((current) => current.map((item) => item.testId === testId ? { ...item, hiddenFromProgress: nextHidden } : item));
    } catch {
      setProgressError(new Error('Không thể cập nhật hiển thị tiến độ'));
    } finally {
      setVisibilityBusy((current) => { const next = new Set(current); next.delete(testId); return next; });
    }
  };

  const years = useMemo(() => [...new Set(tests.map((test) => test.year))].sort((a, b) => b - a), [tests]);
  const filteredTests = useMemo(() => selectedYear === 'all' ? tests : tests.filter((test) => test.year === selectedYear), [selectedYear, tests]);
  const progressByTest = useMemo(() => new Map(progress.map((item) => [item.testId, item])), [progress]);
  const visibleProgress = useMemo(() => progress.filter((item) => !item.hiddenFromProgress), [progress]);
  const totalAttempts = visibleProgress.reduce((total, item) => total + item.totalAttempts, 0);
  const totalCompletedParts = new Set(visibleProgress.flatMap((item) => item.completedParts)).size;

  return (
    <main className={`${ui.page} px-4 py-6 sm:px-6 lg:px-8`} id="main-content">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-3xl border border-pink-200 bg-white p-5 shadow-[0_10px_28px_rgba(236,72,153,0.11)] sm:p-7">
          <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-pink-100/70 blur-2xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700"><ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />Đề thi TOEIC mô phỏng sát đề thi thật</span>
              <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Luyện đề thi <span className="text-pink-600">TOEIC</span> thực tế</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Làm bài theo attempt được lưu trên server, tiếp tục ở mọi thiết bị và xem lại lời giải đúng lúc được cấp quyền.</p></div>
            </div>
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 p-0.5 shadow-md shadow-pink-200"><div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white"><ClipboardCheck className="h-9 w-9 text-pink-600" aria-hidden="true" /></div></div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" role="tablist" aria-label="Nội dung đề TOEIC">
            <button type="button" role="tab" aria-selected={activeTab === 'study'} onClick={() => setActiveTab('study')} className={`inline-flex min-h-10 items-center gap-2 rounded-2xl px-4 text-xs font-bold transition-colors ${activeTab === 'study' ? ui.activeTab : ui.inactiveTab} ${ui.focusRing}`}><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />Học</button>
            <button type="button" role="tab" aria-selected={activeTab === 'progress'} onClick={() => setActiveTab('progress')} className={`inline-flex min-h-10 items-center gap-2 rounded-2xl px-4 text-xs font-bold transition-colors ${activeTab === 'progress' ? ui.activeTab : ui.inactiveTab} ${ui.focusRing}`}><Layers className="h-3.5 w-3.5" aria-hidden="true" />Tiến độ</button>
          </div>
          <Link href="/app/tests/history" className={`${ui.secondaryButton} min-h-10 px-3 text-xs`}><History className="h-3.5 w-3.5" aria-hidden="true" />Lịch sử làm bài</Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc theo năm">
          <button type="button" onClick={() => setSelectedYear('all')} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${selectedYear === 'all' ? ui.activeTab : ui.inactiveTab} ${ui.focusRing}`}>Tất cả ({tests.length})</button>
          {years.map((year) => <button key={year} type="button" onClick={() => setSelectedYear(year)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${selectedYear === year ? ui.activeTab : ui.inactiveTab} ${ui.focusRing}`}>{year} ({tests.filter((test) => test.year === year).length})</button>)}
        </div>

        {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">{[1, 2, 3, 4].map((item) => <div key={item} className="h-60 animate-pulse rounded-2xl border border-pink-100 bg-white" />)}</div>}
        {!loading && error && <section className="rounded-3xl border border-pink-200 bg-white p-6 text-pink-800" role="alert"><p className="font-bold">{error instanceof ToeicReadError && error.code === 'UNAUTHENTICATED' ? 'Phiên đăng nhập đã hết.' : 'Không thể tải danh sách đề lúc này.'}</p><p className="mt-1 text-sm">Hãy thử lại sau giây lát.</p><button type="button" onClick={() => void load()} className={`mt-4 ${ui.secondaryButton}`}><RefreshCcw className="h-4 w-4" aria-hidden="true" />Thử lại</button></section>}
        {!loading && !error && filteredTests.length === 0 && <section className="rounded-3xl border border-dashed border-pink-300 bg-white p-10 text-center"><ClipboardCheck className="mx-auto h-10 w-10 text-pink-500" aria-hidden="true" /><h2 className="mt-3 text-xl font-extrabold text-slate-900">Chưa có đề phù hợp</h2><p className="mt-2 text-sm text-slate-600">Thử chọn năm khác hoặc quay lại khi đề được phát hành.</p></section>}

        {!loading && !error && activeTab === 'study' && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Danh sách đề TOEIC">{filteredTests.map((test) => {
          const summary = progressByTest.get(test.id);
          const hasProgress = Boolean(summary?.totalAttempts);
          const progressLabel = summary?.latestCorrectQuestions !== null && summary?.latestCorrectQuestions !== undefined && summary?.latestTotalQuestions !== null && summary?.latestTotalQuestions !== undefined ? `${summary.latestCorrectQuestions}/${summary.latestTotalQuestions}` : 'Chưa luyện tập';
          return <article key={test.id} className="group flex min-h-64 flex-col justify-between space-y-4 rounded-2xl border border-pink-200 bg-white p-4 shadow-[0_5px_16px_rgba(236,72,153,0.06)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-pink-400 hover:shadow-[0_10px_24px_rgba(236,72,153,0.14)] motion-reduce:transform-none">
            <div className="space-y-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-bold text-pink-600">{test.year}</p><h2 className="mt-1 text-base font-extrabold text-slate-900 group-hover:text-pink-600">{test.name}</h2></div><CardToolActions hidden={summary?.hiddenFromProgress ?? false} busy={visibilityBusy.has(test.id)} onVisibilityChange={(hidden) => void toggleProgressVisibility(test.id, hidden)} /></div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" aria-hidden="true" />{test.totalQuestions} câu</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{formatDuration(test.durationSeconds)}</span></div>
              {hasProgress ? <div className="flex items-center gap-2 text-xs"><span className="font-extrabold text-emerald-600">{progressLabel}</span><span className="font-bold text-slate-500">{summary?.totalAttempts} lần làm</span></div> : <p className="text-xs font-medium text-slate-400">Chưa luyện tập</p>}
              {summary?.hasActiveAttempt && <Link href={`/app/tests/${test.id}`} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800"><RotateCcw className="h-3 w-3" aria-hidden="true" />Tiếp tục phiên đang làm</Link>}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => setStartDialog({ test, mode: 'exam' })} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-slate-900 px-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"><Play className="h-3 w-3 fill-pink-400 text-pink-400" aria-hidden="true" />Thi thử</button><button type="button" onClick={() => setStartDialog({ test, mode: 'practice' })} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-pink-200 bg-pink-50 px-2 text-xs font-bold text-pink-700 transition-colors hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />Luyện tập</button></div>
          </article>;
        })}</section>}

        {!loading && !error && activeTab === 'progress' && <section className="space-y-5" aria-label="Tiến độ luyện đề">
          <div className="flex flex-wrap gap-2 border-b border-pink-200 pb-3"><button type="button" onClick={() => setProgressView('practice')} className={`rounded-full px-4 py-2 text-xs font-extrabold ${progressView === 'practice' ? ui.activeTab : ui.inactiveTab}`}>◎ Tiến độ Luyện tập</button><button type="button" onClick={() => setProgressView('exam')} className={`rounded-full px-4 py-2 text-xs font-extrabold ${progressView === 'exam' ? ui.activeTab : ui.inactiveTab}`}>♕ Tiến độ Luyện thi</button></div>
          {progressView === 'practice' ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon={<FileText className="h-6 w-6 text-pink-600" />} label="Tổng lần làm" value={totalAttempts} /><MetricCard icon={<BarChart3 className="h-6 w-6 text-emerald-600" />} label="Tỉ lệ đúng" value="—" note="Chưa có dữ liệu" /><MetricCard icon={<RotateCcw className="h-6 w-6 text-rose-600" />} label="Tổng câu sai" value="—" note="Chưa có dữ liệu" /><MetricCard icon={<Clock3 className="h-6 w-6 text-sky-600" />} label="Tổng thời gian" value="—" note="Chưa có dữ liệu" /></div><ProgressPlaceholder title="Thống kê theo Part" description={`Dữ liệu hiện có: ${totalCompletedParts}/7 Part từng được hoàn thành. Tỉ lệ đúng theo Part cần aggregate server-authoritative.`} /></> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon={<FileText className="h-6 w-6 text-pink-600" />} label="Số đề đã thi" value="—" note="Chưa có dữ liệu" /><MetricCard icon={<ClipboardCheck className="h-6 w-6 text-amber-600" />} label="Điểm cao nhất" value="—" note="Chưa có thang 10–990" /><MetricCard icon={<BarChart3 className="h-6 w-6 text-emerald-600" />} label="Điểm trung bình" value="—" note="Chưa có thang 10–990" /><MetricCard icon={<Clock3 className="h-6 w-6 text-sky-600" />} label="Tổng thời gian" value="—" note="Chưa có dữ liệu" /></div><ProgressPlaceholder title="Thống kê theo Kỹ năng" description="Listening/Reading theo từng đề cần aggregate server-authoritative." /></>}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredTests.map((test) => <ProgressCard key={test.id} test={test} summary={progressByTest.get(test.id)} progressLoading={progressLoading} progressError={progressError} busy={visibilityBusy.has(test.id)} onVisibilityChange={(hidden) => void toggleProgressVisibility(test.id, hidden)} />)}</div>
        </section>}
      </div>
      {startDialog && <StartModeDialog test={startDialog.test} initialMode={startDialog.mode} onClose={() => setStartDialog(null)} />}
    </main>
  );
}
