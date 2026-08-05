'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Eye, RefreshCcw, XCircle } from 'lucide-react';
import type { ToeicAttemptResultSummary } from '../submissionContracts';
import { getToeicAttemptResult } from '../services/toeicSubmissionService';

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
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

  if (loading) return <main className="min-h-screen bg-[#FFF9FA] p-6"><div className="mx-auto max-w-4xl animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-[#FCE7F3]" /><div className="h-64 rounded-3xl bg-white" /></div></main>;
  if (error || !result) return <main className="min-h-screen bg-[#FFF9FA] p-6"><div className="mx-auto max-w-xl rounded-3xl border border-[#FBCFE8] bg-white p-8 text-center" role="alert"><h1 className="text-xl font-extrabold text-[#493B42]">Không thể tải kết quả</h1><p className="mt-2 text-sm text-gray-600">{error?.message || 'Kết quả chưa sẵn sàng.'}</p><button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại</button></div></main>;

  const accuracy = result.answeredQuestions ? Math.round((result.correctQuestions / result.answeredQuestions) * 100) : 0;
  return <main className="min-h-screen bg-[#FFF9FA] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><Link href="/app/tests" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh sách đề</Link><section className="mt-6 rounded-[2rem] border border-[#FCE7F3] bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F472B6]">Kết quả {result.mode === 'exam' ? 'thi toàn bộ' : 'luyện tập'}</p><h1 className="mt-2 text-3xl font-black text-[#493B42]">Bạn đã hoàn thành bài</h1><p className="mt-2 text-sm text-gray-600">Nộp lúc {formatDate(result.submittedAt)}</p></div><div className="rounded-2xl bg-[#FFF1F2] px-5 py-4 text-center"><p className="text-xs font-bold uppercase tracking-wider text-[#9D174D]">Độ chính xác</p><p className="mt-1 text-3xl font-black text-[#9D174D]">{accuracy}%</p></div></div><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-[#F0FDF4] p-4"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /><p className="mt-3 text-sm text-gray-600">Đúng</p><p className="text-2xl font-black text-emerald-700">{result.correctQuestions}</p></div><div className="rounded-2xl bg-[#FFF1F2] p-4"><XCircle className="h-5 w-5 text-rose-600" aria-hidden="true" /><p className="mt-3 text-sm text-gray-600">Sai</p><p className="text-2xl font-black text-rose-700">{result.incorrectQuestions}</p></div><div className="rounded-2xl bg-[#FFF7ED] p-4"><ClipboardList className="h-5 w-5 text-orange-600" aria-hidden="true" /><p className="mt-3 text-sm text-gray-600">Chưa trả lời</p><p className="text-2xl font-black text-orange-700">{result.unansweredQuestions}</p></div><div className="rounded-2xl bg-[#FDF4FF] p-4"><BarChart3 className="h-5 w-5 text-purple-600" aria-hidden="true" /><p className="mt-3 text-sm text-gray-600">Tổng câu</p><p className="text-2xl font-black text-purple-700">{result.totalQuestions}</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#FCE7F3] p-4"><p className="font-extrabold text-[#493B42]">Listening</p><p className="mt-2 text-sm text-gray-600">{result.listeningCorrect} / {result.listeningTotal} câu đúng</p></div><div className="rounded-2xl border border-[#FCE7F3] p-4"><p className="font-extrabold text-[#493B42]">Reading</p><p className="mt-2 text-sm text-gray-600">{result.readingCorrect} / {result.readingTotal} câu đúng</p></div></div><p className="mt-6 rounded-2xl bg-[#FFF8FA] p-4 text-sm text-gray-600">Điểm TOEIC quy đổi chính thức chưa được triển khai. Kết quả hiện hiển thị số câu đúng và độ chính xác thực tế.</p><div className="mt-6 flex flex-wrap gap-3"><Link href={`/app/tests/attempts/${attemptId}/review`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><Eye className="h-4 w-4" aria-hidden="true" /> Xem lại đáp án</Link><Link href="/app/tests" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FBCFE8] px-4 font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]">Về danh sách đề</Link></div></section></div></main>;
}
