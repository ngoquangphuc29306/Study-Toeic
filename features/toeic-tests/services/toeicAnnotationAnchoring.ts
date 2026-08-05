import type { ToeicTextAnnotation } from '../toolContracts';

export interface ToeicAnnotatedSegment { text: string; annotation: ToeicTextAnnotation | null; }

/**
 * Anchors annotations to stable text offsets and quote snapshots. If content
 * changed, a unique exact quote match is accepted; ambiguous/missing matches
 * are returned as stale instead of breaking the renderer.
 */
export function resolveAnnotationRange(text: string, annotation: ToeicTextAnnotation): { start: number; end: number } | null {
  if (annotation.startOffset >= 0 && annotation.endOffset <= text.length && text.slice(annotation.startOffset, annotation.endOffset) === annotation.quote) return { start: annotation.startOffset, end: annotation.endOffset };
  const first = text.indexOf(annotation.quote);
  if (first < 0 || text.indexOf(annotation.quote, first + 1) >= 0) return null;
  return { start: first, end: first + annotation.quote.length };
}

export function splitAnnotatedText(text: string, annotations: ReadonlyArray<ToeicTextAnnotation>): { segments: ReadonlyArray<ToeicAnnotatedSegment>; staleIds: ReadonlyArray<string> } {
  const ranges = annotations.map((annotation) => ({ annotation, range: resolveAnnotationRange(text, annotation) })).filter((item): item is { annotation: ToeicTextAnnotation; range: { start: number; end: number } } => item.range !== null).sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);
  const staleIds = annotations.filter((annotation) => !ranges.some((item) => item.annotation.id === annotation.id)).map((annotation) => annotation.id);
  const segments: ToeicAnnotatedSegment[] = [];
  let cursor = 0;
  for (const item of ranges) {
    if (item.range.start < cursor) continue;
    if (item.range.start > cursor) segments.push({ text: text.slice(cursor, item.range.start), annotation: null });
    segments.push({ text: text.slice(item.range.start, item.range.end), annotation: item.annotation });
    cursor = item.range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), annotation: null });
  return { segments, staleIds };
}

export interface ToeicTextSelectionDraft {
  questionId: string | null;
  passageId: string | null;
  documentIndex: number | null;
  startOffset: number;
  endOffset: number;
  quote: string;
}

export function buildSelectionDraft(selection: Selection | null): ToeicTextSelectionDraft | null {
  if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return null;
  const anchorElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode as Element : selection.anchorNode.parentElement;
  const element = anchorElement?.closest<HTMLElement>('[data-toeic-text-target]');
  if (!element || !element.contains(selection.focusNode)) return null;
  const quote = selection.toString().trim();
  if (!quote) return null;
  const target = element.dataset.toeicTextTarget;
  const targetId = element.dataset.toeicTextTargetId;
  if (!targetId || (target !== 'question' && target !== 'passage')) return null;
  const range = selection.getRangeAt(0);
  const before = document.createRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);
  const startOffset = before.toString().length;
  return { questionId: target === 'question' ? targetId : null, passageId: target === 'passage' ? targetId : null, documentIndex: target === 'passage' ? Number(element.dataset.toeicDocumentIndex ?? 0) : null, startOffset, endOffset: startOffset + quote.length, quote };
}
