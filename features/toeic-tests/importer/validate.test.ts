import { validateRawToeicTestFile } from './validate';

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    part: 5,
    section: 'reading',
    question_number: 1,
    options: { A: 'A', B: 'B', C: 'C', D: null },
    correct_answer: 'A',
    ...overrides,
  };
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    test: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Fixture',
      set_name: '2026',
      year: 2026,
      source: 'Fixture',
      is_free: true,
      media_folder: '2026/t1',
      total_questions: 1,
    },
    scrapedAt: '2026-08-05T00:00:00.000Z',
    questionCount: 1,
    passageCount: 0,
    aiExplanationCount: 0,
    mediaCheck: { total: 0, ok: 0, fixed: [], broken: [] },
    questions: [question()],
    ...overrides,
  };
}

describe('raw TOEIC validation', () => {
  it('accepts a valid minimal question file', () => {
    const result = validateRawToeicTestFile(file());
    expect(result.errors).toEqual([]);
    expect(result.value?.questions).toHaveLength(1);
  });

  it('rejects duplicate numbers, invalid parts, section mismatch and unsafe media', () => {
    const result = validateRawToeicTestFile(file({
      test: { ...file().test, total_questions: 2 },
      questionCount: 2,
      questions: [
        question({ audio_url: '../unsafe.mp3' }),
        question({ id: '00000000-0000-4000-8000-000000000002', part: 1, section: 'reading', question_number: 1 }),
      ],
    }));

    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unsafe_media_path',
      'section_part_mismatch',
      'duplicate_question_number',
    ]));
  });

  it('rejects unknown options and correct answers pointing to null', () => {
    const result = validateRawToeicTestFile(file({
      questions: [question({ options: { A: 'A', B: 'B', C: 'C', D: null, E: 'E' }, correct_answer: 'D' })],
    }));

    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unknown_option_key',
      'correct_answer_is_null',
    ]));
  });

  it('reports the source set/year anomaly without changing source values', () => {
    const result = validateRawToeicTestFile(file({
      test: { ...file().test, set_name: '2026', year: 2023 },
    }));

    expect(result.value?.test.year).toBe(2023);
    expect(result.warnings.map((issue) => issue.code)).toContain('metadata_year_mismatch');
  });
});
