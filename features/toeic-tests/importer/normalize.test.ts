import { normalizeToeicImport } from './normalize';
import type { RawToeicTestFile } from './types';

function makeRaw(): RawToeicTestFile {
  const makeQuestion = (number: number, overrides: Record<string, unknown> = {}) => ({
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    part: 3,
    section: 'listening',
    question_number: number,
    passage_id: '10000000-0000-4000-8000-000000000001',
    audio_url: 'https://project.supabase.co/storage/v1/object/public/mock-test-media/2026/t1/32-34.mp3',
    options: { A: 'A', B: 'B', C: 'C', D: 'D' },
    correct_answer: 'A',
    transcript: 'Shared transcript',
    passage_type: 'conversation',
    passage_text: 'Shared passage',
    tu_vung: 'Focus group (n.phr): nhóm thảo luận',
    ...overrides,
  });

  return {
    test: {
      id: '20000000-0000-4000-8000-000000000001',
      name: 'Test',
      set_name: '2026',
      year: 2026,
      source: 'Fixture',
      is_free: true,
      media_folder: '2026/t1',
      total_questions: 3,
    },
    scrapedAt: '2026-08-05',
    questionCount: 3,
    passageCount: 1,
    aiExplanationCount: 0,
    mediaCheck: { total: 1, ok: 1, fixed: [], broken: [] },
    questions: [makeQuestion(32), makeQuestion(33), makeQuestion(34)],
  };
}

describe('TOEIC normalization', () => {
  it('groups shared Part 3 media into one passage manifest entry', () => {
    const result = normalizeToeicImport(makeRaw());

    expect(result.errors).toEqual([]);
    expect(result.passages).toHaveLength(1);
    expect(result.passages[0].audio_path).toBe('2026/t1/32-34.mp3');
    expect(result.questions.every((question) => question.audio_path === null)).toBe(true);
    expect(result.mediaManifest).toEqual([
      {
        path: '2026/t1/32-34.mp3',
        kind: 'audio',
        extension: '.mp3',
        usedByQuestionNumbers: [32, 33, 34],
        passageId: '10000000-0000-4000-8000-000000000001',
      },
    ]);
    expect(result.questions[0].vocabulary_content).toEqual({
      items: [{ word: 'Focus group', partOfSpeech: 'n.phr', meaningVi: 'nhóm thảo luận' }],
      raw: 'Focus group (n.phr): nhóm thảo luận',
    });
  });

  it('reports conflicting shared passage fields instead of choosing silently', () => {
    const raw = makeRaw();
    raw.questions[2].transcript = 'Different transcript';
    const result = normalizeToeicImport(raw);

    expect(result.errors.map((issue) => issue.code)).toContain('passage_field_conflict');
  });

  it('keeps deterministic question and passage ordering', () => {
    const raw = makeRaw();
    raw.questions.reverse();
    const result = normalizeToeicImport(raw);

    expect(result.questions.map((question) => question.question_number)).toEqual([32, 33, 34]);
    expect(result.questions.map((question) => question.position)).toEqual([0, 1, 2]);
    expect(result.sourceHash).toHaveLength(64);
  });
});
