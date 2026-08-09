import { describe, expect, it } from 'vitest';
import { getToeicMediaGroupKey } from './toeicMediaGroup';

const question = {
  ref: { questionId: 'q-1', part: 3 as const, position: 1 },
  question: { id: 'q-1', passageId: 'p-1', part: 3 as const, section: 'listening' as const, questionNumber: 32, questionText: null, options: { A: null, B: null, C: null, D: null }, audioPath: 'q.mp3', imagePath: null, position: 1 },
  passage: { id: 'p-1', part: 3 as const, passageType: null, title: null, content: { documents: [] }, audioPath: 'shared.mp3', imagePath: null, position: 1 },
};

describe('getToeicMediaGroupKey', () => {
  it('prefers the production passage identity', () => {
    expect(getToeicMediaGroupKey(question)).toBe('passage:p-1');
  });

  it('falls back to a canonical audio path and then question identity', () => {
    expect(getToeicMediaGroupKey({ ...question, question: { ...question.question, passageId: null }, passage: null })).toBe('audio:q.mp3');
    expect(getToeicMediaGroupKey({ ...question, question: { ...question.question, passageId: null, audioPath: null }, passage: null })).toBe('question:q-1');
  });

  it('does not use external query tokens as fallback identity', () => {
    const first = getToeicMediaGroupKey({
      ...question,
      question: { ...question.question, passageId: null, audioPath: 'https://media.example.com/audio.mp3?token=one' },
      passage: null,
    });
    const second = getToeicMediaGroupKey({
      ...question,
      question: { ...question.question, passageId: null, audioPath: 'https://media.example.com/audio.mp3?token=two' },
      passage: null,
    });
    expect(first).toBe('audio:https://media.example.com/audio.mp3');
    expect(second).toBe(first);
  });
});
