'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Flag, LoaderCircle, LogOut, RefreshCcw } from 'lucide-react';
import type { ToeicAttemptAnswerMutation, ToeicAttemptAnswerState, ToeicAttemptSession } from '../attemptContracts';
import type { ToeicOptionKey, ToeicTestPart } from '../types';
import { buildToeicAttemptContentModel, type ToeicAttemptContentQuestion } from '../contentModel';
import { getToeicAttemptSession, abandonToeicAttempt, saveToeicAttemptAnswers } from '../services/toeicAttemptService';
import { submitToeicAttempt } from '../services/toeicSubmissionService';
import { ToeicPartContentCache } from '../services/toeicPartContentCache';
import { createBrowserToeicMediaClient } from '../services/toeicMediaClient';
import { getRemainingToeicSeconds, getServerClockOffsetMs } from '../timer';
import { useToeicAutosaveController } from '../services/toeicAutosaveController';
import { canCheckToeicPracticeAnswer } from '../services/toeicPracticeFeedbackState';
import { checkToeicPracticeAnswer } from '../services/toeicLearningService';
import type { ToeicLearningVocabularyItem, ToeicPracticeFeedback } from '../learningContracts';
import { ToeicPassageRenderer } from './ToeicPassageRenderer';
import { ToeicMediaView } from './ToeicMediaView';
import { ToeicAbandonDialog } from './ToeicAbandonDialog';
import { ToeicSubmitDialog } from './ToeicSubmitDialog';
import { ToeicPracticeFeedbackPanel } from './ToeicPracticeFeedbackPanel';
import { ToeicVocabularySaveDialog } from './ToeicVocabularySaveDialog';

const OPTION_KEYS: ReadonlyArray<ToeicOptionKey> = ['A', 'B', 'C', 'D'];
const PARTS: ReadonlyArray<ToeicTestPart> = [1, 2, 3, 4, 5, 6, 7];

type LocalAnswer = Pick<ToeicAttemptAnswerState, 'selectedAnswer' | 'isFlagged' | 'answeredAt' | 'timeSpentSeconds'>;

function emptyAnswer(): LocalAnswer {
  return { selectedAnswer: null, isFlagged: false, answeredAt: null, timeSpentSeconds: null };
}

function formatTime(seconds: number | null) {
  if (seconds === null) return 'Không giới hạn';
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function sessionAnswersToMap(session: ToeicAttemptSession): Record<string, LocalAnswer> {
  return Object.fromEntries(session.answers.map((answer) => [answer.questionId, {
    selectedAnswer: answer.selectedAnswer,
    isFlagged: answer.isFlagged,
    answeredAt: answer.answeredAt,
    timeSpentSeconds: answer.timeSpentSeconds,
  }]));
}

function AutosaveIndicator({ status, pendingCount, onRetry }: { status: string; pendingCount: number; onRetry: () => void }) {
  if (status === 'error') return <div className="flex items-center gap-2 text-xs font-semibold text-[#9D174D]" role="status"><span>Chưa lưu được</span><button type="button" onClick={onRetry} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[#FFF1F2] px-2 text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Thử lại</button></div>;
  if (status === 'saving') return <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500" role="status"><LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Đang lưu{pendingCount ? ` · ${pendingCount} thay đổi` : ''}</span>;
  if (status === 'saved') return <span className="text-xs font-semibold text-emerald-600" role="status">Đã lưu</span>;
  if (status === 'pending') return <span className="text-xs font-semibold text-gray-500" role="status">Chờ lưu{pendingCount ? ` · ${pendingCount}` : ''}</span>;
  return <span className="text-xs font-semibold text-gray-500" role="status">Phiên đang sẵn sàng</span>;
}

function Palette({ session, answers, currentIndex, onSelect }: { session: ToeicAttemptSession; answers: Record<string, LocalAnswer>; currentIndex: number; onSelect: (index: number) => void }) {
  return <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">{session.questions.map((question, index) => { const answer = answers[question.questionId] ?? emptyAnswer(); const current = currentIndex === index; return <button key={question.questionId} type="button" onClick={() => onSelect(index)} className={`relative min-h-10 rounded-xl border text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${current ? 'border-[#9D174D] ring-2 ring-[#FBCFE8]' : answer.isFlagged ? 'border-amber-400 bg-amber-50 text-amber-700' : answer.selectedAnswer ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-[#FCE7F3] bg-white text-slate-700'}`} aria-label={`Câu ${index + 1}${answer.selectedAnswer ? ', đã trả lời' : ', chưa trả lời'}${answer.isFlagged ? ', đã đánh dấu' : ''}`} aria-current={current ? 'step' : undefined}>{index + 1}{answer.isFlagged && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />}</button>; })}</div>;
}

function AnswerOptions({ question, answer, disabled, onSelect }: { question: ToeicAttemptContentQuestion; answer: LocalAnswer; disabled: boolean; onSelect: (option: ToeicOptionKey) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Các lựa chọn trả lời">{OPTION_KEYS.map((option) => <button key={option} type="button" onClick={() => onSelect(option)} disabled={disabled || !question.question.options[option]} aria-pressed={answer.selectedAnswer === option} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-60 ${answer.selectedAnswer === option ? 'border-[#F472B6] bg-[#FFF1F2] text-[#9D174D] shadow-sm' : 'border-[#FCE7F3] bg-white text-[#493B42] hover:border-[#F9A8D4]'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${answer.selectedAnswer === option ? 'bg-[#F472B6] text-white' : 'bg-[#FFF1F2] text-[#9D174D]'}`}>{option}</span><span className="text-sm font-semibold">{question.question.options[option]}</span></button>)}</div>;
}

export function ToeicAttemptWorkspace({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<ToeicAttemptSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedParts, setLoadedParts] = useState<Partial<Record<ToeicTestPart, NonNullable<ReturnType<ToeicPartContentCache['getCached']>>>> >({});
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [contentError, setContentError] = useState<Error | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonBusy, setAbandonBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<ToeicPracticeFeedback | null>(null);
  const [practiceFeedbackLoading, setPracticeFeedbackLoading] = useState(false);
  const [practiceFeedbackError, setPracticeFeedbackError] = useState<Error | null>(null);
  const [practiceFeedbackErrorQuestionId, setPracticeFeedbackErrorQuestionId] = useState<string | null>(null);
  const [vocabularyToSave, setVocabularyToSave] = useState<ToeicLearningVocabularyItem | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitKeyRef = useRef<string | null>(null);
  const cacheRef = useRef(new ToeicPartContentCache(async (testId, part) => (await import('../services/toeicTestReadService')).getPublishedToeicTestPart(testId, part)));
  const mediaClient = useMemo(() => createBrowserToeicMediaClient(), []);
  const expiryChecked = useRef(false);
  const mountedRef = useRef(true);

  const save = useCallback((input: Parameters<typeof saveToeicAttemptAnswers>[0]) => saveToeicAttemptAnswers(input), []);
  const autosaveOptions = useMemo(() => ({ attemptId, save, debounceMs: 650 }), [attemptId, save]);
  const autosave = useToeicAutosaveController(autosaveOptions);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSession = await getToeicAttemptSession(attemptId);
      if (!mountedRef.current) return;
      setSession(nextSession);
      setAnswers(sessionAnswersToMap(nextSession));
      setRemaining(nextSession.remainingSeconds);
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause : new Error('Không thể tải phiên luyện đề'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadSession);
  }, [loadSession]);

  const currentRef = session?.questions[currentIndex] ?? null;
  const currentPart = currentRef?.part ?? null;

  useEffect(() => {
    if (!session || !currentPart || loadedParts[currentPart]) return;
    let active = true;
    // The loading marker mirrors an external async request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContentLoading(true);
    setContentError(null);
    void cacheRef.current.get(session.testId, currentPart).then((payload) => {
      if (active) setLoadedParts((current) => ({ ...current, [currentPart]: payload }));
    }).catch((cause) => {
      if (active) setContentError(cause instanceof Error ? cause : new Error('Không thể tải nội dung Part'));
    }).finally(() => { if (active) setContentLoading(false); });
    return () => { active = false; };
  }, [currentPart, loadedParts, session]);

  const currentPayload = currentPart ? loadedParts[currentPart] : undefined;
  const scopedSession = useMemo(() => session && currentPart ? { ...session, questions: session.questions.filter((question) => question.part === currentPart), totalQuestions: session.questions.filter((question) => question.part === currentPart).length } : null, [currentPart, session]);
  const currentModel = useMemo(() => scopedSession && currentPayload ? buildToeicAttemptContentModel({ session: scopedSession, partPayloads: [currentPayload] }) : null, [currentPayload, scopedSession]);
  const currentContent = currentModel?.questions.find((item) => item.ref.questionId === currentRef?.questionId) ?? null;
  const currentAnswer = currentRef ? answers[currentRef.questionId] ?? emptyAnswer() : emptyAnswer();
  const activePracticeFeedback = practiceFeedback?.questionId === currentRef?.questionId ? practiceFeedback : null;
  const activePracticeFeedbackError = practiceFeedbackErrorQuestionId === currentRef?.questionId ? practiceFeedbackError : null;
  const canMutate = session?.status === 'in_progress' && (remaining === null || remaining > 0);
  const canSubmit = session?.status === 'in_progress' || (session?.status === 'expired' && session.mode === 'exam');
  const serverOffset = useMemo(() => session ? getServerClockOffsetMs(session.serverNow) : 0, [session]);

  useEffect(() => {
    if (!session?.deadlineAt || session.status !== 'in_progress') return;
    const tick = () => setRemaining(getRemainingToeicSeconds(session, Date.now(), serverOffset));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [serverOffset, session]);

  useEffect(() => {
    if (remaining !== 0 || !session || session.status !== 'in_progress' || expiryChecked.current) return;
    expiryChecked.current = true;
    void getToeicAttemptSession(attemptId).then(setSession).catch(() => undefined);
  }, [attemptId, remaining, session]);

  useEffect(() => {
    if (session?.status === 'submitted') router.replace(`/app/tests/attempts/${attemptId}/result`);
  }, [attemptId, router, session?.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [role="dialog"]')) return;
      if (event.key >= '1' && event.key <= '4') {
        const option = OPTION_KEYS[Number(event.key) - 1];
        if (option) { event.preventDefault(); updateAnswer(option); }
      } else if (['a', 'b', 'c', 'd'].includes(event.key.toLowerCase())) {
        event.preventDefault(); updateAnswer(event.key.toUpperCase() as ToeicOptionKey);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault(); setCurrentIndex((index) => Math.min(index + 1, (session?.questions.length ?? 1) - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault(); setCurrentIndex((index) => Math.max(index - 1, 0));
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault(); toggleFlag();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const enqueueCurrent = (next: LocalAnswer) => {
    if (!currentRef || !canMutate) return;
    const mutation: ToeicAttemptAnswerMutation = { questionId: currentRef.questionId, ...next, clientMutationId: crypto.randomUUID() };
    autosave.enqueue(mutation);
  };

  function updateAnswer(option: ToeicOptionKey) {
    if (!currentRef || !canMutate || activePracticeFeedback) return;
    const next = { ...currentAnswer, selectedAnswer: option, answeredAt: new Date().toISOString() };
    setAnswers((current) => ({ ...current, [currentRef.questionId]: next }));
    enqueueCurrent(next);
  }

  async function checkPracticeAnswer() {
    if (!session || session.mode !== 'practice' || !currentRef || !currentAnswer.selectedAnswer || !canMutate || activePracticeFeedback || practiceFeedbackLoading) return;
    if (autosave.status === 'pending' || autosave.status === 'saving' || autosave.status === 'error') return;
    setPracticeFeedbackLoading(true);
    setPracticeFeedbackError(null);
    setPracticeFeedbackErrorQuestionId(null);
    try {
      const feedback = await checkToeicPracticeAnswer({ attemptId, questionId: currentRef.questionId });
      if (mountedRef.current) setPracticeFeedback(feedback);
    } catch (cause) {
      if (mountedRef.current) {
        setPracticeFeedbackError(cause instanceof Error ? cause : new Error('Không thể kiểm tra đáp án.'));
        setPracticeFeedbackErrorQuestionId(currentRef.questionId);
      }
    } finally {
      if (mountedRef.current) setPracticeFeedbackLoading(false);
    }
  }

  const canCheckPracticeAnswer = canCheckToeicPracticeAnswer({
    isPractice: session?.mode === 'practice',
    hasSelectedAnswer: Boolean(currentRef && currentAnswer.selectedAnswer),
    canMutate: Boolean(canMutate),
    hasFeedback: Boolean(activePracticeFeedback),
    loading: practiceFeedbackLoading,
    autosaveStatus: autosave.status,
  });

  function toggleFlag() {
    if (!currentRef || !canMutate) return;
    const next = { ...currentAnswer, isFlagged: !currentAnswer.isFlagged };
    setAnswers((current) => ({ ...current, [currentRef.questionId]: next }));
    enqueueCurrent(next);
  }

  const navigateToPart = (part: ToeicTestPart) => {
    const index = session?.questions.findIndex((question) => question.part === part) ?? -1;
    if (index >= 0) setCurrentIndex(index);
  };
  const exit = async () => {
    await autosave.flush();
    router.push('/app/tests');
  };
  const abandon = async () => {
    setAbandonBusy(true);
    try {
      const flushed = await autosave.flush();
      if (!flushed) throw new Error('Chưa lưu xong đáp án. Hãy thử lại trước khi bỏ bài.');
      await abandonToeicAttempt(attemptId);
      router.push('/app/tests');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Không thể bỏ bài lúc này.');
      setAbandonBusy(false);
      setAbandonOpen(false);
    }
  };

  const openSubmit = () => {
    if (!canSubmit) return;
    setSubmitError(autosave.status === 'error' ? 'Có thay đổi chưa lưu. Hãy thử lưu lại trước khi nộp bài.' : null);
    setSubmitOpen(true);
  };

  const retrySubmitAutosave = async () => {
    setSubmitError(null);
    const saved = await autosave.retry();
    if (!saved) setSubmitError('Chưa lưu được đáp án. Hãy kiểm tra kết nối và thử lại.');
  };

  const submit = async () => {
    if (!canSubmit || submitBusy) return;
    if (autosave.status === 'error') {
      setSubmitError('Có thay đổi chưa lưu. Hãy thử lưu lại trước khi nộp bài.');
      return;
    }
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      const flushed = await autosave.flush();
      if (!flushed) throw new Error('Không thể lưu hết đáp án. Hãy thử lưu lại trước khi nộp.');
      const idempotencyKey = submitKeyRef.current ?? crypto.randomUUID();
      submitKeyRef.current = idempotencyKey;
      const result = await submitToeicAttempt({ attemptId, idempotencyKey });
      router.replace(`/app/tests/attempts/${result.attemptId}/result`);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Không thể nộp bài lúc này.');
      setSubmitBusy(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-[#FFF9FA] p-6"><div className="mx-auto max-w-7xl animate-pulse space-y-4"><div className="h-16 rounded-2xl bg-white" /><div className="h-[60vh] rounded-3xl bg-white" /></div></main>;
  if (error || !session) return <main className="min-h-screen bg-[#FFF9FA] p-6"><div className="mx-auto max-w-xl rounded-3xl border border-[#FBCFE8] bg-white p-8 text-center" role="alert"><h1 className="text-xl font-extrabold text-[#493B42]">Không thể khôi phục phiên</h1><p className="mt-2 text-sm text-gray-600">{error?.message || 'Phiên không còn khả dụng.'}</p><button type="button" onClick={() => void loadSession()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại</button></div></main>;
  if (session.status === 'abandoned') return <main className="min-h-screen bg-[#FFF9FA] p-6"><div className="mx-auto max-w-xl rounded-3xl border border-[#FCE7F3] bg-white p-8 text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F472B6]">Phiên đã đóng</p><h1 className="mt-2 text-2xl font-black text-[#493B42]">Phiên đã bỏ</h1><p className="mt-2 text-sm text-gray-600">Phiên này không thể nộp lại.</p><button type="button" onClick={() => router.push('/app/tests')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Về danh sách đề</button></div></main>;

  return (
    <main className="min-h-screen bg-[#FFF9FA]" id="main-content">
      <header className="sticky top-0 z-30 border-b border-[#FCE7F3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="min-w-0"><p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-[#F472B6]">{currentContent?.question.section === 'listening' ? 'Listening' : 'Reading'} · {session.mode === 'exam' ? 'Thi toàn bộ' : 'Luyện tập'}</p><h1 className="truncate text-lg font-extrabold text-[#493B42]">Câu {currentIndex + 1} / {session.totalQuestions}</h1></div><div className="flex items-center gap-3"><AutosaveIndicator status={autosave.status} pendingCount={autosave.pendingCount} onRetry={() => void autosave.retry()} /><div className={`rounded-xl px-3 py-2 text-sm font-black ${remaining !== null && remaining < 300 ? 'bg-[#FFF1F2] text-[#E11D48]' : 'bg-[#FFF8FA] text-[#9D174D]'}`} aria-label={remaining === null ? 'Không giới hạn thời gian' : `Còn ${formatTime(remaining)}`}>⏱ {formatTime(remaining)}</div><button type="button" onClick={openSubmit} disabled={!canSubmit || submitBusy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F472B6] px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50">Nộp bài</button><button type="button" onClick={() => void exit()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Thoát</span></button></div></div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0">
          <div className="mb-4 flex items-center gap-2 overflow-x-auto rounded-2xl border border-[#FCE7F3] bg-white p-2" aria-label="Điều hướng Part">{PARTS.filter((part) => session.selectedParts.includes(part)).map((part) => <button key={part} type="button" onClick={() => navigateToPart(part)} className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${currentPart === part ? 'bg-[#F472B6] text-white' : 'text-gray-500 hover:bg-[#FFF1F2] hover:text-[#9D174D]'}`} aria-current={currentPart === part ? 'page' : undefined}>Part {part}</button>)}</div>
          <div className="rounded-3xl border border-[#FCE7F3] bg-white p-4 shadow-sm sm:p-6">
            {contentLoading && <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500" aria-live="polite"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-[#F472B6]" aria-hidden="true" /> Đang tải nội dung Part…</div>}
            {!contentLoading && contentError && <div className="rounded-2xl bg-[#FFF1F2] p-5 text-[#9D174D]" role="alert"><p className="font-bold">Không thể tải nội dung câu hỏi.</p><button type="button" onClick={() => { if (currentPart) { cacheRef.current.clear(); setLoadedParts((current) => { const next = { ...current }; delete next[currentPart]; return next; }); } }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại</button></div>}
            {!contentLoading && !contentError && currentContent && <>
              {currentContent.passage && <div className="mb-5 space-y-3"><ToeicPassageRenderer passage={currentContent.passage} /><ToeicMediaView testId={session.testId} path={currentContent.passage.audioPath} kind="audio" mediaClient={mediaClient} /></div>}
              <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#FFF1F2] px-3 py-1 text-xs font-bold text-[#9D174D]">Part {currentContent.ref.part} · Câu {currentContent.question.questionNumber}</span><button type="button" onClick={toggleFlag} disabled={!canMutate} aria-pressed={currentAnswer.isFlagged} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${currentAnswer.isFlagged ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-[#FCE7F3] text-gray-500'}`}><Flag className={`h-4 w-4 ${currentAnswer.isFlagged ? 'fill-amber-400' : ''}`} aria-hidden="true" /> {currentAnswer.isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</button></div><ToeicMediaView testId={session.testId} path={currentContent.question.imagePath} kind="image" alt={`Hình ảnh câu ${currentContent.question.questionNumber}`} mediaClient={mediaClient} /><ToeicMediaView testId={session.testId} path={currentContent.question.audioPath} kind="audio" mediaClient={mediaClient} /><h2 className="text-xl font-extrabold leading-8 text-[#493B42] sm:text-2xl">{currentContent.question.questionText || 'Hãy chọn đáp án phù hợp.'}</h2><AnswerOptions question={currentContent} answer={currentAnswer} disabled={!canMutate || Boolean(activePracticeFeedback)} onSelect={updateAnswer} />{session.mode === 'practice' && <div className="rounded-2xl border border-[#FCE7F3] bg-[#FFF9FB] p-4"><button type="button" onClick={() => void checkPracticeAnswer()} disabled={!canCheckPracticeAnswer} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50">{practiceFeedbackLoading ? 'Đang kiểm tra…' : activePracticeFeedback ? 'Đã kiểm tra' : 'Kiểm tra đáp án'}</button>{!activePracticeFeedback && <p className="mt-2 text-xs text-gray-500">Chọn đáp án và chờ trạng thái đã lưu rồi mới kiểm tra.</p>}<ToeicPracticeFeedbackPanel feedback={activePracticeFeedback} loading={practiceFeedbackLoading} error={activePracticeFeedbackError} onRetry={() => void checkPracticeAnswer()} onReset={() => { setPracticeFeedback(null); setPracticeFeedbackError(null); setPracticeFeedbackErrorQuestionId(null); }} onSaveVocabulary={setVocabularyToSave} /></div>}</div>
            </>}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3"><button type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FCE7F3] bg-white px-4 text-sm font-bold text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Câu trước</button><button type="button" onClick={() => setCurrentIndex((index) => Math.min(session.questions.length - 1, index + 1))} disabled={currentIndex === session.questions.length - 1} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-40">Câu tiếp <ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div>
        </section>
        <aside className="h-fit rounded-3xl border border-[#FCE7F3] bg-white p-4 shadow-sm lg:sticky lg:top-24"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-extrabold text-[#493B42]">Bảng câu hỏi</h2><span className="text-xs text-gray-500">{session.answers.length} đã lưu</span></div><p className="mt-1 text-xs text-gray-500">Màu chỉ thể hiện trạng thái trả lời và đánh dấu.</p><div className="mt-4"><Palette session={session} answers={answers} currentIndex={currentIndex} onSelect={setCurrentIndex} /></div><div className="mt-5 border-t border-[#FCE7F3] pt-4 space-y-2"><button type="button" onClick={openSubmit} disabled={!canSubmit || submitBusy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F472B6] text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50">Nộp bài</button><button type="button" onClick={() => setAbandonOpen(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FBCFE8] text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"><LogOut className="h-4 w-4" aria-hidden="true" /> Bỏ bài</button>{notice && <p className="mt-3 rounded-xl bg-[#FFF1F2] p-3 text-xs text-[#9D174D]" role="alert">{notice}</p>}</div></aside>
      </div>
      <ToeicAbandonDialog open={abandonOpen} busy={abandonBusy} onCancel={() => setAbandonOpen(false)} onConfirm={() => void abandon()} />
      <ToeicSubmitDialog open={submitOpen} busy={submitBusy} answered={Object.values(answers).filter((answer) => answer.selectedAnswer !== null).length} unanswered={Math.max(0, session.totalQuestions - Object.values(answers).filter((answer) => answer.selectedAnswer !== null).length)} flagged={Object.values(answers).filter((answer) => answer.isFlagged).length} remainingLabel={formatTime(remaining)} errorMessage={submitError} onRetry={() => void retrySubmitAutosave()} onCancel={() => { if (!submitBusy) setSubmitOpen(false); }} onConfirm={() => void submit()} />
      <ToeicVocabularySaveDialog item={vocabularyToSave} open={vocabularyToSave !== null} onClose={() => setVocabularyToSave(null)} />
    </main>
  );
}
