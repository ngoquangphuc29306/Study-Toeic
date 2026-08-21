import { describe, expect, it } from 'vitest';
import { mapToeicAttemptReviewLearningResponse, mapToeicPracticeFeedbackResponse } from './toeicLearningMapper';

const attemptId = '11111111-1111-4111-8111-111111111111';
const testId = '22222222-2222-4222-8222-222222222222';
const questionId = '33333333-3333-4333-8333-333333333333';
const passageId = '44444444-4444-4444-8444-444444444444';

const practice = {
  attemptId, questionId, passageId, questionNumber: 101, part: 5,
  selectedAnswer: 'B', correctAnswer: 'B', isCorrect: true,
  explanationEn: 'Reason', explanationVi: 'Giải thích', aiExplanation: null,
  transcript: null, translation: null,
  vocabulary: { items: [{ word: 'approve', partOfSpeech: 'verb', meaningVi: 'phê duyệt' }], raw: null },
};

describe('TOEIC learning mapper', () => {
  it('maps practice feedback and preserves parsed vocabulary', () => {
    expect(mapToeicPracticeFeedbackResponse(practice)).toMatchObject({ questionId, correctAnswer: 'B', vocabulary: practice.vocabulary });
  });

  it('rejects unexpected fields and malformed answer keys', () => {
    expect(() => mapToeicPracticeFeedbackResponse({ ...practice, correctAnswer: 'E' })).toThrow('Invalid learning option');
    expect(() => mapToeicPracticeFeedbackResponse({ ...practice, secret: 'answer-key leak' })).toThrow('Unexpected learning field');
  });

  it('maps submitted review content and rejects question/passage mismatch', () => {
    const response = {
      attemptId, testId, status: 'submitted',
      questions: [{ ...practice, isFlagged: false }],
      passages: [{ passageId, transcript: 'Transcript', translation: 'Bản dịch' }],
    };
    expect(mapToeicAttemptReviewLearningResponse(response).questions).toHaveLength(1);
    expect(() => mapToeicAttemptReviewLearningResponse({ ...response, questions: [{ ...practice, isFlagged: false, passageId: testId }] })).toThrow('unknown passage');
  });
});
