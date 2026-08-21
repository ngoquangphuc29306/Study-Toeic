import { describe, expect, it } from 'vitest';
import { buildToeicAttemptContentModel } from './contentModel';
import type { ToeicAttemptSession } from './attemptContracts';
import type { ToeicTestPartPayload } from './readContracts';

const testId = '11111111-1111-4111-8111-111111111111';
const q1 = '22222222-2222-4222-8222-222222222222';
const q2 = '33333333-3333-4333-8333-333333333333';
const passageId = '44444444-4444-4444-8444-444444444444';

const session: ToeicAttemptSession = {
  attemptId: '55555555-5555-4555-8555-555555555555',
  testId,
  mode: 'practice',
  status: 'in_progress',
  selectedParts: [5],
  startedAt: '2026-08-05T00:00:00.000Z',
  deadlineAt: null,
  totalQuestions: 2,
  questions: [
    { questionId: q2, part: 5, position: 2 },
    { questionId: q1, part: 5, position: 1 },
  ],
  answers: [],
  serverNow: '2026-08-05T00:00:00.000Z',
  remainingSeconds: null,
};

const payload: ToeicTestPartPayload = {
  test: { id: testId, name: 'Test', setName: 'Set 1', year: 2026, source: 'Fixture', durationSeconds: 7200 },
  part: 5,
  passages: [{
    id: passageId,
    part: 5,
    passageType: 'email',
    title: 'Email',
    content: { documents: [{ type: 'paragraph', title: null, body: 'Body' }] },
    audioPath: null,
    imagePath: null,
    position: 1,
  }],
  questions: [
    { id: q1, passageId, part: 5, section: 'reading', questionNumber: 1, questionText: 'Q1', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, audioPath: null, imagePath: null, position: 1 },
    { id: q2, passageId: null, part: 5, section: 'reading', questionNumber: 2, questionText: 'Q2', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, audioPath: null, imagePath: null, position: 2 },
  ],
};

describe('buildToeicAttemptContentModel', () => {
  it('uses UUID refs and preserves snapshot order', () => {
    const model = buildToeicAttemptContentModel({ session, partPayloads: [payload] });
    expect(model.questions.map((item) => item.question.id)).toEqual([q2, q1]);
    expect(model.questions[1].passage?.id).toBe(passageId);
  });

  it('rejects missing content, duplicate content, and wrong test payloads', () => {
    expect(() => buildToeicAttemptContentModel({ session, partPayloads: [{ ...payload, questions: [payload.questions[0]] }] })).toThrow('missing');
    expect(() => buildToeicAttemptContentModel({ session, partPayloads: [payload, payload] })).toThrow('Duplicate');
    expect(() => buildToeicAttemptContentModel({ session, partPayloads: [{ ...payload, test: { ...payload.test, id: q1 } }] })).toThrow('does not match');
  });

  it('ignores extra safe content outside the snapshot', () => {
    const extra = { ...payload.questions[0], id: '66666666-6666-4666-8666-666666666666' };
    expect(buildToeicAttemptContentModel({ session, partPayloads: [{ ...payload, questions: [...payload.questions, extra] }] }).questions).toHaveLength(2);
  });
});
