"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Flag,
  LoaderCircle,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import type {
  ToeicAttemptReview,
  ToeicReviewQuestion,
} from "../submissionContracts";
import type { ToeicOptionKey, ToeicTestPart } from "../types";
import type {
  ToeicAttemptReviewLearningContent,
  ToeicLearningVocabularyContent,
  ToeicLearningVocabularyItem,
} from "../learningContracts";
import type {
  ToeicTestPartPayload,
  ToeicTestTakingQuestion,
} from "../readContracts";
import { getToeicAttemptReview } from "../services/toeicSubmissionService";
import { getToeicAttemptReviewContent } from "../services/toeicLearningService";
import { getPublishedToeicTestPart } from "../services/toeicTestReadService";
import { createBrowserToeicMediaClient } from "../services/toeicMediaClient";
import { ToeicLearningContentPanel } from "./ToeicLearningContentPanel";
import { ToeicMediaView } from "./ToeicMediaView";
import { ToeicPassageRenderer } from "./ToeicPassageRenderer";
import { ToeicVocabularySaveDialog } from "./ToeicVocabularySaveDialog";
import { ToeicWrongQuestionRetryButton } from "./ToeicWrongQuestionRetryButton";

const PARTS: ReadonlyArray<ToeicTestPart> = [1, 2, 3, 4, 5, 6, 7];
const GROUPED_PASSAGE_PARTS = new Set<ToeicTestPart>([3, 4, 6, 7]);
const OPTION_KEYS: ReadonlyArray<ToeicOptionKey> = ["A", "B", "C", "D"];

type ReviewGroup = {
  id: string;
  part: ToeicTestPart;
  passageId: string | null;
  items: ReadonlyArray<ToeicReviewQuestion>;
};

function buildReviewGroups(
  items: ReadonlyArray<ToeicReviewQuestion>,
): ReadonlyArray<ReviewGroup> {
  const groups = new Map<string, ToeicReviewQuestion[]>();
  for (const item of items) {
    const grouped = GROUPED_PASSAGE_PARTS.has(item.part) && item.passageId;
    const id = grouped
      ? `${item.part}:${item.passageId}`
      : `question:${item.questionId}`;
    const current = groups.get(id) ?? [];
    current.push(item);
    groups.set(id, current);
  }
  return [...groups.entries()].map(([id, groupItems]) => ({
    id,
    part: groupItems[0].part,
    passageId: groupItems[0].passageId,
    items: groupItems,
  }));
}

function ReviewAnswerOptions({
  question,
  content,
}: {
  question: ToeicReviewQuestion;
  content: ToeicTestTakingQuestion | undefined;
}) {
  if (!content) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Không tải được nội dung lựa chọn của câu này.
      </p>
    );
  }

  return (
    <div
      className="grid gap-2"
      role="group"
      aria-label={`Đáp án câu ${question.questionNumber}`}
    >
      {OPTION_KEYS.map((option) => {
        const isCorrect = option === question.correctAnswer;
        const isWrongSelection =
          option === question.selectedAnswer && !isCorrect;
        const className = isCorrect
          ? "border-emerald-400 bg-emerald-50 text-emerald-800"
          : isWrongSelection
            ? "border-rose-400 bg-rose-50 text-rose-800"
            : "border-slate-200 bg-white text-slate-700";
        const badgeClass = isCorrect
          ? "bg-emerald-500 text-white"
          : isWrongSelection
            ? "bg-rose-500 text-white"
            : "bg-slate-100 text-slate-600";
        return (
          <div
            key={option}
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left ${className}`}
            aria-label={`${option}${isCorrect ? ", đáp án đúng" : isWrongSelection ? ", đáp án đã chọn nhưng sai" : ""}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${badgeClass}`}
            >
              {option}
            </span>
            <span className="min-w-0 text-sm font-semibold">
              {content.options[option] || `(${option})`}
            </span>
            {isCorrect && (
              <CheckCircle2
                className="ml-auto h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            )}
            {isWrongSelection && (
              <XCircle
                className="ml-auto h-4 w-4 shrink-0 text-rose-600"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function mergeGroupVocabulary(
  items: ReadonlyArray<ToeicReviewQuestion>,
  learningByQuestion: ReadonlyMap<
    string,
    ToeicAttemptReviewLearningContent["questions"][number]
  >,
): ToeicLearningVocabularyContent | null {
  const vocabularyItems = new Map<string, ToeicLearningVocabularyItem>();
  const rawEntries = new Set<string>();
  for (const item of items) {
    const vocabulary = learningByQuestion.get(item.questionId)?.vocabulary;
    if (!vocabulary) continue;
    for (const vocabularyItem of vocabulary.items) {
      const key = `${vocabularyItem.word.trim().toLocaleLowerCase("en-US")}|${vocabularyItem.partOfSpeech ?? ""}`;
      if (!vocabularyItems.has(key)) vocabularyItems.set(key, vocabularyItem);
    }
    if (vocabulary.raw?.trim()) rawEntries.add(vocabulary.raw.trim());
  }
  if (vocabularyItems.size === 0 && rawEntries.size === 0) return null;
  return {
    items: [...vocabularyItems.values()],
    raw: rawEntries.size > 0 ? [...rawEntries].join("\n") : null,
  };
}

function ReviewGroupWorkspace({
  group,
  questionById,
  passageById,
  learningByQuestion,
  learningByPassage,
  testId,
  onSaveVocabulary,
}: {
  group: ReviewGroup;
  questionById: ReadonlyMap<string, ToeicTestTakingQuestion>;
  passageById: ReadonlyMap<string, ToeicTestPartPayload["passages"][number]>;
  learningByQuestion: ReadonlyMap<
    string,
    ToeicAttemptReviewLearningContent["questions"][number]
  >;
  learningByPassage: ReadonlyMap<
    string,
    ToeicAttemptReviewLearningContent["passages"][number]
  >;
  testId: string;
  onSaveVocabulary: (item: ToeicLearningVocabularyItem) => void;
}) {
  const mediaClient = useMemo(() => createBrowserToeicMediaClient(), []);
  const passage = group.passageId
    ? passageById.get(group.passageId)
    : undefined;
  const passageLearning = group.passageId
    ? learningByPassage.get(group.passageId)
    : undefined;
  const groupVocabulary = mergeGroupVocabulary(group.items, learningByQuestion);
  const firstContent = questionById.get(group.items[0].questionId);

  return (
    <section
      className="overflow-hidden rounded-3xl border border-[#FBCFE8] bg-white shadow-[0_10px_30px_rgba(157,23,77,0.06)]"
      aria-label={`Nhóm câu Part ${group.part}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FCE7F3] bg-[#FFF8FA] px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F472B6]">
            Part {group.part}
          </p>
          <h2 className="mt-1 text-base font-extrabold text-[#493B42]">
            {group.items.length > 1
              ? `Nhóm câu ${group.items[0].questionNumber}–${group.items[group.items.length - 1].questionNumber}`
              : `Câu ${group.items[0].questionNumber}`}
          </h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
          {group.items.length > 1
            ? `${group.items.length} câu trong nhóm`
            : "Đã mở đáp án"}
        </span>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:p-5">
        <div className="min-w-0 space-y-4">
          {passage ? (
            <ToeicPassageRenderer passage={passage} />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Nội dung câu hỏi
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {firstContent?.questionText ||
                  "Nội dung câu hỏi đã được hoàn thành."}
              </p>
            </section>
          )}
          {passage?.audioPath && (
            <ToeicMediaView
              testId={testId}
              path={passage.audioPath}
              kind="audio"
              mediaClient={mediaClient}
            />
          )}
          {passage?.imagePath && (
            <ToeicMediaView
              testId={testId}
              path={passage.imagePath}
              kind="image"
              alt="Hình ảnh đoạn đọc"
              mediaClient={mediaClient}
            />
          )}
          {firstContent?.audioPath && (
            <ToeicMediaView
              testId={testId}
              path={firstContent.audioPath}
              kind="audio"
              mediaClient={mediaClient}
            />
          )}
          {firstContent?.imagePath && (
            <ToeicMediaView
              testId={testId}
              path={firstContent.imagePath}
              kind="image"
              alt={`Hình ảnh câu ${group.items[0].questionNumber}`}
              mediaClient={mediaClient}
            />
          )}
          {passageLearning && (
            <ToeicLearningContentPanel
              explanationEn={null}
              explanationVi={null}
              aiExplanation={null}
              transcript={passageLearning.transcript}
              translation={passageLearning.translation}
              vocabulary={null}
              onSaveVocabulary={onSaveVocabulary}
            />
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {group.items.map((item) => {
            const content = questionById.get(item.questionId);
            const learning = learningByQuestion.get(item.questionId);
            const unanswered = item.selectedAnswer === null;
            const correct = item.isCorrect === true;
            return (
              <article
                key={item.questionId}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      Câu {item.questionNumber}
                    </p>
                    <h3 className="mt-2 text-base font-extrabold leading-6 text-[#493B42]">
                      {content?.questionText || "Câu hỏi TOEIC"}
                    </h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.isFlagged && (
                      <Flag
                        className="h-4 w-4 fill-amber-400 text-amber-500"
                        aria-label="Đã đánh dấu"
                      />
                    )}
                    {unanswered ? (
                      <CircleHelp
                        className="h-5 w-5 text-orange-500"
                        aria-label="Chưa trả lời"
                      />
                    ) : correct ? (
                      <CheckCircle2
                        className="h-5 w-5 text-emerald-600"
                        aria-label="Trả lời đúng"
                      />
                    ) : (
                      <XCircle
                        className="h-5 w-5 text-rose-600"
                        aria-label="Trả lời sai"
                      />
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <ReviewAnswerOptions question={item} content={content} />
                </div>
                {learning && (
                  <ToeicLearningContentPanel
                    explanationEn={learning.explanationEn}
                    explanationVi={learning.explanationVi}
                    aiExplanation={learning.aiExplanation}
                    transcript={passage ? null : learning.transcript}
                    translation={passage ? null : learning.translation}
                    vocabulary={
                      group.items.length === 1 ? learning.vocabulary : null
                    }
                    onSaveVocabulary={onSaveVocabulary}
                  />
                )}
              </article>
            );
          })}
          {group.items.length > 1 && groupVocabulary && (
            <ToeicLearningContentPanel
              explanationEn={null}
              explanationVi={null}
              aiExplanation={null}
              transcript={null}
              translation={null}
              vocabulary={groupVocabulary}
              onSaveVocabulary={onSaveVocabulary}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function ToeicAttemptReviewPage({ attemptId }: { attemptId: string }) {
  const [review, setReview] = useState<ToeicAttemptReview | null>(null);
  const [learningContent, setLearningContent] =
    useState<ToeicAttemptReviewLearningContent | null>(null);
  const [partPayloads, setPartPayloads] = useState<
    ReadonlyArray<ToeicTestPartPayload>
  >([]);
  const [part, setPart] = useState<ToeicTestPart | "all">("all");
  const [error, setError] = useState<Error | null>(null);
  const [learningError, setLearningError] = useState<Error | null>(null);
  const [partError, setPartError] = useState<Error | null>(null);
  const [learningLoading, setLearningLoading] = useState(true);
  const [partLoading, setPartLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [vocabularyToSave, setVocabularyToSave] =
    useState<ToeicLearningVocabularyItem | null>(null);

  const loadLearning = useCallback(() => {
    setLearningLoading(true);
    setLearningError(null);
    void getToeicAttemptReviewContent(attemptId)
      .then(setLearningContent)
      .catch((cause) =>
        setLearningError(
          cause instanceof Error
            ? cause
            : new Error("Không thể tải nội dung học thêm"),
        ),
      )
      .finally(() => setLearningLoading(false));
  }, [attemptId]);

  const loadPartContent = useCallback((testId: string) => {
    setPartLoading(true);
    setPartError(null);
    void Promise.all(
      PARTS.map((candidate) => getPublishedToeicTestPart(testId, candidate)),
    )
      .then(setPartPayloads)
      .catch((cause) =>
        setPartError(
          cause instanceof Error
            ? cause
            : new Error("Không thể tải nội dung bài thi"),
        ),
      )
      .finally(() => setPartLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    void getToeicAttemptReview(attemptId)
      .then((value) => {
        if (active) setReview(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause
              : new Error("Không thể tải phần xem lại"),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  useEffect(() => {
    const timer = window.setTimeout(loadLearning, 0);
    return () => window.clearTimeout(timer);
  }, [loadLearning]);

  useEffect(() => {
    if (!review) return;
    const timer = window.setTimeout(() => loadPartContent(review.testId), 0);
    return () => window.clearTimeout(timer);
  }, [loadPartContent, review]);

  const items = useMemo(
    () =>
      review
        ? review.items.filter((item) => part === "all" || item.part === part)
        : [],
    [part, review],
  );
  const groups = useMemo(() => buildReviewGroups(items), [items]);
  const questionById = useMemo(
    () =>
      new Map(
        partPayloads.flatMap((payload) =>
          payload.questions.map((question) => [question.id, question] as const),
        ),
      ),
    [partPayloads],
  );
  const passageById = useMemo(
    () =>
      new Map(
        partPayloads.flatMap((payload) =>
          payload.passages.map((passage) => [passage.id, passage] as const),
        ),
      ),
    [partPayloads],
  );
  const learningByQuestion = useMemo(
    () =>
      new Map(
        (learningContent?.questions ?? []).map((item) => [
          item.questionId,
          item,
        ]),
      ),
    [learningContent],
  );
  const learningByPassage = useMemo(
    () =>
      new Map(
        (learningContent?.passages ?? []).map((item) => [item.passageId, item]),
      ),
    [learningContent],
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FFF9FA] p-6">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-14 rounded-2xl bg-white" />
          <div className="h-[70vh] rounded-3xl bg-white" />
        </div>
      </main>
    );
  }
  if (error || !review) {
    return (
      <main className="min-h-screen bg-[#FFF9FA] p-6">
        <div
          className="mx-auto max-w-xl rounded-3xl border border-[#FBCFE8] bg-white p-8 text-center"
          role="alert"
        >
          <h1 className="text-xl font-extrabold text-[#493B42]">
            Không thể tải phần xem lại
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {error?.message || "Review chưa sẵn sàng."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF9FA] px-4 py-6 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/app/tests/attempts/${attemptId}/result`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Về kết quả
          </Link>
          <p className="text-sm font-semibold text-slate-500">
            {review.items.length} câu trong phần xem lại
          </p>
        </div>
        <header className="mt-5 rounded-3xl border border-[#FBCFE8] bg-white p-5 shadow-[0_8px_24px_rgba(157,23,77,0.05)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F472B6]">
                Review sau khi nộp
              </p>
              <h1 className="mt-2 text-2xl font-black text-[#493B42] sm:text-3xl">
                Xem lại đáp án
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Giữ nguyên bố cục làm bài; đáp án đúng, đáp án đã chọn và nội
                dung học thêm đã được mở.
              </p>
            </div>
            <ToeicWrongQuestionRetryButton sourceAttemptId={attemptId} />
          </div>
          <div
            className="mt-5 flex gap-2 overflow-x-auto border-t border-[#FCE7F3] pt-4"
            role="tablist"
            aria-label="Lọc Part xem lại"
          >
            <button
              type="button"
              onClick={() => setPart("all")}
              className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${part === "all" ? "bg-[#F472B6] text-white" : "text-slate-500 hover:bg-[#FFF1F2]"}`}
              aria-pressed={part === "all"}
            >
              Tất cả
            </button>
            {PARTS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setPart(candidate)}
                className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${part === candidate ? "bg-[#F472B6] text-white" : "text-slate-500 hover:bg-[#FFF1F2]"}`}
                aria-pressed={part === candidate}
              >
                Part {candidate}
              </button>
            ))}
          </div>
        </header>
        {learningError && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            role="alert"
          >
            <span>
              Chưa tải được nội dung học thêm: {learningError.message}
            </span>
            <button
              type="button"
              onClick={loadLearning}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 font-bold"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại
            </button>
          </div>
        )}
        {partError && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            role="alert"
          >
            <span>Chưa tải được nội dung câu hỏi: {partError.message}</span>
            <button
              type="button"
              onClick={() => loadPartContent(review.testId)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 font-bold"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Thử lại
            </button>
          </div>
        )}
        {(learningLoading || partLoading) && (
          <div
            className="mt-4 flex items-center gap-2 text-sm text-slate-500"
            role="status"
          >
            <LoaderCircle
              className="h-4 w-4 animate-spin text-[#F472B6]"
              aria-hidden="true"
            />{" "}
            Đang mở toàn bộ nội dung xem lại…
          </div>
        )}
        <section
          className="mt-5 space-y-5"
          aria-label="Workspace xem lại đáp án"
        >
          {groups.map((group) => (
            <ReviewGroupWorkspace
              key={group.id}
              group={group}
              questionById={questionById}
              passageById={passageById}
              learningByQuestion={learningByQuestion}
              learningByPassage={learningByPassage}
              testId={review.testId}
              onSaveVocabulary={setVocabularyToSave}
            />
          ))}
          {groups.length === 0 && (
            <div className="rounded-3xl border border-[#FBCFE8] bg-white p-10 text-center text-sm text-slate-500">
              Không có câu hỏi trong Part này.
            </div>
          )}
        </section>
      </div>
      <ToeicVocabularySaveDialog
        item={vocabularyToSave}
        open={vocabularyToSave !== null}
        onClose={() => setVocabularyToSave(null)}
      />
    </main>
  );
}
