import {
  buildVocabularyExportFilename,
  buildVocabularyExportMatrix,
  filterVocabulariesByExportScope,
  sanitizeExcelFilename,
  type VocabularyExportOptions,
} from './excelUtils';
import type { Collection, Topic, Vocabulary } from './types';

const collections: Collection[] = [
  { id: 'collection-a', title: 'TOEIC / Office: Basic' },
  { id: 'collection-b', title: 'Travel' },
];

const topics: Topic[] = [
  { id: 'section-a1', collection_id: 'collection-a', title: 'Office', description: '', icon: 'book' },
  { id: 'section-a2', collection_id: 'collection-a', title: 'Meetings', description: '', icon: 'book' },
  { id: 'section-b1', collection_id: 'collection-b', title: 'Airport', description: '', icon: 'book' },
];

const vocabularies: Vocabulary[] = [
  {
    id: 'vocab-a1',
    topic_id: 'section-a1',
    word: 'agenda',
    part_of_speech: 'noun',
    meaning: 'chương trình nghị sự',
    synonyms: 'schedule, program',
    collocations: 'meeting agenda',
  },
  {
    id: 'vocab-a2',
    topic_id: 'section-a2',
    word: 'deadline',
    part_of_speech: 'noun',
    meaning: 'hạn chót',
  },
  {
    id: 'vocab-b1',
    topic_id: 'section-b1',
    word: 'boarding',
    part_of_speech: 'noun',
    meaning: 'lên máy bay',
  },
  {
    id: 'vocab-orphan',
    topic_id: 'missing-section',
    word: 'orphan',
    part_of_speech: 'noun',
    meaning: 'từ mồ côi',
  },
];

function makeOptions(scope: VocabularyExportOptions['scope']): VocabularyExportOptions {
  return { collections, topics, vocabularies, scope };
}

describe('scoped vocabulary Excel export data', () => {
  it('filters a Section, preserves input, and removes duplicate vocabulary IDs', () => {
    const input = [...vocabularies, { ...vocabularies[0] }];
    const result = filterVocabulariesByExportScope({
      ...makeOptions({ type: 'section', sectionId: 'section-a1', sectionTitle: 'Office' }),
      vocabularies: input,
    });

    expect(result.map((vocabulary) => vocabulary.id)).toEqual(['vocab-a1']);
    expect(input).toHaveLength(5);
    expect(vocabularies).toHaveLength(4);
  });

  it('filters a Collection across its Sections and excludes other or orphan vocabularies', () => {
    const result = filterVocabulariesByExportScope(
      makeOptions({
        type: 'collection',
        collectionId: 'collection-a',
        collectionTitle: 'TOEIC / Office: Basic',
      })
    );

    expect(result.map((vocabulary) => vocabulary.id)).toEqual(['vocab-a1', 'vocab-a2']);
  });

  it('returns no rows for an empty Section', () => {
    const result = filterVocabulariesByExportScope(
      makeOptions({ type: 'section', sectionId: 'empty-section', sectionTitle: 'Empty' })
    );

    expect(result).toEqual([]);
  });

  it('uses one column mapper for all scopes and keeps empty cells safe', () => {
    const matrix = buildVocabularyExportMatrix(
      makeOptions({ type: 'section', sectionId: 'section-a1', sectionTitle: 'Office' })
    );

    expect(matrix[0]).toEqual([
      'Từ vựng',
      'IPA-UK',
      'IPA-US',
      'Loại từ',
      'Meaning',
      'Example',
      'Example_vi',
      'Từ đồng nghĩa',
      'Cụm từ',
      'Ghi chú',
      'Học phần',
      'Bộ sưu tập',
    ]);
    expect(matrix[1]).toEqual([
      'agenda',
      '',
      '',
      'noun',
      'chương trình nghị sự',
      '',
      '',
      'schedule, program',
      'meeting agenda',
      '',
      'Office',
      'TOEIC / Office: Basic',
    ]);
    expect(JSON.stringify(matrix)).not.toContain('[object Object]');
  });
});

describe('Excel export filenames', () => {
  it('sanitizes invalid characters, whitespace, empty titles, and length', () => {
    expect(sanitizeExcelFilename('TOEIC / Office: Basic')).toBe('TOEIC_Office_Basic');
    expect(sanitizeExcelFilename('   ')).toBe('Untitled');
    expect(sanitizeExcelFilename('a'.repeat(100))).toHaveLength(80);
    expect(sanitizeExcelFilename('a\\b:c*d?e"f<g>h|i')).toBe('a_b_c_d_e_f_g_h_i');
  });

  it('uses the browser-local calendar date in the generated filename', () => {
    const filename = buildVocabularyExportFilename(
      { type: 'section', sectionId: 'section-a1', sectionTitle: 'Office' },
      new Date(2026, 7, 5, 0, 30)
    );

    expect(filename).toBe('EasyTOEIC_Section_Office_2026-08-05.xlsx');
  });
});
