import { describe, expect, it } from 'vitest';
import { resolveAnnotationRange, splitAnnotatedText } from './toeicAnnotationAnchoring';
import type { ToeicTextAnnotation } from '../toolContracts';

const annotation = (overrides: Partial<ToeicTextAnnotation> = {}): ToeicTextAnnotation => ({ id: '11111111-1111-4111-8111-111111111111', testId: '22222222-2222-4222-8222-222222222222', questionId: '33333333-3333-4333-8333-333333333333', passageId: null, documentIndex: null, startOffset: 0, endOffset: 4, quote: 'This', style: 'highlight', annotationType: 'highlight', color: '#FDE68A', strokeWidth: 2, geometry: null, textContent: null, comment: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides });

describe('toeic annotation anchoring', () => {
  it('uses exact offsets when the quote still matches', () => expect(resolveAnnotationRange('This is text', annotation())).toEqual({ start: 0, end: 4 }));
  it('uses a unique quote match after harmless content shifts', () => expect(resolveAnnotationRange('A This is text', annotation())).toEqual({ start: 2, end: 6 }));
  it('marks ambiguous quote matches stale', () => expect(resolveAnnotationRange('This and This', annotation({ startOffset: 5, endOffset: 9 }))).toBeNull());
  it('renders non-overlapping segments and leaves stale ids out', () => { const result = splitAnnotatedText('This is text', [annotation(), annotation({ id: '44444444-4444-4444-8444-444444444444', startOffset: 8, endOffset: 12, quote: 'text' }), annotation({ id: '55555555-5555-4555-8555-555555555555', quote: 'missing', endOffset: 7 })]); expect(result.segments.map((item) => item.text)).toEqual(['This', ' is ', 'text']); expect(result.staleIds).toEqual(['55555555-5555-4555-8555-555555555555']); });
});
