import {
  ToeicSubmissionError,
  type SubmitToeicAttemptInput,
  type ToeicAttemptResultSummary,
  type ToeicAttemptReview,
} from '../submissionContracts';
import { mapToeicAttemptResultResponse, mapToeicAttemptReviewResponse } from '../mappers/toeicSubmissionMapper';

export interface ToeicSubmissionRpcError {
  code?: string;
  message?: string;
}

export interface ToeicSubmissionRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: ToeicSubmissionRpcError | null }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_ERROR_CODES: ReadonlyArray<ToeicSubmissionError['code']> = [
  'UNAUTHENTICATED', 'INVALID_INPUT', 'ATTEMPT_NOT_FOUND', 'ATTEMPT_NOT_OWNED',
  'ATTEMPT_NOT_SUBMITTABLE', 'ATTEMPT_ALREADY_SUBMITTED', 'ATTEMPT_NOT_SUBMITTED',
  'ANSWER_KEY_INCOMPLETE', 'SUBMIT_IDEMPOTENCY_CONFLICT', 'SUBMIT_FAILED', 'READ_FAILED',
];

function validateUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new ToeicSubmissionError('INVALID_INPUT', `Invalid TOEIC ${field}`);
}

function validateSubmitInput(input: SubmitToeicAttemptInput): void {
  validateUuid(input.attemptId, 'attempt id');
  validateUuid(input.idempotencyKey, 'submit idempotency key');
}

function mapRpcError(error: ToeicSubmissionRpcError, fallback: 'SUBMIT_FAILED' | 'READ_FAILED'): ToeicSubmissionError {
  const marker = `${error.code ?? ''} ${error.message ?? ''}`.toUpperCase();
  const code = KNOWN_ERROR_CODES.find((candidate) => marker.includes(candidate));
  return new ToeicSubmissionError(code ?? fallback, code ? `TOEIC submission ${code.toLowerCase().replaceAll('_', ' ')}` : 'Unable to process TOEIC submission', { cause: error });
}

export function createToeicSubmissionService(client: ToeicSubmissionRpcClient) {
  return {
    async submitToeicAttempt(input: SubmitToeicAttemptInput): Promise<ToeicAttemptResultSummary> {
      validateSubmitInput(input);
      const { data, error } = await client.rpc('submit_toeic_attempt', { p_attempt_id: input.attemptId, p_idempotency_key: input.idempotencyKey });
      if (error) throw mapRpcError(error, 'SUBMIT_FAILED');
      return mapToeicAttemptResultResponse(data);
    },
    async getToeicAttemptResult(attemptId: string): Promise<ToeicAttemptResultSummary> {
      validateUuid(attemptId, 'attempt id');
      const { data, error } = await client.rpc('get_toeic_attempt_result', { p_attempt_id: attemptId });
      if (error) throw mapRpcError(error, 'READ_FAILED');
      return mapToeicAttemptResultResponse(data);
    },
    async getToeicAttemptReview(attemptId: string): Promise<ToeicAttemptReview> {
      validateUuid(attemptId, 'attempt id');
      const { data, error } = await client.rpc('get_toeic_attempt_review', { p_attempt_id: attemptId });
      if (error) throw mapRpcError(error, 'READ_FAILED');
      return mapToeicAttemptReviewResponse(data);
    },
  };
}

async function getBrowserSubmissionService() {
  const { createClient } = await import('@/lib/supabase/client');
  return createToeicSubmissionService(createClient());
}

export async function submitToeicAttempt(input: SubmitToeicAttemptInput): Promise<ToeicAttemptResultSummary> {
  return (await getBrowserSubmissionService()).submitToeicAttempt(input);
}

export async function getToeicAttemptResult(attemptId: string): Promise<ToeicAttemptResultSummary> {
  return (await getBrowserSubmissionService()).getToeicAttemptResult(attemptId);
}

export async function getToeicAttemptReview(attemptId: string): Promise<ToeicAttemptReview> {
  return (await getBrowserSubmissionService()).getToeicAttemptReview(attemptId);
}
