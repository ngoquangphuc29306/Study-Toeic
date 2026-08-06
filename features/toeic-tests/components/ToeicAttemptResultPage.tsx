'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Eye, RefreshCcw, RotateCcw, XCircle } from 'lucide-react';
import type { ToeicAttemptResultSummary } from '../submissionContracts';
import { getToeicAttemptResult } from '../services/toeicSubmissionService';
import { ToeicWrongQuestionRetryButton } from './ToeicWrongQuestionRetryButton';
import { toeicPrototype as ui } from '../styles/toeicPrototypeTokens';

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function ResultMetric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: 'green' | 'rose' | 'orange' | 'purple' }) {
  const tones = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    orange: 'border-orange-100 bg-orange-50 text-orange-700',
    purple: 'border-purple-100 bg-purple-50 text-purple-700',
  } as const;
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><div className="flex items-center justify-between gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/80">{icon}</span><p className="text-2xl font-black tabular-nums">{value}</p></div><p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em]">{label}</p></div>;
}

export function ToeicAttemptResultPage({ attemptId }: { attemptId: string }) {
  const [result, setResult] = useState<ToeicAttemptResultSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getToeicAttemptResult(attemptId)
      .then((value) => { if (active) setResult(value); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause : new Error('Không thể tải kết quả')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attemptId]);

  if (loading) return <main className={`${ui.page} p-6`}><div className="mx-auto max-w-5xl animate-pulse space-y-4"><div className="h-10 w-52 rounded-2xl bg-pink-100" /><div className="h-80 rounded-3xl bg-white" /></div></main>;
  if (error || !result) return <main className={`${ui.page} p-6`}><div className="mx-auto max-w-xl rounded-3xl border border-pink-200 bg-white p-8 text-center shadow-[0_8px_24px_rgba(236,72,153,0.08)]" role="alert"><h1 className="text-xl font-extrabold text-slate-900">Không thể tải kết quả</h1><p className="mt-2 text-sm leading-6 text-slate-600">{error?.message || 'Kết quả chưa sẵn sàng.'}</p><button type="button" onClick={() => window.location.reload()} className={`mt-5 ${ui.primaryButton}`}><RefreshCcw className="h-4 w-4" aria-hidden="true" />Thử lại</button></div></main>;

  const accuracy = result.answeredQuestions ? Math.round((result.correctQuestions / result.answeredQuestions) * 100) : 0;
  return (
    <main className={`${ui.page} px-4 py-6 sm:px-6 lg:px-8`} id="main-content">
      <div className="mx-auto max-w-5xl">
        <Link href="/app/tests" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-pink-700 hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Danh sách đề</Link>
        <section className="mt-5 overflow-hidden rounded-[2rem] border border-pink-200 bg-white shadow-[0_12px_32px_rgba(236,72,153,0.1)]">
          <header className="border-b border-pink-100 bg-[linear-gradient(120deg,#FFF1F7,white_55%,#FDF2F8)] px-6 py-7 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-pink-600">Kết quả {result.mode === 'exam' ? 'thi thử' : 'luyện tập'}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Bạn đã hoàn thành bài</h1><p className="mt-2 text-sm text-slate-600">Nộp lúc {formatDate(result.submittedAt)}</p></div><div className="min-w-28 rounded-2xl border border-pink-200 bg-white px-5 py-4 text-center shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-pink-700">Độ chính xác</p><p className="mt-1 text-4xl font-black tabular-nums text-pink-600">{accuracy}%</p></div></div>
          </header>
          <div className="p-5 sm:p-8"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ResultMetric label="Đúng" value={result.correctQuestions} tone="green" icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} /><ResultMetric label="Sai" value={result.incorrectQuestions} tone="rose" icon={<XCircle className="h-5 w-5" aria-hidden="true" />} /><ResultMetric label="Chưa trả lời" value={result.unansweredQuestions} tone="orange" icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} /><ResultMetric label="Tổng câu" value={result.totalQuestions} tone="purple" icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />} /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className={`${ui.mutedPanel} p-4`}><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-pink-600">Listening</p><p className="mt-2 text-xl font-black text-slate-900">{result.listeningCorrect} <span className="text-sm font-bold text-slate-500">/ {result.listeningTotal} câu đúng</span></p></div><div className={`${ui.mutedPanel} p-4`}><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-pink-600">Reading</p><p className="mt-2 text-xl font-black text-slate-900">{result.readingCorrect} <span className="text-sm font-bold text-slate-500">/ {result.readingTotal} câu đúng</span></p></div></div>
            <p className="mt-5 rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3 text-sm leading-6 text-pink-900">Điểm TOEIC quy đổi chính thức chưa được triển khai. Kết quả này chỉ hiển thị số câu đúng và độ chính xác do server chấm.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href={`/app/tests/attempts/${attemptId}/review`} className={ui.primaryButton}><Eye className="h-4 w-4" aria-hidden="true" />Xem lại đáp án</Link><ToeicWrongQuestionRetryButton sourceAttemptId={attemptId} /><Link href="/app/tests" className={ui.secondaryButton}><RotateCcw className="h-4 w-4" aria-hidden="true" />Làm đề khác</Link></div>
          </div>
        </section>
      </div>
    </main>
  );
}
