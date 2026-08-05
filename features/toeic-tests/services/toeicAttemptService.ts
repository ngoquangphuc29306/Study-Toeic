import type { ToeicTestPart } from '../types';
import {
  ToeicAttemptError,
  type SaveToeicAttemptAnswersInput,
  type SaveToeicAttemptAnswersResult,
  type StartToeicAttemptInput,
  type ToeicAttemptSession,
} from '../attemptContracts';
import {
  mapSaveToeicAttemptAnswersResponse,
  mapToeicAttemptSessionResponse,
} from '../mappers/toeicAttemptMapper';

export interface ToeicAttemptRpcError {
  code?: string;
  message?: string;
}

export interface ToeicAttemptRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: ToeicAttemptRpcError | null }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALL_TOEIC_PARTS: ReadonlyArray<ToeicTestPart> = [1, 2, 3, 4, 5, 6, 7];

function validateUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new ToeicAttemptError('INVALID_INPUT', `Invalid TOEIC ${field}`);
  }
}

function validateParts(parts: ReadonlyArray<ToeicTestPart>): void {
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > ALL_TOEIC_PARTS.length ||
      parts.some((part) => !Number.isInteger(part) || part < 1 || part > 7) ||
      new Set(parts).size !== parts.length) {
    throw new ToeicAttemptError('INVALID_INPUT', 'Invalid TOEIC selected parts');
  }
}

function validateStartInput(input: StartToeicAttemptInput): void {
  validateUuid(input.testId, 'test id');
  validateUuid(input.idempotencyKey, 'start idempotency key');
  if (input.mode !== 'exam' && input.mode !== 'practice') {
    throw new ToeicAttemptError('INVALID_INPUT', 'Invalid TOEIC attempt mode');
  }
  validateParts(input.selectedParts);
  if (input.mode === 'exam' && input.selectedParts.join(',') !== ALL_TOEIC_PARTS.join(',')) {
    throw new ToeicAttemptError('INVALID_INPUT', 'Exam attempts require all TOEIC parts');
  }
}

function validateSaveInput(input: SaveToeicAttemptAnswersInput): void {
  validateUuid(input.attemptId, 'attempt id');
  validateUuid(input.mutationKey, 'autosave mutation key');
  if (!Array.isArray(input.answers) || input.answers.length < 1 || input.answers.length > 50) {
    throw new ToeicAttemptError('INVALID_INPUT', 'TOEIC autosave batch must contain 1-50 answers');
  }
  const questionIds = new Set<string>();
  for (const answer of input.answers) {
    validateUuid(answer.questionId, 'question id');
    validateUuid(answer.clientMutationId, 'client mutation id');
    if (questionIds.has(answer.questionId)) {
      throw new ToeicAttemptError('INVALID_INPUT', 'TOEIC autosave batch contains a duplicate question');
    }
    questionIds.add(answer.questionId);
    if (answer.selectedAnswer !== null && !['A', 'B', 'C', 'D'].includes(answer.selectedAnswer)) {
      throw new ToeicAttemptError('INVALID_INPUT', 'Invalid TOEIC selected answer');
    }
    if (typeof answer.isFlagged !== 'boolean' ||
        (answer.timeSpentSeconds !== null &&
          (!Number.isInteger(answer.timeSpentSeconds) || answer.timeSpentSeconds < 0)) ||
        (answer.answeredAt !== null && Number.isNaN(Date.parse(answer.answeredAt)))) {
      throw new ToeicAttemptError('INVALID_INPUT', 'Invalid TOEIC autosave answer state');
    }
  }
}

const KNOWN_ERROR_CODES: ReadonlyArray<ToeicAttemptError['code']> = [
  'UNAUTHENTICATED',
  'INVALID_INPUT',
  'TEST_NOT_FOUND',
  'TEST_NOT_PUBLISHED',
  'ATTEMPT_NOT_FOUND',
  'ATTEMPT_NOT_OWNED',
  'ATTEMPT_NOT_ACTIVE',
  'ATTEMPT_EXPIRED',
  'QUESTION_NOT_IN_ATTEMPT',
  'DUPLICATE_ACTIVE_ATTEMPT',
  'SAVE_FAILED',
  'READ_FAILED',
];

function mapRpcError(
  error: ToeicAttemptRpcError,
  fallback: 'SAVE_FAILED' | 'READ_FAILED'
): ToeicAttemptError {
  const marker = `${error.code ?? ''} ${error.message ?? ''}`.toUpperCase();
  const code = KNOWN_ERROR_CODES.find((candidate) => marker.includes(candidate));
  return new ToeicAttemptError(
    code ?? fallback,
    code ? `TOEIC attempt ${code.toLowerCase().replaceAll('_', ' ')}` : 'Unable to process TOEIC attempt',
    { cause: error }
  );
}

export function createToeicAttemptService(client: ToeicAttemptRpcClient) {
  return {
    async startToeicAttempt(input: StartToeicAttemptInput): Promise<ToeicAttemptSession> {
      validateStartInput(input);
      const { data, error } = await client.rpc('start_toeic_attempt', {
        p_test_id: input.testId,
        p_mode: input.mode,
        p_selected_parts: [...input.selectedParts],
        p_idempotency_key: input.idempotencyKey,
      });
      if (error) throw mapRpcError(error, 'READ_FAILED');
      return mapToeicAttemptSessionResponse(data);
    },

    async saveToeicAttemptAnswers(
      input: SaveToeicAttemptAnswersInput
    ): Promise<SaveToeicAttemptAnswersResult> {
      validateSaveInput(input);
      const { data, error } = await client.rpc('save_toeic_attempt_answers', {
        p_attempt_id: input.attemptId,
        p_answers: input.answers,
        p_mutation_key: input.mutationKey,
      });
      if (error) throw mapRpcError(error, 'SAVE_FAILED');
      return mapSaveToeicAttemptAnswersResponse(data);
    },

    async getToeicAttemptSession(attemptId: string): Promise<ToeicAttemptSession> {
      validateUuid(attemptId, 'attempt id');
      const { data, error } = await client.rpc('get_toeic_attempt_session', {
        p_attempt_id: attemptId,
      });
      if (error) throw mapRpcError(error, 'READ_FAILED');
      return mapToeicAttemptSessionResponse(data);
    },

    async abandonToeicAttempt(attemptId: string): Promise<ToeicAttemptSession> {
      validateUuid(attemptId, 'attempt id');
      const { data, error } = await client.rpc('abandon_toeic_attempt', {
        p_attempt_id: attemptId,
      });
      if (error) throw mapRpcError(error, 'SAVE_FAILED');
      return mapToeicAttemptSessionResponse(data);
    },
  };
}

async function getBrowserAttemptService() {
  const { createClient } = await import('@/lib/supabase/client');
  return createToeicAttemptService(createClient());
}

export async function startToeicAttempt(input: StartToeicAttemptInput): Promise<ToeicAttemptSession> {
  return (await getBrowserAttemptService()).startToeicAttempt(input);
}

export async function saveToeicAttemptAnswers(
  input: SaveToeicAttemptAnswersInput
): Promise<SaveToeicAttemptAnswersResult> {
  return (await getBrowserAttemptService()).saveToeicAttemptAnswers(input);
}

export async function getToeicAttemptSession(attemptId: string): Promise<ToeicAttemptSession> {
  return (await getBrowserAttemptService()).getToeicAttemptSession(attemptId);
}

export async function abandonToeicAttempt(attemptId: string): Promise<ToeicAttemptSession> {
  return (await getBrowserAttemptService()).abandonToeicAttempt(attemptId);
}
