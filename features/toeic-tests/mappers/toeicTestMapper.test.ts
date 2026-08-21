import { describe, expect, it } from 'vitest';
import { mapCatalogRpcResponse, mapPartRpcResponse } from './toeicTestMapper';

const catalogItem = {
  id: 'test-1',
  name: 'Mock Test',
  set_name: 'Set 1',
  year: 2026,
  source: 'official',
  description: null,
  is_free: true,
  total_questions: 200,
  duration_seconds: 7200,
};

const partResponse = {
  test: {
    id: 'test-1',
    name: 'Mock Test',
    set_name: 'Set 1',
    year: 2026,
    source: 'official',
    duration_seconds: 7200,
  },
  part: 5,
  passages: [],
  questions: [{
    id: 'question-1',
    passage_id: null,
    part: 5,
    section: 'reading',
    question_number: 101,
    question_text: 'Choose the best answer.',
    options: { A: 'A', B: 'B', C: 'C', D: null },
    audio_path: null,
    image_path: null,
    position: 100,
  }],
};

describe('TOEIC read mappers', () => {
  it('maps the catalog DTO without widening the test-taking payload', () => {
    expect(mapCatalogRpcResponse({ items: [catalogItem] })[0]).toEqual({
      id: 'test-1',
      name: 'Mock Test',
      setName: 'Set 1',
      year: 2026,
      source: 'official',
      description: null,
      isFree: true,
      totalQuestions: 200,
      durationSeconds: 7200,
    });
  });

  it('rejects forbidden answer and explanation fields', () => {
    expect(() => mapPartRpcResponse({
      ...partResponse,
      questions: [{ ...partResponse.questions[0], correct_answer: 'A' }],
    })).toThrow(/Forbidden TOEIC response field/);
  });

  it('maps only safe part question fields', () => {
    const payload = mapPartRpcResponse(partResponse);
    expect(payload.questions[0]).toEqual({
      id: 'question-1',
      passageId: null,
      part: 5,
      section: 'reading',
      questionNumber: 101,
      questionText: 'Choose the best answer.',
      options: { A: 'A', B: 'B', C: 'C', D: null },
      audioPath: null,
      imagePath: null,
      position: 100,
    });
    expect(payload.questions[0]).not.toHaveProperty('correctAnswer');
  });
});
