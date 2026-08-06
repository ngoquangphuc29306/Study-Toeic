"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flag,
  Grid2X2,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Volume2,
  X,
} from "lucide-react";
import type {
  ToeicAttemptAnswerMutation,
  ToeicAttemptAnswerState,
  ToeicAttemptSession,
} from "../attemptContracts";
import type { ToeicOptionKey, ToeicTestPart } from "../types";
import {
  buildToeicAttemptContentModel,
  type ToeicAttemptContentQuestion,
} from "../contentModel";
import {
  getToeicAttemptSession,
  abandonToeicAttempt,
  saveToeicAttemptAnswers,
} from "../services/toeicAttemptService";
import { submitToeicAttempt } from "../services/toeicSubmissionService";
import { ToeicPartContentCache } from "../services/toeicPartContentCache";
import { createBrowserToeicMediaClient } from "../services/toeicMediaClient";
import { getRemainingToeicSeconds, getServerClockOffsetMs } from "../timer";
import { useToeicAutosaveController } from "../services/toeicAutosaveController";
import {
  filterToeicPaletteQuestions,
  type ToeicPaletteFilter,
} from "../services/toeicPalette";
import { canCheckToeicPracticeAnswer } from "../services/toeicPracticeFeedbackState";
import { checkToeicPracticeAnswer } from "../services/toeicLearningService";
import {
  buildSelectionDraft,
  type ToeicTextSelectionDraft,
} from "../services/toeicAnnotationAnchoring";
import { listToeicAnnotations } from "../services/toeicToolService";
import type { ToeicTextAnnotation } from "../toolContracts";
import type {
  ToeicLearningVocabularyContent,
  ToeicLearningVocabularyItem,
  ToeicPracticeFeedback,
} from "../learningContracts";
import { ToeicPassageRenderer } from "./ToeicPassageRenderer";
import { ToeicMediaView } from "./ToeicMediaView";
import { ToeicAbandonDialog } from "./ToeicAbandonDialog";
import { ToeicSubmitDialog } from "./ToeicSubmitDialog";
import { ToeicPracticeFeedbackPanel } from "./ToeicPracticeFeedbackPanel";
import { ToeicLearningContentPanel } from "./ToeicLearningContentPanel";
import { ToeicVocabularySaveDialog } from "./ToeicVocabularySaveDialog";
import { ToeicAnnotatedText } from "./ToeicAnnotatedText";
import {
  ToeicLearningToolsPanel,
  ToeicNotesPanel,
} from "./ToeicLearningToolsPanel";

const OPTION_KEYS: ReadonlyArray<ToeicOptionKey> = ["A", "B", "C", "D"];
const PARTS: ReadonlyArray<ToeicTestPart> = [1, 2, 3, 4, 5, 6, 7];
const GROUPED_PASSAGE_PARTS = new Set<ToeicTestPart>([3, 4, 6, 7]);

type LocalAnswer = Pick<
  ToeicAttemptAnswerState,
  "selectedAnswer" | "isFlagged" | "answeredAt" | "timeSpentSeconds"
>;

function emptyAnswer(): LocalAnswer {
  return {
    selectedAnswer: null,
    isFlagged: false,
    answeredAt: null,
    timeSpentSeconds: null,
  };
}

function formatTime(seconds: number | null) {
  if (seconds === null) return "Không giới hạn";
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function sessionAnswersToMap(
  session: ToeicAttemptSession,
): Record<string, LocalAnswer> {
  return Object.fromEntries(
    session.answers.map((answer) => [
      answer.questionId,
      {
        selectedAnswer: answer.selectedAnswer,
        isFlagged: answer.isFlagged,
        answeredAt: answer.answeredAt,
        timeSpentSeconds: answer.timeSpentSeconds,
      },
    ]),
  );
}

function AutosaveIndicator({
  status,
  pendingCount,
  onRetry,
}: {
  status: string;
  pendingCount: number;
  onRetry: () => void;
}) {
  if (status === "error")
    return (
      <div
        className="flex items-center gap-2 text-xs font-semibold text-[#9D174D]"
        role="status"
      >
        <span>Chưa lưu được</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[#FFF1F2] px-2 text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Thử lại
        </button>
      </div>
    );
  if (status === "saving")
    return (
      <span
        className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500"
        role="status"
      >
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{" "}
        Đang lưu{pendingCount ? ` · ${pendingCount} thay đổi` : ""}
      </span>
    );
  if (status === "saved")
    return (
      <span className="text-xs font-semibold text-emerald-600" role="status">
        Đã lưu
      </span>
    );
  if (status === "pending")
    return (
      <span className="text-xs font-semibold text-gray-500" role="status">
        Chờ lưu{pendingCount ? ` · ${pendingCount}` : ""}
      </span>
    );
  return (
    <span className="text-xs font-semibold text-gray-500" role="status">
      Phiên đang sẵn sàng
    </span>
  );
}

function Palette({
  session,
  answers,
  currentIndex,
  onSelect,
}: {
  session: ToeicAttemptSession;
  answers: Record<string, LocalAnswer>;
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
      {session.questions.map((question, index) => {
        const answer = answers[question.questionId] ?? emptyAnswer();
        const current = currentIndex === index;
        return (
          <button
            key={question.questionId}
            type="button"
            onClick={() => onSelect(index)}
            className={`relative min-h-10 rounded-xl border text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${current ? "border-[#9D174D] ring-2 ring-[#FBCFE8]" : answer.isFlagged ? "border-amber-400 bg-amber-50 text-amber-700" : answer.selectedAnswer ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-[#FCE7F3] bg-white text-slate-700"}`}
            aria-label={`Câu ${index + 1}${answer.selectedAnswer ? ", đã trả lời" : ", chưa trả lời"}${answer.isFlagged ? ", đã đánh dấu" : ""}`}
            aria-current={current ? "step" : undefined}
          >
            {index + 1}
            {answer.isFlagged && (
              <Flag
                className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-400 text-amber-500"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function AnswerOptions({
  question,
  answer,
  disabled,
  compact,
  feedback,
  onSelect,
}: {
  question: ToeicAttemptContentQuestion;
  answer: LocalAnswer;
  disabled: boolean;
  compact: boolean;
  /** Answer-key data is only present after the authorized Practice feedback RPC. */
  feedback?: ToeicPracticeFeedback | null;
  onSelect: (option: ToeicOptionKey) => void;
}) {
  return (
    <div className="grid gap-3" role="group" aria-label="Các lựa chọn trả lời">
      {OPTION_KEYS.map((option) => {
        const optionStatus = feedback
          ? option === feedback.correctAnswer
            ? "correct"
            : option === feedback.selectedAnswer
              ? "incorrect"
              : "neutral"
          : answer.selectedAnswer === option
            ? "selected"
            : "neutral";
        const buttonClass =
          optionStatus === "correct"
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : optionStatus === "incorrect"
              ? "border-rose-400 bg-rose-50 text-rose-700"
              : optionStatus === "selected"
                ? "border-[#F472B6] bg-[#FFF1F2] text-[#9D174D] shadow-sm"
                : "border-[#FCE7F3] bg-white text-[#493B42] hover:border-[#F9A8D4]";
        const badgeClass =
          optionStatus === "correct"
            ? "bg-emerald-500 text-white"
            : optionStatus === "incorrect"
              ? "bg-rose-500 text-white"
              : optionStatus === "selected"
                ? "bg-[#F472B6] text-white"
                : "bg-[#FFF1F2] text-[#9D174D]";
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            disabled={disabled || !question.question.options[option]}
            aria-pressed={answer.selectedAnswer === option}
            className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${badgeClass}`}
            >
              {option}
            </span>
            {compact ? (
              <span className="text-sm font-bold">({option})</span>
            ) : (
              <span className="text-sm font-semibold">
                {question.question.options[option]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PracticeAnswerFeedback({
  canCheck,
  feedback,
  loading,
  error,
  onCheck,
  onRetry,
  onReset,
  onSaveVocabulary,
  hideTranscript,
}: {
  canCheck: boolean;
  feedback: ToeicPracticeFeedback | null;
  loading: boolean;
  error: Error | null;
  onCheck: () => void;
  onRetry: () => void;
  onReset: () => void;
  onSaveVocabulary: (item: ToeicLearningVocabularyItem) => void;
  hideTranscript: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#FCE7F3] bg-[#FFF9FB] p-4">
      <button
        type="button"
        onClick={onCheck}
        disabled={!canCheck}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Đang kiểm tra…"
          : feedback
            ? "Đã kiểm tra"
            : "Kiểm tra đáp án"}
      </button>
      {!feedback && (
        <p className="mt-2 text-xs text-slate-500">
          Chọn đáp án và chờ trạng thái đã lưu rồi mới kiểm tra.
        </p>
      )}
      <ToeicPracticeFeedbackPanel
        feedback={feedback}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onReset={onReset}
        onSaveVocabulary={onSaveVocabulary}
        showTranscript={!hideTranscript}
        showTranslation={!hideTranscript}
      />
    </div>
  );
}

export function ToeicAttemptWorkspace({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<ToeicAttemptSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedParts, setLoadedParts] = useState<
    Partial<
      Record<
        ToeicTestPart,
        NonNullable<ReturnType<ToeicPartContentCache["getCached"]>>
      >
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [contentError, setContentError] = useState<Error | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonBusy, setAbandonBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [practiceFeedbackByQuestion, setPracticeFeedbackByQuestion] = useState<
    Record<string, ToeicPracticeFeedback>
  >({});
  const [practiceFeedbackLoadingIds, setPracticeFeedbackLoadingIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const [practiceFeedbackErrors, setPracticeFeedbackErrors] = useState<
    Record<string, Error>
  >({});
  const [vocabularyToSave, setVocabularyToSave] =
    useState<ToeicLearningVocabularyItem | null>(null);
  const [annotations, setAnnotations] = useState<
    ReadonlyArray<ToeicTextAnnotation>
  >([]);
  const [selection, setSelection] = useState<ToeicTextSelectionDraft | null>(
    null,
  );
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState<ToeicPaletteFilter>("all");
  const submitKeyRef = useRef<string | null>(null);
  const cacheRef = useRef(
    new ToeicPartContentCache(async (testId, part) =>
      (
        await import("../services/toeicTestReadService")
      ).getPublishedToeicTestPart(testId, part),
    ),
  );
  const mediaClient = useMemo(() => createBrowserToeicMediaClient(), []);
  const expiryChecked = useRef(false);
  const mountedRef = useRef(true);

  const save = useCallback(
    (input: Parameters<typeof saveToeicAttemptAnswers>[0]) =>
      saveToeicAttemptAnswers(input),
    [],
  );
  const autosaveOptions = useMemo(
    () => ({ attemptId, save, debounceMs: 650 }),
    [attemptId, save],
  );
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
      setError(
        cause instanceof Error
          ? cause
          : new Error("Không thể tải phiên luyện đề"),
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadSession);
  }, [loadSession]);

  useEffect(() => {
    if (!session?.testId) return;
    let active = true;
    void listToeicAnnotations(session.testId)
      .then((value) => {
        if (active) setAnnotations(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session?.testId]);

  const currentRef = session?.questions[currentIndex] ?? null;
  const currentPart = currentRef?.part ?? null;

  useEffect(() => {
    if (!session || !currentPart || loadedParts[currentPart]) return;
    let active = true;
    // The loading marker mirrors an external async request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContentLoading(true);
    setContentError(null);
    void cacheRef.current
      .get(session.testId, currentPart)
      .then((payload) => {
        if (active)
          setLoadedParts((current) => ({ ...current, [currentPart]: payload }));
      })
      .catch((cause) => {
        if (active)
          setContentError(
            cause instanceof Error
              ? cause
              : new Error("Không thể tải nội dung Part"),
          );
      })
      .finally(() => {
        if (active) setContentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPart, loadedParts, session]);

  const currentPayload = currentPart ? loadedParts[currentPart] : undefined;
  const scopedSession = useMemo(
    () =>
      session && currentPart
        ? {
            ...session,
            questions: session.questions.filter(
              (question) => question.part === currentPart,
            ),
            totalQuestions: session.questions.filter(
              (question) => question.part === currentPart,
            ).length,
          }
        : null,
    [currentPart, session],
  );
  const currentModel = useMemo(
    () =>
      scopedSession && currentPayload
        ? buildToeicAttemptContentModel({
            session: scopedSession,
            partPayloads: [currentPayload],
          })
        : null,
    [currentPayload, scopedSession],
  );
  const currentContent =
    currentModel?.questions.find(
      (item) => item.ref.questionId === currentRef?.questionId,
    ) ?? null;
  const groupedContents = useMemo(() => {
    if (
      !currentContent ||
      !currentModel ||
      !GROUPED_PASSAGE_PARTS.has(currentContent.ref.part) ||
      !currentContent.question.passageId
    )
      return currentContent ? [currentContent] : [];
    return currentModel.questions
      .filter(
        (item) => item.question.passageId === currentContent.question.passageId,
      )
      .sort(
        (left, right) =>
          left.question.questionNumber - right.question.questionNumber,
      );
  }, [currentContent, currentModel]);
  const currentAnswer = currentRef
    ? (answers[currentRef.questionId] ?? emptyAnswer())
    : emptyAnswer();
  const paletteSession = useMemo(() => {
    if (!session) return null;
    const questions = filterToeicPaletteQuestions(
      session.questions,
      answers,
      paletteFilter,
    );
    return { ...session, questions };
  }, [answers, paletteFilter, session]);
  const paletteCurrentIndex = useMemo(
    () =>
      currentRef && paletteSession
        ? paletteSession.questions.findIndex(
            (question) => question.questionId === currentRef.questionId,
          )
        : -1,
    [currentRef, paletteSession],
  );
  const currentAnnotations = useMemo(
    () =>
      annotations.filter(
        (annotation) =>
          annotation.questionId === currentRef?.questionId ||
          annotation.passageId === currentContent?.passage?.id,
      ),
    [annotations, currentContent?.passage?.id, currentRef?.questionId],
  );
  const currentSelection =
    selection &&
    (selection.questionId === currentRef?.questionId ||
      selection.passageId === currentContent?.passage?.id)
      ? selection
      : null;
  const activePracticeFeedback = currentRef
    ? (practiceFeedbackByQuestion[currentRef.questionId] ?? null)
    : null;
  const activePracticeFeedbackError = currentRef
    ? (practiceFeedbackErrors[currentRef.questionId] ?? null)
    : null;
  const practiceFeedbackLoading = currentRef
    ? practiceFeedbackLoadingIds.has(currentRef.questionId)
    : false;
  const canMutate =
    session?.status === "in_progress" && (remaining === null || remaining > 0);
  const canSubmit =
    session?.status === "in_progress" ||
    (session?.status === "expired" && session.mode === "exam");
  const serverOffset = useMemo(
    () => (session ? getServerClockOffsetMs(session.serverNow) : 0),
    [session],
  );

  useEffect(() => {
    if (!session?.deadlineAt || session.status !== "in_progress") return;
    const tick = () =>
      setRemaining(getRemainingToeicSeconds(session, Date.now(), serverOffset));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [serverOffset, session]);

  useEffect(() => {
    if (
      remaining !== 0 ||
      !session ||
      session.status !== "in_progress" ||
      expiryChecked.current
    )
      return;
    expiryChecked.current = true;
    void getToeicAttemptSession(attemptId)
      .then(setSession)
      .catch(() => undefined);
  }, [attemptId, remaining, session]);

  useEffect(() => {
    if (session?.status === "submitted")
      router.replace(`/app/tests/attempts/${attemptId}/result`);
  }, [attemptId, router, session?.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [role="dialog"]')) return;
      if (event.key >= "1" && event.key <= "4") {
        const option = OPTION_KEYS[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          updateAnswer(option);
        }
      } else if (["a", "b", "c", "d"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        updateAnswer(event.key.toUpperCase() as ToeicOptionKey);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentIndex((index) =>
          Math.min(index + 1, (session?.questions.length ?? 1) - 1),
        );
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex((index) => Math.max(index - 1, 0));
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFlag();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const enqueueAnswer = (questionId: string, next: LocalAnswer) => {
    if (!canMutate) return;
    const mutation: ToeicAttemptAnswerMutation = {
      questionId,
      ...next,
      clientMutationId: crypto.randomUUID(),
    };
    autosave.enqueue(mutation);
  };

  function updateAnswer(option: ToeicOptionKey) {
    if (!currentRef || !canMutate || activePracticeFeedback) return;
    updateAnswerForQuestion(currentRef.questionId, option, true);
  }

  function updateAnswerForQuestion(
    questionId: string,
    option: ToeicOptionKey,
    lockAfterFeedback = false,
  ) {
    if (!canMutate || (lockAfterFeedback && activePracticeFeedback)) return;
    const current = answers[questionId] ?? emptyAnswer();
    const next = {
      ...current,
      selectedAnswer: option,
      answeredAt: new Date().toISOString(),
    };
    setAnswers((previous) => ({ ...previous, [questionId]: next }));
    enqueueAnswer(questionId, next);
  }

  async function checkPracticeAnswer() {
    if (
      !session ||
      session.mode !== "practice" ||
      !currentRef ||
      !currentAnswer.selectedAnswer ||
      !canMutate ||
      activePracticeFeedback ||
      practiceFeedbackLoading
    )
      return;
    if (
      autosave.status === "pending" ||
      autosave.status === "saving" ||
      autosave.status === "error"
    )
      return;
    setPracticeFeedbackLoadingIds(
      (current) => new Set([...current, currentRef.questionId]),
    );
    setPracticeFeedbackErrors((current) => {
      const next = { ...current };
      delete next[currentRef.questionId];
      return next;
    });
    try {
      const feedback = await checkToeicPracticeAnswer({
        attemptId,
        questionId: currentRef.questionId,
      });
      if (mountedRef.current)
        setPracticeFeedbackByQuestion((current) => ({
          ...current,
          [feedback.questionId]: feedback,
        }));
    } catch (cause) {
      if (mountedRef.current) {
        setPracticeFeedbackErrors((current) => ({
          ...current,
          [currentRef.questionId]:
            cause instanceof Error
              ? cause
              : new Error("Không thể kiểm tra đáp án."),
        }));
      }
    } finally {
      if (mountedRef.current)
        setPracticeFeedbackLoadingIds((current) => {
          const next = new Set(current);
          next.delete(currentRef.questionId);
          return next;
        });
    }
  }

  function clearPracticeFeedback(questionId: string) {
    setPracticeFeedbackByQuestion((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setPracticeFeedbackErrors((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  async function checkPracticeGroupAnswers() {
    if (
      !session ||
      session.mode !== "practice" ||
      groupedContents.length < 2 ||
      !canMutate ||
      autosave.status === "pending" ||
      autosave.status === "saving" ||
      autosave.status === "error"
    )
      return;

    const questionsToCheck = groupedContents.filter(
      (item) =>
        Boolean(answers[item.ref.questionId]?.selectedAnswer) &&
        !practiceFeedbackByQuestion[item.ref.questionId],
    );
    if (questionsToCheck.length === 0) return;

    const questionIds = questionsToCheck.map((item) => item.ref.questionId);
    setPracticeFeedbackLoadingIds(
      (current) => new Set([...current, ...questionIds]),
    );
    setPracticeFeedbackErrors((current) => {
      const next = { ...current };
      for (const questionId of questionIds) delete next[questionId];
      return next;
    });

    const outcomes = await Promise.allSettled(
      questionIds.map(async (questionId) => ({
        questionId,
        feedback: await checkToeicPracticeAnswer({ attemptId, questionId }),
      })),
    );
    if (!mountedRef.current) return;

    setPracticeFeedbackByQuestion((current) => {
      const next = { ...current };
      for (const outcome of outcomes) {
        if (outcome.status === "fulfilled") {
          next[outcome.value.feedback.questionId] = outcome.value.feedback;
        }
      }
      return next;
    });
    setPracticeFeedbackErrors((current) => {
      const next = { ...current };
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") {
          const questionId = questionIds[outcomes.indexOf(outcome)];
          if (questionId) {
            next[questionId] =
              outcome.reason instanceof Error
                ? outcome.reason
                : new Error("Không thể kiểm tra đáp án.");
          }
        }
      }
      return next;
    });
    setPracticeFeedbackLoadingIds((current) => {
      const next = new Set(current);
      for (const questionId of questionIds) next.delete(questionId);
      return next;
    });
  }

  const canCheckPracticeAnswer = canCheckToeicPracticeAnswer({
    isPractice: session?.mode === "practice",
    hasSelectedAnswer: Boolean(currentRef && currentAnswer.selectedAnswer),
    canMutate: Boolean(canMutate),
    hasFeedback: Boolean(activePracticeFeedback),
    loading: practiceFeedbackLoading,
    autosaveStatus: autosave.status,
  });
  const groupHasAllAnswers =
    groupedContents.length > 1 &&
    groupedContents.every((item) =>
      Boolean(answers[item.ref.questionId]?.selectedAnswer),
    );
  const groupHasPendingFeedback = groupedContents.some(
    (item) => !practiceFeedbackByQuestion[item.ref.questionId],
  );
  const groupFeedbackLoading = groupedContents.some((item) =>
    practiceFeedbackLoadingIds.has(item.ref.questionId),
  );
  const groupVocabulary = useMemo<ToeicLearningVocabularyContent | null>(() => {
    if (groupedContents.length < 2) return null;
    const items = new Map<string, ToeicLearningVocabularyItem>();
    const rawEntries = new Set<string>();
    for (const item of groupedContents) {
      const vocabulary =
        practiceFeedbackByQuestion[item.ref.questionId]?.vocabulary;
      if (!vocabulary) continue;
      for (const vocabularyItem of vocabulary.items) {
        const key = `${vocabularyItem.word.trim().toLocaleLowerCase("en-US")}|${vocabularyItem.partOfSpeech ?? ""}`;
        if (!items.has(key)) items.set(key, vocabularyItem);
      }
      if (vocabulary.raw?.trim()) rawEntries.add(vocabulary.raw.trim());
    }
    if (items.size === 0 && rawEntries.size === 0) return null;
    return {
      items: [...items.values()],
      raw: rawEntries.size > 0 ? [...rawEntries].join("\n") : null,
    };
  }, [groupedContents, practiceFeedbackByQuestion]);
  const canCheckPracticeGroup =
    session?.mode === "practice" &&
    groupHasAllAnswers &&
    groupHasPendingFeedback &&
    !groupFeedbackLoading &&
    Boolean(canMutate) &&
    autosave.status !== "pending" &&
    autosave.status !== "saving" &&
    autosave.status !== "error";
  const answeredCount = Object.values(answers).filter(
    (answer) => answer.selectedAnswer !== null,
  ).length;
  const isListening = currentContent?.question.section === "listening";
  const compactExamChoices =
    session?.mode === "exam" && (currentPart === 1 || currentPart === 2);
  const showLearningContentBesidePassage =
    session?.mode === "practice" &&
    currentPart !== null &&
    GROUPED_PASSAGE_PARTS.has(currentPart);

  function toggleFlag() {
    if (!currentRef || !canMutate) return;
    const next = { ...currentAnswer, isFlagged: !currentAnswer.isFlagged };
    setAnswers((current) => ({ ...current, [currentRef.questionId]: next }));
    enqueueAnswer(currentRef.questionId, next);
  }

  const navigateToPart = (part: ToeicTestPart) => {
    const index =
      session?.questions.findIndex((question) => question.part === part) ?? -1;
    if (index >= 0) setCurrentIndex(index);
  };
  const exit = async () => {
    await autosave.flush();
    router.push("/app/tests");
  };
  const abandon = async () => {
    setAbandonBusy(true);
    try {
      const flushed = await autosave.flush();
      if (!flushed)
        throw new Error("Chưa lưu xong đáp án. Hãy thử lại trước khi bỏ bài.");
      await abandonToeicAttempt(attemptId);
      router.push("/app/tests");
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Không thể bỏ bài lúc này.",
      );
      setAbandonBusy(false);
      setAbandonOpen(false);
    }
  };

  const openSubmit = () => {
    if (!canSubmit) return;
    setSubmitError(
      autosave.status === "error"
        ? "Có thay đổi chưa lưu. Hãy thử lưu lại trước khi nộp bài."
        : null,
    );
    setSubmitOpen(true);
  };

  const retrySubmitAutosave = async () => {
    setSubmitError(null);
    const saved = await autosave.retry();
    if (!saved)
      setSubmitError("Chưa lưu được đáp án. Hãy kiểm tra kết nối và thử lại.");
  };

  const submit = async () => {
    if (!canSubmit || submitBusy) return;
    if (autosave.status === "error") {
      setSubmitError(
        "Có thay đổi chưa lưu. Hãy thử lưu lại trước khi nộp bài.",
      );
      return;
    }
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      const flushed = await autosave.flush();
      if (!flushed)
        throw new Error(
          "Không thể lưu hết đáp án. Hãy thử lưu lại trước khi nộp.",
        );
      const idempotencyKey = submitKeyRef.current ?? crypto.randomUUID();
      submitKeyRef.current = idempotencyKey;
      const result = await submitToeicAttempt({ attemptId, idempotencyKey });
      router.replace(`/app/tests/attempts/${result.attemptId}/result`);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : "Không thể nộp bài lúc này.",
      );
      setSubmitBusy(false);
    }
  };

  if (loading)
    return (
      <main className="min-h-screen bg-[#FFF9FA] p-6">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-16 rounded-2xl bg-white" />
          <div className="h-[60vh] rounded-3xl bg-white" />
        </div>
      </main>
    );
  if (error || !session)
    return (
      <main className="min-h-screen bg-[#FFF9FA] p-6">
        <div
          className="mx-auto max-w-xl rounded-3xl border border-[#FBCFE8] bg-white p-8 text-center"
          role="alert"
        >
          <h1 className="text-xl font-extrabold text-[#493B42]">
            Không thể khôi phục phiên
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {error?.message || "Phiên không còn khả dụng."}
          </p>
          <button
            type="button"
            onClick={() => void loadSession()}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại
          </button>
        </div>
      </main>
    );
  if (session.status === "abandoned")
    return (
      <main className="min-h-screen bg-[#FFF9FA] p-6">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#FCE7F3] bg-white p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F472B6]">
            Phiên đã đóng
          </p>
          <h1 className="mt-2 text-2xl font-black text-[#493B42]">
            Phiên đã bỏ
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Phiên này không thể nộp lại.
          </p>
          <button
            type="button"
            onClick={() => router.push("/app/tests")}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Về danh sách đề
          </button>
        </div>
      </main>
    );

  return (
    <main className="min-h-[100dvh] bg-[#F8FAFC] pb-20" id="main-content">
      <header
        className={`sticky top-0 z-30 border-b ${session.mode === "exam" ? "border-[#1E3A5F] bg-[#1E3A5F] text-white" : "border-[#FCE7F3] bg-white/95 text-[#493B42] backdrop-blur"}`}
      >
        <div className="mx-auto flex min-h-16 max-w-none flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => void exit()}
              className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${session.mode === "exam" ? "bg-white/10 text-white" : "text-slate-600 hover:bg-pink-50"}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Thoát
            </button>
            <div className="min-w-0">
              <p
                className={`truncate text-[11px] font-bold uppercase tracking-[0.12em] ${session.mode === "exam" ? "text-pink-100" : "text-[#F472B6]"}`}
              >
                {session.mode === "exam" ? "Thi thử TOEIC" : "Luyện tập TOEIC"}
              </p>
              <h1 className="truncate text-sm font-extrabold sm:text-lg">
                {isListening ? "Listening" : "Reading"}: Question{" "}
                {currentIndex + 1} of {session.totalQuestions}
              </h1>
            </div>
          </div>
          {session.mode === "practice" && currentContent && (
            <div className="order-3 w-full lg:order-none lg:w-auto lg:max-w-[620px]">
              <ToeicLearningToolsPanel
                key={currentContent.question.id}
                testId={session.testId}
                questionId={currentContent.question.id}
                isPractice
                feedback={activePracticeFeedback}
                annotations={annotations}
                selection={currentSelection}
                showLabel={false}
                onOpenNotes={() => setNotesPanelOpen(true)}
                onAnnotationCreated={(annotation) =>
                  setAnnotations((current) => [...current, annotation])
                }
                onAnnotationDeleted={(id) =>
                  setAnnotations((current) =>
                    current.filter((annotation) => annotation.id !== id),
                  )
                }
                onClearSelection={() => {
                  window.getSelection()?.removeAllRanges();
                  setSelection(null);
                }}
                onSaveVocabulary={setVocabularyToSave}
              />
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            <AutosaveIndicator
              status={autosave.status}
              pendingCount={autosave.pendingCount}
              onRetry={() => void autosave.retry()}
            />
            <button
              type="button"
              disabled
              title="Điều khiển audio nằm trong vùng nội dung"
              className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl ${session.mode === "exam" ? "bg-white/10 text-white/70" : "border border-sky-200 bg-sky-50 text-sky-600"} disabled:cursor-not-allowed`}
              aria-label="Điều khiển âm thanh trong nội dung"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <span
              className={`rounded-xl px-3 py-2 text-sm font-black ${session.mode === "exam" ? "bg-white text-[#1E3A5F]" : "bg-emerald-50 text-emerald-700"}`}
            >
              {answeredCount}/{session.totalQuestions}
            </span>
            <div
              className={`rounded-xl px-3 py-2 text-sm font-black ${remaining !== null && remaining < 300 ? "bg-[#FFF1F2] text-[#E11D48]" : session.mode === "exam" ? "bg-white text-[#1E3A5F]" : "bg-[#FFF8FA] text-[#9D174D]"}`}
              aria-label={
                remaining === null
                  ? "Không giới hạn thời gian"
                  : `Còn ${formatTime(remaining)}`
              }
            >
              {formatTime(remaining)}
            </div>
            <button
              type="button"
              onClick={openSubmit}
              disabled={!canSubmit || submitBusy}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F472B6] px-3 text-sm font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Nộp bài
            </button>
          </div>
        </div>
      </header>
      <div className="relative mx-auto max-w-[1920px] px-4 py-4 sm:px-6">
        <section className="min-w-0">
          <div
            className="mb-4 flex items-center gap-2 overflow-x-auto rounded-2xl border border-[#FCE7F3] bg-white p-2"
            aria-label="Điều hướng Part"
          >
            {PARTS.filter((part) => session.selectedParts.includes(part)).map(
              (part) => (
                <button
                  key={part}
                  type="button"
                  onClick={() => navigateToPart(part)}
                  className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${currentPart === part ? "bg-[#F472B6] text-white" : "text-gray-500 hover:bg-[#FFF1F2] hover:text-[#9D174D]"}`}
                  aria-current={currentPart === part ? "page" : undefined}
                >
                  Part {part}
                </button>
              ),
            )}
          </div>
          <div
            className="rounded-3xl border border-[#FCE7F3] bg-white p-4 shadow-sm sm:p-6"
            onMouseUp={() =>
              setSelection(buildSelectionDraft(window.getSelection()))
            }
          >
            {contentLoading && (
              <div
                className="flex min-h-[420px] items-center justify-center text-sm text-gray-500"
                aria-live="polite"
              >
                <LoaderCircle
                  className="mr-2 h-5 w-5 animate-spin text-[#F472B6]"
                  aria-hidden="true"
                />{" "}
                Đang tải nội dung Part…
              </div>
            )}
            {!contentLoading && contentError && (
              <div
                className="rounded-2xl bg-[#FFF1F2] p-5 text-[#9D174D]"
                role="alert"
              >
                <p className="font-bold">Không thể tải nội dung câu hỏi.</p>
                <button
                  type="button"
                  onClick={() => {
                    if (currentPart) {
                      cacheRef.current.clear();
                      setLoadedParts((current) => {
                        const next = { ...current };
                        delete next[currentPart];
                        return next;
                      });
                    }
                  }}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại
                </button>
              </div>
            )}
            {!contentLoading && !contentError && currentContent && (
              <>
                <div className="grid min-h-[calc(100dvh-15rem)] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
                  <section className="min-w-0 border-b border-slate-200 bg-white p-4 sm:p-7 lg:border-b-0 lg:border-r">
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {currentContent.passage?.title ||
                          (isListening
                            ? "Listen and select the best response."
                            : "Read and select the best answer.")}
                      </p>
                      {currentContent.passage && (
                        <>
                          <ToeicPassageRenderer
                            passage={currentContent.passage}
                            annotations={currentAnnotations}
                          />
                          <ToeicMediaView
                            testId={session.testId}
                            path={currentContent.passage.imagePath}
                            kind="image"
                            alt="Hình minh họa của đoạn TOEIC"
                            mediaClient={mediaClient}
                          />
                          <ToeicMediaView
                            testId={session.testId}
                            path={currentContent.passage.audioPath}
                            kind="audio"
                            mediaClient={mediaClient}
                          />
                        </>
                      )}
                      <ToeicMediaView
                        testId={session.testId}
                        path={currentContent.question.imagePath}
                        kind="image"
                        alt={`Hình ảnh câu ${currentContent.question.questionNumber}`}
                        mediaClient={mediaClient}
                      />
                      <ToeicMediaView
                        testId={session.testId}
                        path={currentContent.question.audioPath}
                        kind="audio"
                        mediaClient={mediaClient}
                      />
                      {showLearningContentBesidePassage && (
                        <div
                          className="mt-5 space-y-3"
                          aria-label="Nội dung học của đoạn"
                        >
                          {(isListening ||
                            activePracticeFeedback?.transcript) && (
                            <details
                              className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/70"
                              open={Boolean(activePracticeFeedback?.transcript)}
                            >
                              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-extrabold text-blue-700 marker:content-none">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs">
                                  ▤
                                </span>
                                Transcript
                              </summary>
                              <div className="border-t border-blue-100 px-4 py-3 text-sm leading-6 text-slate-700">
                                {activePracticeFeedback?.transcript ? (
                                  <p className="whitespace-pre-wrap">
                                    {activePracticeFeedback.transcript}
                                  </p>
                                ) : (
                                  <p className="text-slate-500">
                                    Kiểm tra đáp án để mở transcript của đoạn
                                    audio.
                                  </p>
                                )}
                              </div>
                            </details>
                          )}
                          <details
                            className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/70"
                            open={Boolean(activePracticeFeedback?.translation)}
                          >
                            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-extrabold text-violet-700 marker:content-none">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs">
                                A文
                              </span>
                              {isListening
                                ? "Dịch nghĩa Transcript"
                                : "Bản dịch đoạn đọc"}
                            </summary>
                            <div className="border-t border-violet-100 px-4 py-3 text-sm leading-6 text-slate-700">
                              {activePracticeFeedback?.translation ? (
                                <p className="whitespace-pre-wrap">
                                  {activePracticeFeedback.translation}
                                </p>
                              ) : (
                                <p className="text-slate-500">
                                  Bản dịch sẽ hiện sau khi phản hồi học tập được
                                  mở.
                                </p>
                              )}
                            </div>
                          </details>
                        </div>
                      )}
                      {!currentContent.passage &&
                        !currentContent.question.imagePath &&
                        !currentContent.question.audioPath && (
                          <p className="pt-10 text-sm leading-6 text-slate-500">
                            Nội dung hỗ trợ của câu hỏi sẽ hiển thị ở khu vực
                            này khi đề có đoạn đọc, hình hoặc audio.
                          </p>
                        )}
                    </div>
                  </section>
                  <section className="min-w-0 bg-slate-50 p-4 sm:p-7">
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Question
                          </p>
                          <span className="mt-1 inline-flex rounded-md bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">
                            Part {currentContent.ref.part} · Câu{" "}
                            {currentContent.question.questionNumber}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={toggleFlag}
                          disabled={!canMutate}
                          aria-pressed={currentAnswer.isFlagged}
                          className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${currentAnswer.isFlagged ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500"}`}
                          aria-label={
                            currentAnswer.isFlagged
                              ? "Bỏ đánh dấu câu hỏi"
                              : "Đánh dấu câu hỏi"
                          }
                        >
                          <Flag
                            className={`h-4 w-4 ${currentAnswer.isFlagged ? "fill-amber-400" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      {groupedContents.length === 1 && !compactExamChoices && (
                        <h2
                          className="text-lg font-extrabold leading-8 text-[#493B42] sm:text-xl"
                          data-toeic-text-target="question"
                          data-toeic-text-target-id={currentContent.question.id}
                        >
                          <ToeicAnnotatedText
                            text={
                              currentContent.question.questionText ||
                              "Hãy chọn đáp án phù hợp."
                            }
                            annotations={currentAnnotations.filter(
                              (annotation) =>
                                annotation.questionId ===
                                currentContent.question.id,
                            )}
                          />
                        </h2>
                      )}
                      {groupedContents.length > 1 ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">
                              Nhóm câu{" "}
                              {groupedContents[0]?.question.questionNumber}–
                              {
                                groupedContents[groupedContents.length - 1]
                                  ?.question.questionNumber
                              }
                            </span>
                            <span className="text-xs text-slate-500">
                              ({groupedContents.length} câu hỏi)
                            </span>
                          </div>
                          {groupedContents.map((item) => (
                            <article
                              key={item.ref.questionId}
                              className={`rounded-2xl border bg-white p-4 ${item.ref.questionId === currentRef?.questionId ? "border-blue-300 shadow-[0_0_0_2px_rgba(147,197,253,0.22)]" : "border-slate-200"}`}
                            >
                              <h3
                                className="mb-3 text-base font-extrabold leading-7 text-[#493B42]"
                                data-toeic-text-target="question"
                                data-toeic-text-target-id={item.question.id}
                              >
                                {item.question.questionNumber}.{" "}
                                <ToeicAnnotatedText
                                  text={
                                    item.question.questionText ||
                                    "Hãy chọn đáp án phù hợp."
                                  }
                                  annotations={annotations.filter(
                                    (annotation) =>
                                      annotation.questionId ===
                                      item.question.id,
                                  )}
                                />
                              </h3>
                              <AnswerOptions
                                question={item}
                                answer={
                                  answers[item.ref.questionId] ?? emptyAnswer()
                                }
                                disabled={
                                  !canMutate ||
                                  Boolean(
                                    practiceFeedbackByQuestion[
                                      item.ref.questionId
                                    ],
                                  )
                                }
                                compact={false}
                                feedback={
                                  practiceFeedbackByQuestion[
                                    item.ref.questionId
                                  ] ?? null
                                }
                                onSelect={(option) => {
                                  const nextIndex = session.questions.findIndex(
                                    (question) =>
                                      question.questionId ===
                                      item.ref.questionId,
                                  );
                                  if (nextIndex >= 0)
                                    setCurrentIndex(nextIndex);
                                  updateAnswerForQuestion(
                                    item.ref.questionId,
                                    option,
                                  );
                                }}
                              />
                              {session.mode === "practice" &&
                                (Boolean(
                                  practiceFeedbackByQuestion[
                                    item.ref.questionId
                                  ],
                                ) ||
                                  Boolean(
                                    practiceFeedbackErrors[item.ref.questionId],
                                  ) ||
                                  practiceFeedbackLoadingIds.has(
                                    item.ref.questionId,
                                  )) && (
                                  <ToeicPracticeFeedbackPanel
                                    feedback={
                                      practiceFeedbackByQuestion[
                                        item.ref.questionId
                                      ] ?? null
                                    }
                                    loading={practiceFeedbackLoadingIds.has(
                                      item.ref.questionId,
                                    )}
                                    error={
                                      practiceFeedbackErrors[
                                        item.ref.questionId
                                      ] ?? null
                                    }
                                    onRetry={() =>
                                      void checkPracticeGroupAnswers()
                                    }
                                    onReset={() =>
                                      clearPracticeFeedback(item.ref.questionId)
                                    }
                                    onSaveVocabulary={setVocabularyToSave}
                                    showTranscript={
                                      !showLearningContentBesidePassage
                                    }
                                    showTranslation={
                                      !showLearningContentBesidePassage
                                    }
                                    showVocabulary={false}
                                  />
                                )}
                            </article>
                          ))}
                          {session.mode === "practice" && (
                            <>
                              <div className="rounded-2xl border border-[#FCE7F3] bg-[#FFF9FB] p-4">
                                {groupHasAllAnswers ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void checkPracticeGroupAnswers()
                                    }
                                    disabled={!canCheckPracticeGroup}
                                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {groupFeedbackLoading
                                      ? "Đang kiểm tra nhóm câu…"
                                      : groupHasPendingFeedback
                                        ? "Kiểm tra đáp án nhóm câu"
                                        : "Đã kiểm tra nhóm câu"}
                                  </button>
                                ) : (
                                  <p className="text-sm text-slate-500">
                                    Hãy chọn đáp án cho toàn bộ{" "}
                                    {groupedContents.length} câu để kiểm tra cả
                                    nhóm.
                                  </p>
                                )}
                              </div>
                              {groupVocabulary && (
                                <ToeicLearningContentPanel
                                  explanationEn={null}
                                  explanationVi={null}
                                  aiExplanation={null}
                                  transcript={null}
                                  translation={null}
                                  vocabulary={groupVocabulary}
                                  onSaveVocabulary={setVocabularyToSave}
                                />
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-blue-300 bg-white p-4 shadow-[0_0_0_2px_rgba(147,197,253,0.22)]">
                          <AnswerOptions
                            question={currentContent}
                            answer={currentAnswer}
                            disabled={
                              !canMutate || Boolean(activePracticeFeedback)
                            }
                            compact={compactExamChoices}
                            feedback={activePracticeFeedback}
                            onSelect={updateAnswer}
                          />
                        </div>
                      )}
                      {session.mode === "practice" &&
                        groupedContents.length === 1 && (
                          <PracticeAnswerFeedback
                            canCheck={canCheckPracticeAnswer}
                            feedback={activePracticeFeedback}
                            loading={practiceFeedbackLoading}
                            error={activePracticeFeedbackError}
                            onCheck={() => void checkPracticeAnswer()}
                            onRetry={() => void checkPracticeAnswer()}
                            onReset={() => {
                              if (currentRef)
                                clearPracticeFeedback(currentRef.questionId);
                            }}
                            onSaveVocabulary={setVocabularyToSave}
                            hideTranscript={showLearningContentBesidePassage}
                          />
                        )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
          <div className="fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-6px_18px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
                Giỏ từ
              </span>
              <span className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
                Tra từ trong Công cụ học
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((index) => Math.max(0, index - 1))
                }
                disabled={currentIndex === 0}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-blue-500 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-40"
                aria-label="Câu trước"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPaletteOpen((open) => !open)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
                aria-label={
                  paletteOpen
                    ? "Đóng danh sách câu hỏi"
                    : "Mở danh sách câu hỏi"
                }
                aria-expanded={paletteOpen}
              >
                <Grid2X2 className="h-4 w-4" aria-hidden="true" />
                {currentIndex + 1}/{session.totalQuestions}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((index) =>
                    Math.min(session.questions.length - 1, index + 1),
                  )
                }
                disabled={currentIndex === session.questions.length - 1}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-blue-500 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-40"
                aria-label="Câu tiếp"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
        <aside
          className={`${paletteOpen ? "fixed bottom-20 right-4 top-20 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col" : "hidden"} rounded-3xl border border-[#FCE7F3] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.18)]`}
          aria-label="Bảng câu hỏi"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-[#493B42]">
              Bảng câu hỏi
            </h2>
            <button
              type="button"
              onClick={() => setPaletteOpen(false)}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-pink-50 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
              aria-label="Đóng bảng câu hỏi"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Màu chỉ thể hiện trạng thái trả lời và đánh dấu.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-50 p-1 text-[11px] font-bold sm:grid-cols-4">
            {(["all", "answered", "unanswered", "flagged"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setPaletteFilter(filter)}
                  className={`min-h-8 rounded-lg px-1 ${paletteFilter === filter ? "bg-[#F472B6] text-white" : "text-slate-600 hover:bg-white"}`}
                >
                  {filter === "all"
                    ? `Tất cả (${session.questions.length})`
                    : filter === "answered"
                      ? "Đã làm"
                      : filter === "unanswered"
                        ? "Chưa làm"
                        : "Cờ"}
                </button>
              ),
            )}
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <Palette
              session={paletteSession ?? session}
              answers={answers}
              currentIndex={paletteCurrentIndex}
              onSelect={(index) => {
                const question = (paletteSession ?? session).questions[index];
                const nextIndex = session.questions.findIndex(
                  (item) => item.questionId === question?.questionId,
                );
                if (nextIndex >= 0) {
                  setCurrentIndex(nextIndex);
                  setPaletteOpen(false);
                }
              }}
            />
          </div>
          <div className="mt-5 border-t border-[#FCE7F3] pt-4 space-y-2">
            <button
              type="button"
              onClick={openSubmit}
              disabled={!canSubmit || submitBusy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F472B6] text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Nộp bài
            </button>
            <button
              type="button"
              onClick={() => setAbandonOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FBCFE8] text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Bỏ bài
            </button>
            {notice && (
              <p
                className="mt-3 rounded-xl bg-[#FFF1F2] p-3 text-xs text-[#9D174D]"
                role="alert"
              >
                {notice}
              </p>
            )}
          </div>
        </aside>
        {currentContent && (
          <aside
            className={`${notesPanelOpen ? "fixed bottom-20 right-4 top-20 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col" : "hidden"} overflow-hidden rounded-2xl border border-[#FBCFE8] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.18)]`}
            aria-label="Sổ tay bài thi"
          >
            <header className="flex items-center justify-between border-b border-[#FCE7F3] px-4 py-3">
              <h2 className="text-sm font-extrabold text-[#493B42]">
                Sổ Tay &amp; Từ Vựng Bài Thi
              </h2>
              <button
                type="button"
                onClick={() => setNotesPanelOpen(false)}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-pink-50"
                aria-label="Đóng sổ tay"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="grid grid-cols-2 gap-1 border-b border-[#FCE7F3] bg-slate-50 p-1">
              <span className="rounded-lg bg-amber-500 px-2 py-2 text-center text-xs font-bold text-white">
                Ghi chú
              </span>
              <span
                className="rounded-lg px-2 py-2 text-center text-xs font-bold text-slate-400"
                title="Chưa có contract tổng hợp từ vựng theo Section"
              >
                Từ vựng Section
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ToeicNotesPanel
                key={`${session.testId}-${currentContent.question.id}`}
                testId={session.testId}
                questionId={currentContent.question.id}
              />
            </div>
          </aside>
        )}
      </div>
      <ToeicAbandonDialog
        open={abandonOpen}
        busy={abandonBusy}
        onCancel={() => setAbandonOpen(false)}
        onConfirm={() => void abandon()}
      />
      <ToeicSubmitDialog
        open={submitOpen}
        busy={submitBusy}
        answered={
          Object.values(answers).filter(
            (answer) => answer.selectedAnswer !== null,
          ).length
        }
        unanswered={Math.max(
          0,
          session.totalQuestions -
            Object.values(answers).filter(
              (answer) => answer.selectedAnswer !== null,
            ).length,
        )}
        flagged={
          Object.values(answers).filter((answer) => answer.isFlagged).length
        }
        remainingLabel={formatTime(remaining)}
        errorMessage={submitError}
        onRetry={() => void retrySubmitAutosave()}
        onCancel={() => {
          if (!submitBusy) setSubmitOpen(false);
        }}
        onConfirm={() => void submit()}
      />
      <ToeicVocabularySaveDialog
        item={vocabularyToSave}
        open={vocabularyToSave !== null}
        onClose={() => setVocabularyToSave(null)}
      />
    </main>
  );
}
