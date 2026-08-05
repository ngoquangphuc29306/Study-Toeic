import {
  ToeicLearningError,
  type ToeicAttemptReviewLearningContent,
  type ToeicPracticeAnswerInput,
  type ToeicPracticeFeedback,
} from '../learningContracts';
import {
  mapToeicAttemptReviewLearningResponse,
  mapToeicPracticeFeedbackResponse,
} from '../mappers/toeicLearningMapper';

export interface ToeicLearningRpcError { code?: string; message?: string; }
export interface ToeicLearningRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: ToeicLearningRpcError | null }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_ERROR_CODES: ReadonlyArray<ToeicLearningError['code']> = [
  'UNAUTHENTICATED', 'INVALID_INPUT', 'ATTEMPT_NOT_FOUND', 'ATTEMPT_NOT_OWNED',
  'PRACTICE_ONLY', 'ATTEMPT_NOT_ACTIVE', 'ANSWER_NOT_SAVED', 'ATTEMPT_NOT_SUBMITTED',
  'ANSWER_KEY_INCOMPLETE', 'READ_FAILED',
];

function validateUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new ToeicLearningError('INVALID_INPUT', `Invalid TOEIC ${field}`);
}

function validatePracticeInput(input: ToeicPracticeAnswerInput): void {
  validateUuid(input.attemptId, 'attempt id');
  validateUuid(input.questionId, 'question id');
}

function mapRpcError(error: ToeicLearningRpcError): ToeicLearningError {
  const marker = `${error.code ?? ''} ${error.message ?? ''}`.toUpperCase();
  const code = KNOWN_ERROR_CODES.find((candidate) => marker.includes(candidate));
  return new ToeicLearningError(code ?? 'READ_FAILED', code ? `TOEIC learning ${code.toLowerCase().replaceAll('_', ' ')}` : 'Unable to load TOEIC learning content', { cause: error });
}

export function createToeicLearningService(client: ToeicLearningRpcClient) {
  return {
    async checkToeicPracticeAnswer(input: ToeicPracticeAnswerInput): Promise<ToeicPracticeFeedback> {
      validatePracticeInput(input);
      const { data, error } = await client.rpc('check_toeic_practice_answer', {
        p_attempt_id: input.attemptId,
        p_question_id: input.questionId,
      });
      if (error) throw mapRpcError(error);
      return mapToeicPracticeFeedbackResponse(data);
    },

    async getToeicAttemptReviewContent(attemptId: string): Promise<ToeicAttemptReviewLearningContent> {
      validateUuid(attemptId, 'attempt id');
      const { data, error } = await client.rpc('get_toeic_attempt_review_content', { p_attempt_id: attemptId });
      if (error) throw mapRpcError(error);
      return mapToeicAttemptReviewLearningResponse(data);
    },
  };
}

async function getBrowserLearningService() {
  const { createClient } = await import('@/lib/supabase/client');
  return createToeicLearningService(createClient());
}

export async function checkToeicPracticeAnswer(input: ToeicPracticeAnswerInput): Promise<ToeicPracticeFeedback> {
  return (await getBrowserLearningService()).checkToeicPracticeAnswer(input);
}

export async function getToeicAttemptReviewContent(attemptId: string): Promise<ToeicAttemptReviewLearningContent> {
  return (await getBrowserLearningService()).getToeicAttemptReviewContent(attemptId);
}
