import { describe, expect, it } from 'vitest';
import { evaluateDictation, normalizeDictation } from './toeicDictation';

describe('toeic dictation comparison', () => {
  it('normalizes case, punctuation and whitespace', () => expect(normalizeDictation("  Hello,  WORLD! ")).toBe('hello world'));
  it('reports a real exact match', () => expect(evaluateDictation('The meeting is today.', 'the meeting is today').isMatch).toBe(true));
  it('does not use partial matching as correct', () => { const result = evaluateDictation('The meeting is today.', 'The meeting is'); expect(result.isMatch).toBe(false); expect(result.missingWords).toEqual(['today']); });
});
