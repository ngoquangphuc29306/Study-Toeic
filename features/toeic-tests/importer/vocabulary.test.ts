import { parseVocabularyContent, toVocabularyContent } from './vocabulary';

describe('TOEIC vocabulary normalization', () => {
  it('parses noun, verb, adjective and multi-word phrases', () => {
    const result = parseVocabularyContent(
      'Focus group (n.phr): nhóm thảo luận\n\n\nwell-known (adj): nổi tiếng\n\nrun out (v): hết'
    );

    expect(result?.items).toEqual([
      { word: 'Focus group', partOfSpeech: 'n.phr', meaningVi: 'nhóm thảo luận' },
      { word: 'well-known', partOfSpeech: 'adj', meaningVi: 'nổi tiếng' },
      { word: 'run out', partOfSpeech: 'v', meaningVi: 'hết' },
    ]);
    expect(result?.unparsedLineCount).toBe(0);
  });

  it('preserves raw text and reports malformed blocks', () => {
    const result = parseVocabularyContent('Valid (n): hợp lệ\n\nMalformed line');

    expect(result?.items).toHaveLength(1);
    expect(result?.unparsedLineCount).toBe(1);
    expect(result?.raw).toContain('Malformed line');
  });

  it('returns structured JSON content or null for empty input', () => {
    expect(toVocabularyContent('Word (n): Nghĩa')).toEqual({
      items: [{ word: 'Word', partOfSpeech: 'n', meaningVi: 'Nghĩa' }],
      raw: 'Word (n): Nghĩa',
    });
    expect(toVocabularyContent('   ')).toBeNull();
  });
});
