"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Clipboard,
  Eraser,
  Eye,
  GripVertical,
  Highlighter,
  Hand,
  LoaderCircle,
  Palette,
  Search,
  PenLine,
  Redo2,
  RotateCcw,
  Save,
  Square,
  StickyNote,
  Type,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import type {
  ToeicPracticeFeedback,
  ToeicLearningVocabularyItem,
} from "../learningContracts";
import type {
  DictionaryLookupResult,
  ToeicNote,
  ToeicTextAnnotation,
  ToeicAnnotationStyle,
} from "../toolContracts";
import {
  createToeicAnnotation,
  deleteToeicAnnotation,
  deleteToeicNote,
  listToeicNotes,
  upsertToeicNote,
  lookupToeicTerm,
} from "../services/toeicToolService";
import {
  evaluateDictation,
  type ToeicDictationComparison,
} from "../services/toeicDictation";
import type { ToeicTextSelectionDraft } from "../services/toeicAnnotationAnchoring";

type Tool = "notes" | "annotation" | "lookup" | "dictation" | "flip";

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] sm:flex-none ${active ? "bg-[#FFF1F2] text-[#9D174D]" : "text-gray-600 hover:bg-[#FFF8FA]"}`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export function ToeicNotesPanel({
  testId,
  questionId,
}: {
  testId: string;
  questionId: string | null;
}) {
  const [notes, setNotes] = useState<ReadonlyArray<ToeicNote>>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useMemo(
    () =>
      notes.find((note) =>
        questionId ? note.questionId === questionId : note.questionId === null,
      ) ?? null,
    [notes, questionId],
  );
  useEffect(() => {
    let active = true;
    void listToeicNotes(testId)
      .then((value) => {
        if (!active) return;
        setNotes(value);
        setContent(
          value.find((note) =>
            questionId
              ? note.questionId === questionId
              : note.questionId === null,
          )?.content ?? "",
        );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải ghi chú.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [questionId, testId]);
  const save = async () => {
    if (!content.trim()) {
      setError("Ghi chú không được để trống.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await upsertToeicNote({ testId, questionId, content });
      setNotes((currentNotes) => [
        ...currentNotes.filter((note) => note.id !== saved.id),
        saved,
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể lưu ghi chú.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await deleteToeicNote(current.id);
      setNotes((currentNotes) =>
        currentNotes.filter((note) => note.id !== current.id),
      );
      setContent("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể xóa ghi chú.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-[#493B42]">
            {questionId ? "Ghi chú câu hỏi" : "Ghi chú bài thi"}
          </h3>
          <p className="text-xs text-gray-500">
            Lưu trên tài khoản, có thể tiếp tục trên thiết bị khác.
          </p>
        </div>
        {current && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-xs font-bold text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Xóa
          </button>
        )}
      </div>
      {loading ? (
        <div
          className="flex items-center gap-2 text-sm text-gray-500"
          role="status"
        >
          <LoaderCircle
            className="h-4 w-4 animate-spin text-[#F472B6]"
            aria-hidden="true"
          />{" "}
          Đang tải ghi chú…
        </div>
      ) : (
        <>
          <label className="sr-only" htmlFor="toeic-note-editor">
            Nội dung ghi chú
          </label>
          <textarea
            id="toeic-note-editor"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={5000}
            rows={6}
            placeholder="Ghi lại mẹo, từ khóa hoặc điều cần ôn…"
            className="w-full resize-y rounded-2xl border border-[#FBCFE8] bg-white p-3 text-sm leading-6 text-[#493B42] focus:border-[#F472B6] focus:outline-none focus:ring-2 focus:ring-[#FBCFE8]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-gray-500" aria-live="polite">
              {content.length}/5000 ký tự
            </span>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !content.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden="true" />{" "}
              {busy ? "Đang lưu…" : "Lưu ghi chú"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function LookupTool({
  onSaveVocabulary,
}: {
  onSaveVocabulary?: (item: ToeicLearningVocabularyItem) => void;
}) {
  const [term, setTerm] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await lookupToeicTerm(term, context));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tra từ.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-extrabold text-[#493B42]">Tra từ an toàn</h3>
        <p className="text-xs text-gray-500">
          Yêu cầu đi qua server; không gửi provider hoặc URL từ trình duyệt.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor="toeic-lookup-term">
          Từ cần tra
        </label>
        <input
          id="toeic-lookup-term"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          maxLength={80}
          placeholder="Nhập từ tiếng Anh…"
          className="min-h-11 rounded-xl border border-[#FBCFE8] px-3 text-sm focus:border-[#F472B6] focus:outline-none focus:ring-2 focus:ring-[#FBCFE8]"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !term.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] disabled:opacity-50"
        >
          {loading && (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}{" "}
          Tra từ
        </button>
      </div>
      <label className="block text-xs font-bold text-gray-600">
        Ngữ cảnh (tùy chọn)
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          maxLength={500}
          rows={2}
          className="mt-1 w-full resize-y rounded-xl border border-[#FBCFE8] p-2 text-sm focus:border-[#F472B6] focus:outline-none"
        />
      </label>
      {error && (
        <div
          className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void submit()}
            className="font-bold underline"
          >
            Thử lại
          </button>
        </div>
      )}
      {result && (
        <div className="rounded-2xl bg-[#FFF8FA] p-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-lg font-black text-[#493B42]">{result.term}</h4>
            {result.phonetic && (
              <span className="font-mono text-xs text-gray-500">
                {result.phonetic}
              </span>
            )}
          </div>
          {result.partOfSpeech && (
            <p className="mt-1 text-xs font-bold text-[#9D174D]">
              {result.partOfSpeech}
            </p>
          )}
          <ul
            className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700"
            aria-label="Định nghĩa"
          >
            {result.definitions.map((definition) => (
              <li key={definition}>{definition}</li>
            ))}
          </ul>
          {result.examples.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              <p className="font-bold">Ví dụ</p>
              {result.examples.map((example) => (
                <p key={example} className="mt-1">
                  {example}
                </p>
              ))}
            </div>
          )}
          {onSaveVocabulary && (
            <button
              type="button"
              onClick={() =>
                onSaveVocabulary({
                  word: result.term,
                  meaningVi: result.definitions[0] ?? null,
                  partOfSpeech: result.partOfSpeech,
                })
              }
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FBCFE8] bg-white px-3 text-sm font-bold text-[#9D174D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6]"
            >
              <Save className="h-4 w-4" aria-hidden="true" /> Lưu từ
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AnnotationTool({
  testId,
  annotations,
  selection,
  onCreated,
  onDeleted,
  onClearSelection,
  initialStyle = "highlight",
}: {
  testId: string;
  annotations: ReadonlyArray<ToeicTextAnnotation>;
  selection: ToeicTextSelectionDraft | null;
  onCreated: (annotation: ToeicTextAnnotation) => void;
  onDeleted: (id: string) => void;
  onClearSelection: () => void;
  initialStyle?: ToeicAnnotationStyle;
}) {
  const [style, setStyle] = useState<ToeicAnnotationStyle>(initialStyle);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const highlightButtonClass =
    style === "highlight"
      ? "bg-amber-200 text-amber-950"
      : "bg-white text-gray-600";
  const underlineButtonClass =
    style === "underline"
      ? "bg-[#FCE7F3] text-[#9D174D]"
      : "bg-white text-gray-600";
  const create = async () => {
    if (!selection) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await createToeicAnnotation({
        testId,
        ...selection,
        style,
        comment: comment.trim() || null,
      });
      onCreated(saved);
      setComment("");
      onClearSelection();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể lưu đánh dấu.",
      );
    } finally {
      setBusy(false);
    }
  };
  const visible = annotations.filter((annotation) =>
    selection?.questionId
      ? annotation.questionId === selection.questionId
      : selection?.passageId
        ? annotation.passageId === selection.passageId
        : true,
  );
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-extrabold text-[#493B42]">Đánh dấu văn bản</h3>
        <p className="text-xs text-gray-500">
          Neo theo đoạn trích và offset ổn định, không theo DOM selector.
        </p>
      </div>
      {selection ? (
        <div className="rounded-2xl border border-[#FBCFE8] bg-[#FFF8FA] p-3">
          <p className="text-sm font-semibold text-[#493B42]">
            Đã chọn: “{selection.quote}”
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStyle("highlight")}
              aria-pressed={style === "highlight"}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold ${highlightButtonClass}`}
            >
              <Highlighter className="h-4 w-4" aria-hidden="true" /> Highlight
            </button>
            <button
              type="button"
              onClick={() => setStyle("underline")}
              aria-pressed={style === "underline"}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold ${underlineButtonClass}`}
            >
              <Underline className="h-4 w-4" aria-hidden="true" /> Gạch chân
            </button>
          </div>
          <label className="mt-3 block text-xs font-bold text-gray-600">
            Ghi chú ngắn
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              className="mt-1 min-h-10 w-full rounded-xl border border-[#FBCFE8] px-3 text-sm font-normal focus:border-[#F472B6] focus:outline-none"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F472B6] px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy && (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}{" "}
              Lưu đánh dấu
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#FBCFE8] px-3 text-xs font-bold text-gray-600"
            >
              <X className="h-4 w-4" aria-hidden="true" /> Bỏ chọn
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
          Bôi đen một đoạn trong câu hỏi hoặc đoạn đọc để đánh dấu. Có thể dùng
          menu này thay cho thao tác chuột trên mobile.
        </p>
      )}
      {visible.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Đánh dấu đã lưu
          </p>
          {visible.map((annotation) => (
            <div
              key={annotation.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[#FCE7F3] bg-white p-3 text-sm"
            >
              <div>
                <p
                  className={
                    annotation.style === "underline"
                      ? "underline decoration-[#F472B6] underline-offset-4"
                      : "rounded bg-[#FEF3C7]"
                  }
                >
                  {annotation.quote}
                </p>
                {annotation.comment && (
                  <p className="mt-1 text-xs text-gray-500">
                    {annotation.comment}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  void deleteToeicAnnotation(annotation.id)
                    .then(() => onDeleted(annotation.id))
                    .catch((cause) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Không thể xóa.",
                      ),
                    )
                }
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                aria-label="Xóa đánh dấu"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

type FloatingAnnotationMode = "select" | "highlight" | "underline";

function FloatingAnnotationButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const stateClass = active
    ? "bg-sky-500 text-white shadow-sm"
    : "text-slate-200 hover:bg-white/10 hover:text-white";
  return (
    <button
      type="button"
      aria-label={label}
      title={disabled ? `${label} — chưa hỗ trợ trong phiên này` : label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${stateClass} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}

function FloatingAnnotationToolbar({
  testId,
  annotations,
  selection,
  onCreated,
  onDeleted,
  onClearSelection,
  onClose,
}: {
  testId: string;
  annotations: ReadonlyArray<ToeicTextAnnotation>;
  selection: ToeicTextSelectionDraft | null;
  onCreated: (annotation: ToeicTextAnnotation) => void;
  onDeleted: (id: string) => void;
  onClearSelection: () => void;
  onClose: () => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [position, setPosition] = useState({ x: 16, y: 120 });
  const [mode, setMode] = useState<FloatingAnnotationMode>("select");
  const [style, setStyle] = useState<ToeicAnnotationStyle>("highlight");
  const [detailsOpen, setDetailsOpen] = useState(Boolean(selection));

  const clampPosition = (x: number, y: number) => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 52;
    const height = rect?.height ?? 520;
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    };
  };

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(
      clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY),
    );
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const selectedAnnotation = selection
    ? annotations.find(
        (annotation) =>
          annotation.quote.trim() === selection.quote.trim() &&
          annotation.questionId === selection.questionId &&
          annotation.passageId === selection.passageId,
      )
    : undefined;

  const chooseStyle = (nextStyle: ToeicAnnotationStyle) => {
    setStyle(nextStyle);
    setMode(nextStyle);
    setDetailsOpen(true);
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[70] flex items-start gap-2"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="flex w-14 flex-col items-center gap-1 rounded-2xl border border-slate-700 bg-[#172033] p-2 shadow-2xl shadow-slate-950/25"
        aria-label="Thanh công cụ Annotator"
      >
        <div className="flex w-full items-center justify-between border-b border-white/10 pb-1">
          <div
            role="button"
            tabIndex={0}
            aria-label="Kéo thanh công cụ Annotator"
            title="Kéo để di chuyển"
            className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white active:cursor-grabbing"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onKeyDown={(event) => {
              const step = 16;
              if (event.key === "ArrowLeft")
                setPosition((p) => clampPosition(p.x - step, p.y));
              if (event.key === "ArrowRight")
                setPosition((p) => clampPosition(p.x + step, p.y));
              if (event.key === "ArrowUp")
                setPosition((p) => clampPosition(p.x, p.y - step));
              if (event.key === "ArrowDown")
                setPosition((p) => clampPosition(p.x, p.y + step));
            }}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng Annotator"
            title="Đóng Annotator"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <FloatingAnnotationButton
          label="Chọn và di chuyển"
          active={mode === "select"}
          onClick={() => setMode("select")}
        >
          <Hand className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton
          label="Highlight"
          active={mode === "highlight"}
          onClick={() => chooseStyle("highlight")}
        >
          <Highlighter className="h-4 w-4 text-amber-300" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton
          label="Gạch chân"
          active={mode === "underline"}
          onClick={() => chooseStyle("underline")}
        >
          <Underline className="h-4 w-4 text-slate-200" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Vẽ tự do" disabled>
          <PenLine className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Tẩy annotation" disabled>
          <Eraser className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Thêm văn bản" disabled>
          <Type className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Thêm ghi chú" disabled>
          <StickyNote className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Vẽ hình chữ nhật" disabled>
          <Square className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Vẽ mũi tên" disabled>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton
          label="Đổi kiểu đánh dấu"
          active={detailsOpen}
          onClick={() =>
            chooseStyle(style === "highlight" ? "underline" : "highlight")
          }
        >
          <Palette className="h-4 w-4 text-yellow-300" aria-hidden="true" />
        </FloatingAnnotationButton>
        <div className="my-1 h-px w-8 bg-white/10" />
        <FloatingAnnotationButton label="Hoàn tác" disabled>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Làm lại" disabled>
          <Redo2 className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton label="Hiện/ẩn annotation" disabled>
          <Eye className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton
          label="Xóa annotation đã chọn"
          disabled={!selectedAnnotation}
          onClick={() => {
            if (!selectedAnnotation) return;
            void deleteToeicAnnotation(selectedAnnotation.id).then(() => {
              onDeleted(selectedAnnotation.id);
              onClearSelection();
            });
          }}
        >
          <Trash2 className="h-4 w-4 text-rose-400" aria-hidden="true" />
        </FloatingAnnotationButton>
        <FloatingAnnotationButton
          label="Mở danh sách annotation"
          active={detailsOpen}
          onClick={() => setDetailsOpen((value) => !value)}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
        </FloatingAnnotationButton>
      </div>

      {detailsOpen && (
        <div className="w-72 max-w-[calc(100vw-88px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/20">
          <AnnotationTool
            key={`${selection?.quote ?? "none"}-${style}`}
            testId={testId}
            annotations={annotations}
            selection={selection}
            onCreated={onCreated}
            onDeleted={onDeleted}
            onClearSelection={onClearSelection}
            initialStyle={style}
          />
        </div>
      )}
    </div>
  );
}

function DictationTool({
  feedback,
}: {
  feedback: ToeicPracticeFeedback | null;
}) {
  const transcript = feedback?.transcript ?? null;
  const [input, setInput] = useState("");
  const [comparison, setComparison] = useState<ToeicDictationComparison | null>(
    null,
  );
  const [revealed, setRevealed] = useState(false);
  if (!transcript)
    return (
      <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
        Chính tả chỉ khả dụng trong Practice sau khi đã mở phản hồi có
        transcript.
      </div>
    );
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-extrabold text-[#493B42]">Chính tả</h3>
        <p className="text-xs text-gray-500">
          Kết quả chỉ là luyện tập, không đổi đáp án hoặc điểm thi.
        </p>
      </div>
      <label className="sr-only" htmlFor="toeic-dictation-input">
        Nhập nội dung nghe được
      </label>
      <textarea
        id="toeic-dictation-input"
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          setComparison(null);
        }}
        rows={4}
        placeholder="Gõ lại câu bạn vừa nghe…"
        className="w-full resize-y rounded-2xl border border-[#FBCFE8] p-3 text-sm leading-6 focus:border-[#F472B6] focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setComparison(evaluateDictation(transcript, input))}
          disabled={!input.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#F472B6] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden="true" /> Kiểm tra
        </button>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FBCFE8] px-4 text-sm font-bold text-[#9D174D]"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />{" "}
          {revealed ? "Ẩn transcript" : "Hiện transcript"}
        </button>
        <button
          type="button"
          onClick={() => {
            setInput("");
            setComparison(null);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FCE7F3] px-3 text-sm font-bold text-gray-600"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Xóa
        </button>
      </div>
      {comparison && (
        <div
          className={`rounded-2xl p-4 text-sm ${comparison.isMatch ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
          role="status"
        >
          <p className="font-extrabold">
            {comparison.isMatch
              ? "Khớp hoàn toàn"
              : `${comparison.matchingWords} từ khớp`}
          </p>
          {!comparison.isMatch && (
            <p className="mt-1">
              Thiếu: {comparison.missingWords.join(", ") || "không có"} · Dư:{" "}
              {comparison.extraWords.join(", ") || "không có"}
            </p>
          )}
        </div>
      )}
      {revealed && (
        <p
          className="rounded-xl bg-[#FFF8FA] p-3 text-sm leading-6 text-[#493B42]"
          aria-label="Transcript"
        >
          {transcript}
        </p>
      )}
    </div>
  );
}

function FlipTool({
  feedback,
  onSaveVocabulary,
}: {
  feedback: ToeicPracticeFeedback | null;
  onSaveVocabulary?: (item: ToeicLearningVocabularyItem) => void;
}) {
  const items = feedback?.vocabulary?.items ?? [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (items.length === 0)
    return (
      <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
        Thẻ từ chỉ xuất hiện khi phản hồi Practice có nội dung từ vựng.
      </div>
    );
  const item = items[index];
  const flip = () => setFlipped((value) => !value);
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-extrabold text-[#493B42]">Thẻ từ</h3>
        <p className="text-xs text-gray-500">
          Trạng thái tạm thời; không tạo rating hoặc review log.
        </p>
      </div>
      <button
        type="button"
        onClick={flip}
        aria-label={flipped ? "Hiện mặt trước" : "Lật thẻ từ"}
        className="group min-h-36 w-full rounded-2xl border border-[#FBCFE8] bg-[#FFF8FA] p-5 text-left transition-transform duration-300 hover:border-[#F472B6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] motion-reduce:transition-none"
      >
        <span className="block text-xs font-bold uppercase tracking-wide text-[#F472B6]">
          {flipped ? "Mặt sau" : "Mặt trước"}
        </span>
        <span className="mt-3 block text-xl font-black text-[#493B42]">
          {flipped ? item.meaningVi || "Chưa có nghĩa" : item.word}
        </span>
        {flipped && item.partOfSpeech && (
          <span className="mt-1 block text-sm text-gray-500">
            {item.partOfSpeech}
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {index + 1}/{items.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setIndex((value) => Math.max(0, value - 1));
              setFlipped(false);
            }}
            disabled={index === 0}
            className="min-h-10 rounded-xl border border-[#FCE7F3] px-3 text-xs font-bold disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => {
              setIndex((value) => Math.min(items.length - 1, value + 1));
              setFlipped(false);
            }}
            disabled={index === items.length - 1}
            className="min-h-10 rounded-xl border border-[#FCE7F3] px-3 text-xs font-bold disabled:opacity-40"
          >
            Sau
          </button>
          {onSaveVocabulary && (
            <button
              type="button"
              onClick={() => onSaveVocabulary(item)}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#F472B6] px-3 text-xs font-bold text-white"
            >
              <Save className="h-4 w-4" aria-hidden="true" /> Lưu từ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ToeicLearningToolsPanel({
  testId,
  questionId,
  isPractice,
  feedback,
  annotations,
  selection,
  onAnnotationCreated,
  onAnnotationDeleted,
  onClearSelection,
  onSaveVocabulary,
  onOpenNotes,
  showLabel = true,
}: {
  testId: string;
  questionId: string | null;
  isPractice: boolean;
  feedback: ToeicPracticeFeedback | null;
  annotations: ReadonlyArray<ToeicTextAnnotation>;
  selection: ToeicTextSelectionDraft | null;
  onAnnotationCreated: (annotation: ToeicTextAnnotation) => void;
  onAnnotationDeleted: (id: string) => void;
  onClearSelection: () => void;
  onSaveVocabulary?: (item: ToeicLearningVocabularyItem) => void;
  onOpenNotes?: () => void;
  showLabel?: boolean;
}) {
  const [tool, setTool] = useState<Tool | null>(null);
  return (
    <section
      className="rounded-2xl border border-[#FCE7F3] bg-white p-2 shadow-[0_4px_12px_rgba(236,72,153,0.06)]"
      aria-label="Công cụ học"
    >
      <div className="flex flex-wrap items-center gap-1">
        {showLabel && (
          <span className="mr-1 inline-flex min-h-10 items-center px-2 text-xs font-black text-[#493B42]">
            Công cụ học
          </span>
        )}
        <ToolButton
          active={tool === "notes"}
          label="Ghi chú"
          onClick={() =>
            onOpenNotes
              ? onOpenNotes()
              : setTool(tool === "notes" ? null : "notes")
          }
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          active={tool === "annotation"}
          label="Annotator"
          onClick={() => setTool(tool === "annotation" ? null : "annotation")}
        >
          <Highlighter className="h-4 w-4" aria-hidden="true" />
        </ToolButton>
        {isPractice && (
          <>
            <ToolButton
              active={tool === "dictation"}
              label="Điền từ"
              onClick={() => setTool(tool === "dictation" ? null : "dictation")}
            >
              <Clipboard className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton
              active={tool === "flip"}
              label="Lật từ"
              onClick={() => setTool(tool === "flip" ? null : "flip")}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
          </>
        )}
      </div>
      {tool && (
        <div
          className={
            tool === "annotation"
              ? ""
              : "mt-3 border-t border-[#FCE7F3] p-2 pt-4"
          }
        >
          {tool === "notes" && (
            <ToeicNotesPanel
              key={`${testId}-${questionId ?? "test"}`}
              testId={testId}
              questionId={questionId}
            />
          )}
          {tool === "annotation" && (
            <FloatingAnnotationToolbar
              testId={testId}
              annotations={annotations}
              selection={selection}
              onCreated={onAnnotationCreated}
              onDeleted={onAnnotationDeleted}
              onClearSelection={onClearSelection}
              onClose={() => setTool(null)}
            />
          )}
          {tool === "lookup" && (
            <LookupTool onSaveVocabulary={onSaveVocabulary} />
          )}
          {tool === "dictation" && (
            <DictationTool
              key={feedback?.questionId ?? "dictation-empty"}
              feedback={feedback}
            />
          )}
          {tool === "flip" && (
            <FlipTool
              key={feedback?.questionId ?? "flip-empty"}
              feedback={feedback}
              onSaveVocabulary={onSaveVocabulary}
            />
          )}
        </div>
      )}
      {selection && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            Đã chọn văn bản. Mở Annotator để highlight hoặc gạch chân.
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-bold"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Bỏ chọn
          </button>
        </div>
      )}
      {tool === null && selection && (
        <button
          type="button"
          onClick={() => setTool("annotation")}
          className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F472B6] px-3 text-xs font-bold text-white"
        >
          <Highlighter className="h-4 w-4" aria-hidden="true" /> Đánh dấu đoạn
          chọn
        </button>
      )}
    </section>
  );
}
