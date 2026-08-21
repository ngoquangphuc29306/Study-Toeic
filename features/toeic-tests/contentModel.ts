import type {
  ToeicAttemptQuestionRef,
  ToeicAttemptSession,
} from './attemptContracts';
import {
  ToeicReadError,
  type ToeicTestPartPayload,
  type ToeicTestTakingPassage,
  type ToeicTestTakingQuestion,
} from './readContracts';

export interface ToeicAttemptContentQuestion {
  ref: ToeicAttemptQuestionRef;
  question: ToeicTestTakingQuestion;
  passage: ToeicTestTakingPassage | null;
}

export interface ToeicAttemptContentModel {
  testId: string;
  questions: ReadonlyArray<ToeicAttemptContentQuestion>;
}

export interface BuildToeicAttemptContentModelInput {
  session: ToeicAttemptSession;
  partPayloads: ReadonlyArray<ToeicTestPartPayload>;
  questionRefs?: ReadonlyArray<ToeicAttemptQuestionRef>;
}

function invalid(message: string): never {
  throw new ToeicReadError('INVALID_RESPONSE', message);
}

/**
 * Joins server-owned snapshot refs to safe, part-scoped content. Snapshot
 * order and UUID identity are authoritative; content position is not.
 */
export function buildToeicAttemptContentModel({
  session,
  partPayloads,
  questionRefs = session.questions,
}: BuildToeicAttemptContentModelInput): ToeicAttemptContentModel {
  const questionsById = new Map<string, ToeicTestTakingQuestion>();
  const passagesById = new Map<string, ToeicTestTakingPassage>();

  for (const payload of partPayloads) {
    if (payload.test.id !== session.testId || !session.selectedParts.includes(payload.part)) {
      invalid('TOEIC content does not match the attempt');
    }
    for (const question of payload.questions) {
      if (questionsById.has(question.id)) invalid('Duplicate TOEIC question content');
      if (question.part !== payload.part) invalid('TOEIC question part mismatch');
      questionsById.set(question.id, question);
    }
    for (const passage of payload.passages) {
      if (passagesById.has(passage.id)) invalid('Duplicate TOEIC passage content');
      if (passage.part !== payload.part) invalid('TOEIC passage part mismatch');
      passagesById.set(passage.id, passage);
    }
  }

  const seenRefs = new Set<string>();
  const questions = questionRefs.map((ref) => {
    if (seenRefs.has(ref.questionId)) invalid('Duplicate TOEIC attempt question ref');
    seenRefs.add(ref.questionId);

    const question = questionsById.get(ref.questionId);
    if (!question) invalid('TOEIC attempt question content is missing');
    if (question.part !== ref.part) invalid('TOEIC attempt question part mismatch');

    const passage = question.passageId ? passagesById.get(question.passageId) : undefined;
    if (question.passageId && !passage) invalid('TOEIC attempt passage content is missing');
    if (passage && passage.part !== ref.part) invalid('TOEIC attempt passage part mismatch');

    return { ref, question, passage: passage ?? null };
  });

  return { testId: session.testId, questions };
}
