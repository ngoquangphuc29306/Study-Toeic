import { describe, expect, it } from 'vitest';
import { mapDictionaryLookupResponse, mapToeicAnnotationsResponse, mapToeicNotesResponse } from './toeicToolMapper';

const ids = { note: '11111111-1111-4111-8111-111111111111', test: '22222222-2222-4222-8222-222222222222', question: '33333333-3333-4333-8333-333333333333' };
const date = '2026-08-05T00:00:00Z';

describe('toeic tool mappers', () => {
  it('maps notes without accepting malformed rows', () => { expect(mapToeicNotesResponse([{ id: ids.note, testId: ids.test, questionId: null, content: 'Remember', createdAt: date, updatedAt: date }])[0].content).toBe('Remember'); expect(() => mapToeicNotesResponse([{}])).toThrow('Invalid TOEIC note'); });
  it('maps only allowlisted annotation styles', () => { const annotation = { id: ids.note, testId: ids.test, questionId: ids.question, passageId: null, documentIndex: null, startOffset: 0, endOffset: 4, quote: 'Test', style: 'highlight', comment: null, createdAt: date, updatedAt: date }; expect(mapToeicAnnotationsResponse([annotation])[0].style).toBe('highlight'); expect(() => mapToeicAnnotationsResponse([{ ...annotation, style: 'red' }])).toThrow('Invalid TOEIC annotation style'); });
  it('maps dictionary allowlisted fields', () => expect(mapDictionaryLookupResponse({ term: 'test', phonetic: null, partOfSpeech: 'noun', definitions: ['a trial'], examples: [] })).toEqual({ term: 'test', phonetic: null, partOfSpeech: 'noun', definitions: ['a trial'], examples: [] }));
});
