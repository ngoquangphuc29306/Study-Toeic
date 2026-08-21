'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Eraser, Eye, GripVertical, Hand, Highlighter, Palette, PenLine, Redo2, Square, StickyNote, Trash2, Type, Underline, Undo2, X } from 'lucide-react';
import type { ToeicTextSelectionDraft } from '../services/toeicAnnotationAnchoring';
import { createToeicAnnotatorAnnotation, deleteToeicAnnotation } from '../services/toeicToolService';
import { TOEIC_ANNOTATION_COLORS } from '../services/toeicAnnotator';
import type { ToeicAnnotationStyle, ToeicAnnotationTool, ToeicTextAnnotation } from '../toolContracts';

function Button({ label, active = false, disabled = false, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={disabled ? `${label} — chưa hỗ trợ trong phiên này` : label} aria-pressed={active} disabled={disabled} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${active ? 'bg-sky-500 text-white shadow-sm' : 'text-white hover:bg-white/10'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>{children}</button>;
}

function annotationInput(annotation: ToeicTextAnnotation) {
  return { testId: annotation.testId, questionId: annotation.questionId, passageId: annotation.passageId, documentIndex: annotation.documentIndex, startOffset: annotation.startOffset, endOffset: annotation.endOffset, quote: annotation.quote, annotationType: annotation.annotationType, color: annotation.color, strokeWidth: annotation.strokeWidth, geometry: annotation.geometry, textContent: annotation.textContent, comment: annotation.comment };
}

export function ToeicAnnotatorToolbar({
  testId, annotations, selection, mode, color, strokeWidth, annotationsVisible,
  onCreated, onDeleted, onClearSelection, onClose, onModeChange, onColorChange,
  onStrokeWidthChange, onToggleVisibility, onDeleteCurrentQuestion,
  onUndo, onRedo, canUndo, canRedo,
}: {
  testId: string;
  annotations: ReadonlyArray<ToeicTextAnnotation>;
  selection: ToeicTextSelectionDraft | null;
  mode: ToeicAnnotationTool;
  color: string;
  strokeWidth: number;
  annotationsVisible: boolean;
  onCreated: (annotation: ToeicTextAnnotation) => void;
  onDeleted: (id: string) => void;
  onClearSelection: () => void;
  onClose: () => void;
  onModeChange: (mode: ToeicAnnotationTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onToggleVisibility: () => void;
  onDeleteCurrentQuestion: () => Promise<void>;
  onUndo?: () => Promise<void>;
  onRedo?: () => Promise<void>;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [position, setPosition] = useState({ x: 16, y: 120 });
  const [detailsOpen, setDetailsOpen] = useState(Boolean(selection));
  const [style, setStyle] = useState<ToeicAnnotationStyle>('highlight');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<ReadonlyArray<ToeicTextAnnotation>>([]);
  const [redoStack, setRedoStack] = useState<ReadonlyArray<ToeicTextAnnotation>>([]);
  const scoped = selection?.questionId ? annotations.filter((item) => item.questionId === selection.questionId) : selection?.passageId ? annotations.filter((item) => item.passageId === selection.passageId) : annotations;

  const clamp = (x: number, y: number) => {
    const rect = ref.current?.getBoundingClientRect();
    return { x: Math.max(8, Math.min(x, window.innerWidth - (rect?.width ?? 60) - 8)), y: Math.max(8, Math.min(y, window.innerHeight - (rect?.height ?? 520) - 8)) };
  };
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (event.button !== 0 || !rect) return;
    drag.current = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => { if (drag.current?.id === event.pointerId) setPosition(clamp(event.clientX - drag.current.x, event.clientY - drag.current.y)); };
  const endDrag = () => { drag.current = null; };
  const setTool = (next: ToeicAnnotationTool) => { onModeChange(next); setDetailsOpen(next === 'highlight' || next === 'underline' || detailsOpen); };
  const saveSelection = async () => {
    if (!selection) return;
    setBusy(true); setError(null);
    try {
      const saved = await createToeicAnnotatorAnnotation({ testId, ...selection, annotationType: style, color, strokeWidth, geometry: null, textContent: null, comment: comment.trim() || null });
      onCreated(saved); setUndoStack((current) => [...current, saved]); setRedoStack([]); setComment(''); onClearSelection();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu đánh dấu.'); } finally { setBusy(false); }
  };
  const undo = async () => { const item = undoStack.at(-1); if (!item) return; try { await deleteToeicAnnotation(item.id); onDeleted(item.id); setUndoStack((current) => current.slice(0, -1)); setRedoStack((current) => [...current, item]); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể hoàn tác.'); } };
  const redo = async () => { const item = redoStack.at(-1); if (!item) return; try { const restored = await createToeicAnnotatorAnnotation(annotationInput(item)); onCreated(restored); setRedoStack((current) => current.slice(0, -1)); setUndoStack((current) => [...current, restored]); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể làm lại.'); } };
  const selected = selection ? annotations.find((item) => item.questionId === selection.questionId && item.passageId === selection.passageId && item.quote.trim() === selection.quote.trim()) : null;

  return <div ref={ref} className="fixed z-[70] flex items-start gap-2" style={{ left: position.x, top: position.y }}>
    <div className="flex w-14 flex-col items-center gap-1 rounded-2xl border border-slate-700 bg-[#172033] p-2 shadow-2xl shadow-slate-950/25" aria-label="Thanh công cụ Annotator">
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-1">
        <div role="button" tabIndex={0} aria-label="Kéo thanh công cụ Annotator" title="Kéo để di chuyển" className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onKeyDown={(event) => { const step = 16; if (event.key === 'ArrowLeft') setPosition((p) => clamp(p.x - step, p.y)); if (event.key === 'ArrowRight') setPosition((p) => clamp(p.x + step, p.y)); if (event.key === 'ArrowUp') setPosition((p) => clamp(p.x, p.y - step)); if (event.key === 'ArrowDown') setPosition((p) => clamp(p.x, p.y + step)); }}><GripVertical className="h-4 w-4" aria-hidden="true" /></div>
        <button type="button" onClick={onClose} aria-label="Đóng Annotator" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <Button label="Chọn và di chuyển" active={mode === 'select'} onClick={() => setTool('select')}><Hand className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Highlight" active={mode === 'highlight'} onClick={() => { setStyle('highlight'); setTool('highlight'); }}><Highlighter className="h-4 w-4 text-amber-300" aria-hidden="true" /></Button>
      <Button label="Gạch chân" active={mode === 'underline'} onClick={() => { setStyle('underline'); setTool('underline'); }}><Underline className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Vẽ tự do" active={mode === 'pen'} onClick={() => setTool('pen')}><PenLine className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Tẩy annotation" active={mode === 'eraser'} onClick={() => setTool('eraser')}><Eraser className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Thêm văn bản" active={mode === 'text'} onClick={() => setTool('text')}><Type className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Thêm ghi chú" active={mode === 'sticky'} onClick={() => setTool('sticky')}><StickyNote className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Vẽ hình chữ nhật" active={mode === 'rectangle'} onClick={() => setTool('rectangle')}><Square className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Vẽ mũi tên" active={mode === 'arrow'} onClick={() => setTool('arrow')}><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Button>
      <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-yellow-300 hover:bg-white/10" title="Chọn màu annotator"><Palette className="h-4 w-4" aria-hidden="true" /><input type="color" value={color} onChange={(event) => onColorChange(event.target.value)} className="sr-only" aria-label="Chọn màu annotator" /></label>
      <div className="my-1 h-px w-8 bg-white/10" />
      <Button label="Hoàn tác" disabled={canUndo === undefined ? !undoStack.length : !canUndo} onClick={() => void (onUndo ? onUndo() : undo())}><Undo2 className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Làm lại" disabled={canRedo === undefined ? !redoStack.length : !canRedo} onClick={() => void (onRedo ? onRedo() : redo())}><Redo2 className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label={annotationsVisible ? 'Ẩn annotation' : 'Hiện annotation'} active={annotationsVisible} onClick={onToggleVisibility}><Eye className="h-4 w-4" aria-hidden="true" /></Button>
      <Button label="Xóa annotation đã chọn" disabled={!selected} onClick={() => { if (selected) void deleteToeicAnnotation(selected.id).then(() => { onDeleted(selected.id); onClearSelection(); }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Không thể xóa.')); }}><Trash2 className="h-4 w-4 text-rose-400" aria-hidden="true" /></Button>
      <Button label="Xóa annotator của câu hiện tại" onClick={() => void onDeleteCurrentQuestion()}><Trash2 className="h-4 w-4 text-rose-300" aria-hidden="true" /></Button>
      <Button label="Mở danh sách annotation" active={detailsOpen} onClick={() => setDetailsOpen((value) => !value)}><BookOpen className="h-4 w-4" aria-hidden="true" /></Button>
    </div>
    {detailsOpen && <div className="w-80 max-w-[calc(100vw-88px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/20">
      <div className="mb-3 flex items-center gap-2"><label className="text-xs font-bold text-slate-600" htmlFor="toeic-annotation-stroke">Độ dày</label><select id="toeic-annotation-stroke" value={strokeWidth} onChange={(event) => onStrokeWidthChange(Number(event.target.value))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs"><option value="1">Mảnh</option><option value="2">Vừa</option><option value="4">Dày</option><option value="6">Rất dày</option></select><div className="flex gap-1">{TOEIC_ANNOTATION_COLORS.map((item) => <button key={item} type="button" aria-label={`Màu ${item}`} aria-pressed={color === item} onClick={() => onColorChange(item)} className="h-5 w-5 rounded-full border-2 border-white ring-1 ring-slate-200" style={{ backgroundColor: item }} />)}</div></div>
      {(mode === 'highlight' || mode === 'underline') && <div className="rounded-2xl border border-[#FBCFE8] bg-[#FFF8FA] p-3"><p className="text-sm font-semibold text-[#493B42]">{selection ? `Đã chọn: “${selection.quote}”` : 'Bôi đen văn bản để đánh dấu.'}</p>{selection && <><label className="mt-3 block text-xs font-bold text-gray-600">Ghi chú ngắn<input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} className="mt-1 min-h-10 w-full rounded-xl border border-[#FBCFE8] px-3 text-sm font-normal focus:border-[#F472B6] focus:outline-none" /></label><div className="mt-3 flex gap-2"><button type="button" onClick={() => void saveSelection()} disabled={busy} className="rounded-xl bg-[#F472B6] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Lưu đánh dấu</button><button type="button" onClick={onClearSelection} className="rounded-xl border border-[#FBCFE8] px-3 py-2 text-xs font-bold">Bỏ chọn</button></div></>}</div>}
      {scoped.length > 0 && <div className="mt-3 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-gray-500">Đánh dấu đã lưu</p>{scoped.map((item) => <div key={item.id} className="flex items-start justify-between gap-2 rounded-xl border border-[#FCE7F3] bg-white p-2 text-sm"><span style={{ color: item.color }}>{item.textContent ?? item.quote}</span><button type="button" aria-label="Xóa đánh dấu" onClick={() => void deleteToeicAnnotation(item.id).then(() => onDeleted(item.id)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Không thể xóa.'))} className="rounded-lg p-1 text-rose-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div>)}</div>}
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
    </div>}
  </div>;
}
