import type { ToeicTestPart } from '../types';
import {
  ToeicReadError,
  type ToeicTestCatalogFilters,
  type ToeicTestCatalogItem,
  type ToeicTestPartPayload,
} from '../readContracts';
import { mapCatalogRpcResponse, mapPartRpcResponse } from '../mappers/toeicTestMapper';

export interface ToeicRpcError {
  code?: string;
  message?: string;
}

export interface ToeicRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: ToeicRpcError | null }>;
}

function mapRpcError(error: ToeicRpcError, operation: string): ToeicReadError {
  const marker = `${error.code ?? ''} ${error.message ?? ''}`.toUpperCase();
  const knownCodes = [
    'UNAUTHENTICATED',
    'INVALID_INPUT',
    'TEST_NOT_FOUND',
    'TEST_NOT_PUBLISHED',
  ] as const;
  const code = knownCodes.find((candidate) => marker.includes(candidate));

  return new ToeicReadError(
    code ?? 'READ_FAILED',
    code ? `TOEIC ${code.toLowerCase().replaceAll('_', ' ')}` : `Unable to ${operation}`,
    { cause: error }
  );
}

function validateCatalogFilters(filters: ToeicTestCatalogFilters): void {
  if (filters.year !== undefined && filters.year !== null &&
      (!Number.isInteger(filters.year) || filters.year < 2000 || filters.year > 2100)) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC catalog year');
  }
  if (filters.limit !== undefined && (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 50)) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC catalog limit');
  }
  if (filters.offset !== undefined && (!Number.isInteger(filters.offset) || filters.offset < 0 || filters.offset > 100000)) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC catalog offset');
  }
}

function validateTestId(testId: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(testId)) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC test id');
  }
}

function validatePart(part: ToeicTestPart): void {
  if (!Number.isInteger(part) || part < 1 || part > 7) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC test part');
  }
}

export function createToeicTestReadService(client: ToeicRpcClient) {
  return {
    async listPublishedToeicTests(
      filters: ToeicTestCatalogFilters = {}
    ): Promise<ReadonlyArray<ToeicTestCatalogItem>> {
      validateCatalogFilters(filters);
      const { data, error } = await client.rpc('list_published_toeic_tests', {
        p_year: filters.year ?? null,
        p_set_name: filters.setName ?? null,
        p_source: filters.source ?? null,
        p_limit: filters.limit ?? 20,
        p_offset: filters.offset ?? 0,
      });
      if (error) throw mapRpcError(error, 'load TOEIC tests');
      return mapCatalogRpcResponse(data);
    },

    async getPublishedToeicTestPart(
      testId: string,
      part: ToeicTestPart
    ): Promise<ToeicTestPartPayload> {
      validateTestId(testId);
      validatePart(part);
      const { data, error } = await client.rpc('get_published_toeic_test_part', {
        p_test_id: testId,
        p_part: part,
      });
      if (error) throw mapRpcError(error, 'load TOEIC test part');
      return mapPartRpcResponse(data);
    },
  };
}

async function getBrowserReadService() {
  const { createClient } = await import('@/lib/supabase/client');
  return createToeicTestReadService(createClient());
}

/** Uses the existing browser Supabase singleton; no client is created per request. */
export async function listPublishedToeicTests(
  filters: ToeicTestCatalogFilters = {}
): Promise<ReadonlyArray<ToeicTestCatalogItem>> {
  return (await getBrowserReadService()).listPublishedToeicTests(filters);
}

/** Loads a safe, part-scoped test-taking projection without answer data. */
export async function getPublishedToeicTestPart(
  testId: string,
  part: ToeicTestPart
): Promise<ToeicTestPartPayload> {
  return (await getBrowserReadService()).getPublishedToeicTestPart(testId, part);
}
