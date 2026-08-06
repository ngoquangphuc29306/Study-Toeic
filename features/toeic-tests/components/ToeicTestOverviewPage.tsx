'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Clock3, LoaderCircle, RotateCcw } from 'lucide-react';
import { ToeicAttemptError, type GetActiveToeicAttemptInput } from '../attemptContracts';
import type { ToeicTestCatalogItem, ToeicTestPartPayload } from '../readContracts';
import type { ToeicTestMode, ToeicTestPart } from '../types';
import { getPublishedToeicTestPart, listPublishedToeicTests } from '../services/toeicTestReadService';
import { getActiveToeicAttempt, startToeicAttempt } from '../services/toeicAttemptService';
import { ToeicPartContentCache } from '../services/toeicPartContentCache';

const ALL_PARTS: ReadonlyArray<ToeicTestPart> = [1, 2, 3, 4, 5, 6, 7];

function formatDuration(seconds: number) {
  return `${Math.round(seconds / 60)} phút`;
}

function parseRequestedParts(value: string | null): ReadonlyArray<ToeicTestPart> {
  if (!value) return [...ALL_PARTS];
  const parts = value.split(',').map((item) => Number(item)).filter((item): item is ToeicTestPart => ALL_PARTS.includes(item as ToeicTestPart));
  return parts.length > 0 ? [...new Set(parts)].sort((left, right) => left - right) as ToeicTestPart[] : [...ALL_PARTS];
}

export function ToeicTestOverviewPage({ testId }: { testId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode: ToeicTestMode = searchParams.get('mode') === 'exam' ? 'exam' : 'practice';
  const requestedParts = parseRequestedParts(searchParams.get('parts'));
  const [test, setTest] = useState<ToeicTestCatalogItem | null>(null);
  const [mode, setMode] = useState<ToeicTestMode>(requestedMode);
  const [selectedParts, setSelectedParts] = useState<ReadonlyArray<ToeicTestPart>>(requestedMode === 'exam' ? [...ALL_PARTS] : requestedParts);
  const [partCounts, setPartCounts] = useState<Partial<Record<ToeicTestPart, number>>>({});
  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [startError, setStartError] = useState<Error | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<{ attemptId: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const cacheRef = useRef(new ToeicPartContentCache(getPublishedToeicTestPart));

  useEffect(() => {
    let active = true;
    // This marker tracks the async catalog request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void listPublishedToeicTests({ limit: 50, offset: 0 }).then((items) => {
      if (!active) return;
      const found = items.find((item) => item.id === testId);
      if (!found) throw new Error('Không tìm thấy đề');
      setTest(found);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause : new Error('Không thể tải đề'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [testId]);

  useEffect(() => {
    if (!test) return;
    let active = true;
    // This marker tracks the async safe-content request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountsLoading(true);
    void Promise.all(selectedParts.map((part) => cacheRef.current.get(test.id, part))).then((payloads) => {
      if (!active) return;
      const counts: Partial<Record<ToeicTestPart, number>> = {};
      payloads.forEach((payload) => { counts[payload.part] = payload.questions.length; });
      setPartCounts((current) => ({ ...current, ...counts }));
    }).catch(() => undefined).finally(() => { if (active) setCountsLoading(false); });
    return () => { active = false; };
  }, [selectedParts, test]);

  const totalSelected = useMemo(() => selectedParts.reduce((sum, part) => sum + (partCounts[part] ?? 0), 0), [partCounts, selectedParts]);

  const start = useCallback(async () => {
    if (!test || selectedParts.length === 0) return;
    setStarting(true);
    setStartError(null);
    setActiveAttempt(null);
    try {
      const session = await startToeicAttempt({ testId: test.id, mode, selectedParts, idempotencyKey: crypto.randomUUID() });
      router.push(`/app/tests/attempts/${session.attemptId}`);
    } catch (cause) {
      if (cause instanceof ToeicAttemptError && cause.code === 'DUPLICATE_ACTIVE_ATTEMPT') {
        const input: GetActiveToeicAttemptInput = { testId: test.id, mode, selectedParts };
        try {
          const current = await getActiveToeicAttempt(input);
          setActiveAttempt({ attemptId: current.attemptId });
        } catch (activeCause) {
          setStartError(activeCause instanceof Error ? activeCause : new Error('Không thể khôi phục bài đang làm'));
        }
      } else {
        setStartError(cause instanceof Error ? cause : new Error('Không thể bắt đầu bài'));
      }
    } finally {
      setStarting(false);
    }
  }, [mode, router, selectedParts, test]);

  const togglePart = (part: ToeicTestPart) => {
    setSelectedParts((current) => current.includes(part) ? current.filter((item) => item !== part) : [...current, part].sort((a, b) => a - b) as ToeicTestPart[]);
  };


  if (loading) return <main className="min-h-screen bg-[#FFF9FA] p-6"><div className="mx-auto max-w-4xl animate-pulse space-y-4"><div className="h-6 w-40 rounded bg-[#FCE7F3]" /><div className="h-48 rounded-3xl bg-white" /></div></main>;
  if (error || !test) return <main className="min-h-screen bg-[#FFF9FA] p-6"><div className="mx-auto max-w-xl rounded-3xl border border-[#FBCFE8] bg-white p-8 text-center" role="alert"><h1 className="text-xl font-extrabold text-[#493B42]">Không thể mở đề</h1><p className="mt-2 text-sm text-gray-600">{error?.message || 'Đề không tồn tại hoặc chưa được phát hành.'}</p><Link href="/app/tests" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Về danh sách đề</Link></div></main>;

  return (
    <main className="min-h-screen bg-[#FFF9FA] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/app/tests" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh sách đề</Link>
        <section className="mt-6 overflow-hidden rounded-[2rem] border border-[#FCE7F3] bg-white shadow-sm">
          <div className="bg-gradient-to-br from-[#FFF1F2] via-white to-[#FDF2F8] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F472B6]">{test.setName} · {test.source}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#493B42]">{test.name}</h1>
            {test.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">{test.description}</p>}
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-gray-600"><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2"><Clock3 className="h-4 w-4 text-[#F472B6]" aria-hidden="true" />{formatDuration(test.durationSeconds)} khi thi toàn bộ</span><span className="rounded-full bg-white px-3 py-2">{test.totalQuestions} câu trong đề</span></div>
          </div>
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <h2 className="text-lg font-extrabold text-[#493B42]">Chọn chế độ</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(['practice', 'exam'] as const).map((candidate) => <button key={candidate} type="button" onClick={() => { setMode(candidate); if (candidate === 'exam') setSelectedParts([...ALL_PARTS]); }} className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${mode === candidate ? 'border-[#F472B6] bg-[#FFF1F2] shadow-sm' : 'border-[#FCE7F3] bg-white hover:border-[#F9A8D4]'}`} aria-pressed={mode === candidate}><span className="font-extrabold text-[#493B42]">{candidate === 'exam' ? 'Thi toàn bộ' : 'Luyện tập'}</span><span className="mt-1 block text-sm leading-5 text-gray-600">{candidate === 'exam' ? 'Đủ 7 Part, có giới hạn thời gian.' : 'Chọn một hoặc nhiều Part để luyện riêng.'}</span></button>)}
              </div>
              <fieldset className="mt-6"><legend className="text-sm font-extrabold text-[#493B42]">Part sẽ học</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{ALL_PARTS.map((part) => { const checked = selectedParts.includes(part); return <button key={part} type="button" onClick={() => mode === 'practice' && togglePart(part)} disabled={mode === 'exam'} className={`flex min-h-12 items-center justify-between rounded-xl border px-3 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-75 ${checked ? 'border-[#F472B6] bg-[#FFF1F2] text-[#9D174D]' : 'border-[#FCE7F3] text-gray-500'}`} aria-pressed={checked}><span>Part {part}</span><span className="text-xs font-semibold">{partCounts[part] ?? (countsLoading ? '…' : '—')}</span></button>; })}</div></fieldset>
              <p className="mt-4 text-sm text-gray-500">{totalSelected > 0 ? `${totalSelected} câu sẽ được tạo vào phiên này.` : 'Đang tải số câu theo Part hoặc chưa chọn Part.'}</p>
            </div>
            <aside className="rounded-3xl border border-[#FCE7F3] bg-[#FFF8FA] p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F472B6]">Sẵn sàng?</p><p className="mt-2 text-sm leading-6 text-gray-600">Phiên sẽ được tạo và tập câu được snapshot ở server. Bạn có thể rời trang rồi tiếp tục sau.</p><button type="button" onClick={() => void start()} disabled={starting || selectedParts.length === 0} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F472B6] px-4 font-extrabold text-white shadow-sm transition hover:bg-[#DB2777] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-60">{starting ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Đang tạo phiên…</> : <>Bắt đầu {mode === 'exam' ? 'thi' : 'luyện'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}</button>{startError && <p className="mt-4 rounded-xl bg-[#FFF1F2] p-3 text-sm text-[#9D174D]" role="alert">{startError.message}</p>}{activeAttempt && <div className="mt-4 rounded-2xl border border-[#F9A8D4] bg-white p-4"><p className="text-sm font-bold text-[#493B42]">Bạn đã có một phiên đang làm.</p><p className="mt-1 text-xs text-gray-600">Tiếp tục phiên hiện tại để không tạo bài trùng.</p><button type="button" onClick={() => router.push(`/app/tests/attempts/${activeAttempt.attemptId}`)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#9D174D] px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Tiếp tục phiên</button></div>}</aside>
          </div>
        </section>
      </div>
    </main>
  );
}
