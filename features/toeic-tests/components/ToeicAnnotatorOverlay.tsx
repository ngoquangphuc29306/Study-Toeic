'use client';

import { useRef, useState } from 'react';
import type { ToeicTextAnnotation, ToeicAnnotationGeometry, ToeicAnnotationTool } from '../toolContracts';
import { createToeicAnnotatorAnnotation, deleteToeicAnnotation } from '../services/toeicToolService';

type Point = { x: number; y: number };
type DraftText = { x: number; y: number; width: number; height: number; kind: 'text' | 'sticky' };

function pointFromEvent(event: React.PointerEvent<HTMLDivElement>, element: HTMLDivElement): Point {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))),
  };
}

function geometryBounds(geometry: ToeicAnnotationGeometry): { x: number; y: number; width: number; height: number } {
  if (geometry.kind === 'box') return geometry;
  if (geometry.kind === 'arrow') return { x: Math.min(geometry.x1, geometry.x2), y: Math.min(geometry.y1, geometry.y2), width: Math.abs(geometry.x2 - geometry.x1), height: Math.abs(geometry.y2 - geometry.y1) };
  const xs = geometry.points.map((point) => point.x);
  const ys = geometry.points.map((point) => point.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function hitTest(geometry: ToeicAnnotationGeometry, point: Point): boolean {
  const bounds = geometryBounds(geometry);
  const padding = 0.025;
  return point.x >= bounds.x - padding && point.x <= bounds.x + bounds.width + padding && point.y >= bounds.y - padding && point.y <= bounds.y + bounds.height + padding;
}

export function ToeicAnnotatorOverlay({
  testId,
  questionId,
  annotations,
  visible,
  tool,
  color,
  strokeWidth,
  onCreated,
  onDeleted,
  onError,
}: {
  testId: string;
  questionId: string;
  annotations: ReadonlyArray<ToeicTextAnnotation>;
  visible: boolean;
  tool: ToeicAnnotationTool;
  color: string;
  strokeWidth: number;
  onCreated: (annotation: ToeicTextAnnotation) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<ReadonlyArray<Point>>([]);
  const [draftText, setDraftText] = useState<DraftText | null>(null);
  const [text, setText] = useState('');
  const drawing = tool === 'pen' || tool === 'rectangle' || tool === 'arrow';
  const shapeAnnotations = visible ? annotations.filter((annotation) => annotation.geometry && annotation.questionId === questionId) : [];

  const create = async (geometry: ToeicAnnotationGeometry, annotationType: 'pen' | 'rectangle' | 'arrow' | 'text' | 'sticky', textContent: string | null = null) => {
    try {
      const saved = await createToeicAnnotatorAnnotation({
        testId, questionId, passageId: null, documentIndex: null, startOffset: 0, endOffset: 1,
        quote: '[annotation]', annotationType, color, strokeWidth, geometry, textContent, comment: null,
      });
      onCreated(saved);
      setPoints([]); setDraftText(null); setText('');
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Không thể lưu annotator.');
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !surfaceRef.current) return;
    const point = pointFromEvent(event, surfaceRef.current);
    if (tool === 'eraser') {
      const target = [...shapeAnnotations].reverse().find((annotation) => annotation.geometry && hitTest(annotation.geometry, point));
      if (target) void deleteToeicAnnotation(target.id).then(() => onDeleted(target.id)).catch((cause) => onError(cause instanceof Error ? cause.message : 'Không thể xóa annotator.'));
      return;
    }
    if (tool === 'text' || tool === 'sticky') {
      setDraftText({ x: point.x, y: point.y, width: 0.25, height: 0.08, kind: tool });
      setText('');
      return;
    }
    if (!drawing) return;
    setPoints([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing || points.length === 0 || !surfaceRef.current) return;
    const next = pointFromEvent(event, surfaceRef.current);
    if (tool === 'pen') setPoints((current) => [...current, next]);
    else setPoints((current) => [current[0], next]);
  };

  const onPointerUp = () => {
    if (!drawing || points.length < 2) return;
    const [start, end] = [points[0], points[points.length - 1]];
    if (tool === 'pen') void create({ kind: 'freehand', points }, 'pen');
    if (tool === 'rectangle') void create({ kind: 'box', x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }, 'rectangle');
    if (tool === 'arrow') void create({ kind: 'arrow', x1: start.x, y1: start.y, x2: end.x, y2: end.y }, 'arrow');
  };

  return (
    <div
      ref={surfaceRef}
      className={`absolute inset-0 z-20 ${tool === 'select' || tool === 'highlight' || tool === 'underline' ? 'pointer-events-none' : 'pointer-events-auto'}`}
      data-toeic-annotation-surface="true"
      aria-label="Vùng vẽ annotator"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {visible && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 1 1">
          {shapeAnnotations.map((annotation) => {
            const geometry = annotation.geometry;
            if (!geometry) return null;
            if (geometry.kind === 'freehand') return <polyline key={annotation.id} points={geometry.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={annotation.color} strokeWidth={annotation.strokeWidth / 500} strokeLinecap="round" strokeLinejoin="round" />;
            if (geometry.kind === 'box') return <g key={annotation.id}><rect x={geometry.x} y={geometry.y} width={geometry.width} height={geometry.height} fill={annotation.annotationType === 'sticky' ? `${annotation.color}33` : 'transparent'} stroke={annotation.color} strokeWidth={annotation.strokeWidth / 500} rx="0.01" /><foreignObject x={geometry.x} y={geometry.y} width={geometry.width} height={geometry.height} className="pointer-events-none overflow-visible"><div className="h-full w-full p-1 text-left text-[12px] font-semibold" style={{ color: annotation.color }}>{annotation.textContent}</div></foreignObject></g>;
            return <line key={annotation.id} x1={geometry.x1} y1={geometry.y1} x2={geometry.x2} y2={geometry.y2} stroke={annotation.color} strokeWidth={annotation.strokeWidth / 500} markerEnd="url(#toeic-annotator-arrow)" />;
          })}
          <defs><marker id="toeic-annotator-arrow" markerWidth="0.04" markerHeight="0.04" refX="0.035" refY="0.02" orient="auto"><path d="M 0 0 L 0.04 0.02 L 0 0.04 z" fill="context-stroke" /></marker></defs>
          {points.length > 1 && tool === 'pen' && <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth / 500} strokeLinecap="round" />}
        </svg>
      )}
      {draftText && (
        <form
          className="absolute z-30 w-64 rounded-xl border border-sky-300 bg-white p-2 shadow-xl"
          style={{ left: `${draftText.x * 100}%`, top: `${draftText.y * 100}%` }}
          onSubmit={(event) => { event.preventDefault(); if (text.trim()) void create({ kind: 'box', x: draftText.x, y: draftText.y, width: draftText.width, height: draftText.height }, draftText.kind, text.trim()); }}
        >
          <label className="sr-only" htmlFor="toeic-annotator-text">Nội dung annotator</label>
          <input id="toeic-annotator-text" autoFocus value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder={draftText.kind === 'sticky' ? 'Nội dung ghi chú' : 'Văn bản'} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-sky-400" />
          <div className="mt-2 flex justify-end gap-2 text-xs font-bold"><button type="button" className="rounded-lg px-2 py-1 text-[#493B42]" onClick={() => setDraftText(null)}>Hủy</button><button type="submit" className="rounded-lg bg-sky-500 px-2 py-1 text-white">Lưu</button></div>
        </form>
      )}
    </div>
  );
}
