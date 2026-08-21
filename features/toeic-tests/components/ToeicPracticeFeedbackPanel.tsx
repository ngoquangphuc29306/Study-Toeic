"use client";

import { CheckCircle2, LoaderCircle, RefreshCcw, XCircle } from "lucide-react";
import type { ToeicPracticeFeedback } from "../learningContracts";
import { ToeicLearningContentPanel } from "./ToeicLearningContentPanel";

export function ToeicPracticeFeedbackPanel({
  feedback,
  loading,
  error,
  onRetry,
  onReset,
  onSaveVocabulary,
  showTranscript = true,
  showTranslation = true,
  showVocabulary = true,
}: {
  feedback: ToeicPracticeFeedback | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onReset: () => void;
  onSaveVocabulary?: (item: {
    word: string;
    partOfSpeech: string | null;
    meaningVi: string | null;
  }) => void;
  /** Lets the workspace place authorized listening content beside the audio player. */
  showTranscript?: boolean;
  /** Lets the workspace place authorized listening content beside the audio player. */
  showTranslation?: boolean;
  /** Lets grouped Practice UI show one deduplicated vocabulary section after all feedback. */
  showVocabulary?: boolean;
}) {
  if (loading)
    return (
      <div
        className="mt-4 flex items-center gap-2 rounded-2xl border border-[#FCE7F3] bg-[#FFF9FB] p-4 text-sm text-gray-600"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle
          className="h-5 w-5 animate-spin text-[#F472B6]"
          aria-hidden="true"
        />{" "}
        Đang kiểm tra đáp án…
      </div>
    );
  if (error)
    return (
      <div
        className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        role="alert"
      >
        <p className="font-bold">Không thể tải phản hồi cho câu này.</p>
        <p className="mt-1">{error.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 font-bold text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại
        </button>
      </div>
    );
  if (!feedback) return null;

  return (
    <section
      className={`mt-4 rounded-2xl border p-4 ${feedback.isCorrect ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60"}`}
      aria-label="Phản hồi đáp án"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {feedback.isCorrect ? (
            <CheckCircle2
              className="h-6 w-6 text-emerald-600"
              aria-hidden="true"
            />
          ) : (
            <XCircle className="h-6 w-6 text-rose-600" aria-hidden="true" />
          )}
          <p
            className={`text-lg font-black ${feedback.isCorrect ? "text-emerald-700" : "text-rose-700"}`}
          >
            {feedback.isCorrect ? "Chính xác" : "Chưa chính xác"}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#FBCFE8] px-3 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại câu này
        </button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
          <dt className="text-rose-700/70">Bạn chọn</dt>
          <dd className="mt-1 font-black text-rose-700">
            {feedback.selectedAnswer}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <dt className="text-emerald-700/70">Đáp án đúng</dt>
          <dd className="mt-1 font-black text-emerald-700">
            {feedback.correctAnswer}
          </dd>
        </div>
      </dl>
      <ToeicLearningContentPanel
        explanationEn={feedback.explanationEn}
        explanationVi={feedback.explanationVi}
        aiExplanation={feedback.aiExplanation}
        transcript={showTranscript ? feedback.transcript : null}
        translation={showTranslation ? feedback.translation : null}
        vocabulary={showVocabulary ? feedback.vocabulary : null}
        onSaveVocabulary={onSaveVocabulary}
      />
    </section>
  );
}
