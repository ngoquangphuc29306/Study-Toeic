import {
  ToeicHistoryError,
  type StartToeicWrongQuestionAttemptInput,
  type ToeicAttemptHistoryFilters,
  type ToeicAttemptHistoryPage,
  type ToeicTestProgressSummary,
} from '../historyContracts';
import type { ToeicAttemptSession } from '../attemptContracts';
import { mapToeicAttemptSessionResponse } from '../mappers/toeicAttemptMapper';
import { mapToeicAttemptHistoryResponse, mapToeicTestProgressResponse } from '../mappers/toeicHistoryMapper';

export interface ToeicHistoryRpcError { code?: string; message?: string; }
export interface ToeicHistoryRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: ToeicHistoryRpcError | null }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_CODES: ReadonlyArray<ToeicHistoryError['code']> = [
  'UNAUTHENTICATED', 'INVALID_INPUT', 'ATTEMPT_NOT_FOUND', 'ATTEMPT_NOT_OWNED',
  'ATTEMPT_NOT_SUBMITTED', 'NO_WRONG_QUESTIONS', 'DUPLICATE_ACTIVE_ATTEMPT',
  'TEST_NOT_FOUND', 'SAVE_FAILED', 'READ_FAILED',
];

function validateUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new ToeicHistoryError('INVALID_INPUT', `Invalid TOEIC ${field}`);
}

function validateFilters(filters: ToeicAttemptHistoryFilters): void {
  if (filters.testId) validateUuid(filters.testId, 'test id');
  if (filters.mode !== undefined && filters.mode !== null && filters.mode !== 'exam' && filters.mode !== 'practice') throw new ToeicHistoryError('INVALID_INPUT', 'Invalid TOEIC history mode');
  if (filters.status !== undefined && filters.status !== null && !['submitted', 'abandoned', 'expired'].includes(filters.status)) throw new ToeicHistoryError('INVALID_INPUT', 'Invalid TOEIC history status');
  if (filters.limit !== undefined && (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 50)) throw new ToeicHistoryError('INVALID_INPUT', 'Invalid TOEIC history limit');
  if (filters.offset !== undefined && (!Number.isInteger(filters.offset) || filters.offset < 0 || filters.offset > 100000)) throw new ToeicHistoryError('INVALID_INPUT', 'Invalid TOEIC history offset');
}

function mapRpcError(error: ToeicHistoryRpcError, fallback: 'SAVE_FAILED' | 'READ_FAILED'): ToeicHistoryError {
  const marker = `${error.code ?? ''} ${error.message ?? ''}`.toUpperCase();
  const code = KNOWN_CODES.find((candidate) => marker.includes(candidate));
  return new ToeicHistoryError(code ?? fallback, code ? `TOEIC history ${code.toLowerCase().replaceAll('_', ' ')}` : 'Unable to process TOEIC history', { cause: error });
}

export function createToeicHistoryService(client: ToeicHistoryRpcClient) {
  return {
    async listToeicAttemptHistory(filters: ToeicAttemptHistoryFilters = {}): Promise<ToeicAttemptHistoryPage> {
      validateFilters(filters);
      const { data, error } = await client.rpc('list_toeic_attempt_history', {
        p_test_id: filters.testId ?? null,
        p_mode: filters.mode ?? null,
        p_status: filters.status ?? null,
        p_limit: filters.limit ?? 20,
        p_offset: filters.offset ?? 0,
      });
      if (error) throw mapRpcError(error, 'READ_FAILED');
      return mapToeicAttemptHistoryResponse(data);
    },

    async getToeicTestProgress(testIds?: ReadonlyArray<string>): Promise<ReadonlyArray<ToeicTestProgressSummary>> {
      if (testIds && (testIds.length > 50 || testIds.some((testId) => { try { validateUuid(testId, 'test id'); return false; } catch { return true; } }))) throw new ToeicHistoryError('INVALID_INPUT', 'Invalid TOEIC progress test ids');
      const { data, error } = await client.rpc('get_toeic_test_progress', { p_test_ids: testIds ? [...testIds] : null });
      if (error) throw mapRpcError(error, 'READ_FAILED');
      return mapToeicTestProgressResponse(data);
    },

    async setToeicTestProgressVisibility(testId: string, hidden: boolean): Promise<boolean> {
      validateUuid(testId, 'test id');
      if (typeof hidden !== 'boolean') throw new ToeicHistoryError('INVALID_INPUT', 'Invalid TOEIC progress visibility');
      const { data, error } = await client.rpc('set_toeic_test_progress_visibility', { p_test_id: testId, p_hidden: hidden });
      if (error) throw mapRpcError(error, 'SAVE_FAILED');
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof (data as Record<string, unknown>).hidden !== 'boolean') throw new ToeicHistoryError('INVALID_RESPONSE', 'Invalid TOEIC progress visibility response');
      return (data as Record<string, unknown>).hidden as boolean;
    },

    async startToeicWrongQuestionAttempt(input: StartToeicWrongQuestionAttemptInput): Promise<ToeicAttemptSession> {
      validateUuid(input.sourceAttemptId, 'source attempt id');
      validateUuid(input.idempotencyKey, 'wrong retry idempotency key');
      const { data, error } = await client.rpc('start_toeic_wrong_question_attempt', {
        p_source_attempt_id: input.sourceAttemptId,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error) throw mapRpcError(error, 'SAVE_FAILED');
      return mapToeicAttemptSessionResponse(data);
    },
  };
}

async function getBrowserHistoryService() {
  const { createClient } = await import('@/lib/supabase/client');
  return createToeicHistoryService(createClient());
}

export async function listToeicAttemptHistory(filters: ToeicAttemptHistoryFilters = {}): Promise<ToeicAttemptHistoryPage> {
  return (await getBrowserHistoryService()).listToeicAttemptHistory(filters);
}

export async function getToeicTestProgress(testIds?: ReadonlyArray<string>): Promise<ReadonlyArray<ToeicTestProgressSummary>> {
  return (await getBrowserHistoryService()).getToeicTestProgress(testIds);
}

export async function setToeicTestProgressVisibility(testId: string, hidden: boolean): Promise<boolean> {
  return (await getBrowserHistoryService()).setToeicTestProgressVisibility(testId, hidden);
}

export async function startToeicWrongQuestionAttempt(input: StartToeicWrongQuestionAttemptInput): Promise<ToeicAttemptSession> {
  return (await getBrowserHistoryService()).startToeicWrongQuestionAttempt(input);
}
