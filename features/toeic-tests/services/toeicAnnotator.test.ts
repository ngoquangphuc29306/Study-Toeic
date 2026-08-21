import { describe, expect, it } from 'vitest';
import { isToeicAnnotationGeometry, isToeicAnnotationType, validateToeicAnnotatorInput } from './toeicAnnotator';

const base = {
  testId: '11111111-1111-4111-8111-111111111111', questionId: '22222222-2222-4222-8222-222222222222', passageId: null,
  documentIndex: null, startOffset: 0, endOffset: 1, quote: '[annotation]', annotationType: 'rectangle' as const,
  color: '#F472B6', strokeWidth: 2, geometry: { kind: 'box' as const, x: 0.1, y: 0.1, width: 0.3, height: 0.2 }, textContent: null, comment: null,
};

describe('toeic annotator contracts', () => {
  it('allowlists tools and normalized geometry', () => {
    expect(isToeicAnnotationType('arrow')).toBe(true);
    expect(isToeicAnnotationType('script')).toBe(false);
    expect(isToeicAnnotationGeometry(base.geometry)).toBe(true);
    expect(isToeicAnnotationGeometry({ kind: 'box', x: 0.9, y: 0, width: 0.5, height: 0.1 })).toBe(false);
  });
  it('rejects malformed advanced input before the RPC boundary', () => {
    expect(() => validateToeicAnnotatorInput({ ...base, color: 'red' })).toThrow();
    expect(() => validateToeicAnnotatorInput({ ...base, annotationType: 'sticky', geometry: base.geometry, textContent: '' })).toThrow();
    expect(() => validateToeicAnnotatorInput({ ...base, annotationType: 'pen', geometry: null })).toThrow();
  });
});
