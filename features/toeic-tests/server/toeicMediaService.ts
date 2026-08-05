import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildToeicMediaPath } from '../mediaPath';
import {
  ToeicReadError,
  type ToeicSignedMediaResult,
} from '../readContracts';

const TOEIC_MEDIA_BUCKET = 'toeic-test-media';
const DEFAULT_EXPIRY_SECONDS = 600;
const MIN_EXPIRY_SECONDS = 300;
const MAX_EXPIRY_SECONDS = 900;
const MAX_PATHS = 20;
const MAX_TOTAL_PATH_LENGTH = 4096;

interface ToeicMediaTestRow {
  id: string;
  status: string;
  media_folder: string;
}

interface ToeicSignedUrlRow {
  path: string;
  signedUrl: string | null;
  error: unknown;
}

export interface ToeicMediaSigningDependencies {
  getTest(testId: string): Promise<ToeicMediaTestRow | null>;
  getReferencedPaths(testId: string, mediaFolder: string): Promise<ReadonlySet<string>>;
  createSignedUrls(paths: ReadonlyArray<string>, expiresInSeconds: number): Promise<ReadonlyArray<ToeicSignedUrlRow>>;
}

export interface SignToeicMediaInput {
  userId: string;
  testId: string;
  paths: ReadonlyArray<string>;
  expiresInSeconds?: number;
}

function validateUuid(value: string, field: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ToeicReadError('INVALID_INPUT', `Invalid TOEIC ${field}`);
  }
}

function normalizeRequestedPaths(
  paths: ReadonlyArray<string>,
  mediaFolder: string
): ReadonlyArray<string> {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media path count');
  }
  if (paths.some((path) => typeof path !== 'string' || path.trim() === '')) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media path');
  }
  if (paths.some((path) => path.includes('://') || path.includes('\\') || path.includes('..'))) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media path');
  }
  if (paths.join('').length > MAX_TOTAL_PATH_LENGTH) {
    throw new ToeicReadError('INVALID_INPUT', 'TOEIC media request is too large');
  }

  const normalized = paths.map((path) => buildToeicMediaPath(mediaFolder, path));
  if (normalized.some((path): path is null => path === null)) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media path');
  }

  return [...new Set(normalized as string[])];
}

function getExpirySeconds(value: number | undefined): number {
  const seconds = value ?? DEFAULT_EXPIRY_SECONDS;
  if (!Number.isInteger(seconds) || seconds < MIN_EXPIRY_SECONDS || seconds > MAX_EXPIRY_SECONDS) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media URL expiry');
  }
  return seconds;
}

export function createToeicMediaSigningService(dependencies: ToeicMediaSigningDependencies) {
  return {
    async sign(input: SignToeicMediaInput): Promise<ReadonlyArray<ToeicSignedMediaResult>> {
      if (!input.userId.trim()) {
        throw new ToeicReadError('UNAUTHENTICATED', 'Authentication is required');
      }
      validateUuid(input.testId, 'test id');
      const test = await dependencies.getTest(input.testId);
      if (!test) throw new ToeicReadError('TEST_NOT_FOUND', 'TOEIC test was not found');
      if (test.status !== 'published') {
        throw new ToeicReadError('TEST_NOT_PUBLISHED', 'TOEIC test is not published');
      }

      const paths = normalizeRequestedPaths(input.paths, test.media_folder);
      const referencedPaths = await dependencies.getReferencedPaths(input.testId, test.media_folder);
      if (paths.some((path) => !referencedPaths.has(path))) {
        throw new ToeicReadError('MEDIA_NOT_FOUND', 'TOEIC media was not found');
      }

      const expiresInSeconds = getExpirySeconds(input.expiresInSeconds);
      const rows = await dependencies.createSignedUrls(paths, expiresInSeconds);
      if (rows.length !== paths.length || rows.some((row) => row.error || !row.signedUrl)) {
        throw new ToeicReadError('MEDIA_SIGNING_FAILED', 'Unable to sign TOEIC media URLs');
      }

      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      const rowsByPath = new Map(rows.map((row) => [row.path, row]));
      return paths.map((path) => ({
        path,
        signedUrl: rowsByPath.get(path)?.signedUrl as string,
        expiresAt,
      }));
    },
  };
}

function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new ToeicReadError('MEDIA_SIGNING_FAILED', 'TOEIC media signing is not configured');
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function createDefaultDependencies(client: SupabaseClient): ToeicMediaSigningDependencies {
  return {
    async getTest(testId) {
      const { data, error } = await client
        .from('toeic_tests')
        .select('id,status,media_folder')
        .eq('id', testId)
        .maybeSingle();
      if (error) throw new ToeicReadError('READ_FAILED', 'Unable to read TOEIC test metadata', { cause: error });
      return data as ToeicMediaTestRow | null;
    },

    async getReferencedPaths(testId, mediaFolder) {
      const [passagesResult, questionsResult] = await Promise.all([
        client.from('toeic_passages').select('audio_path,image_path').eq('test_id', testId),
        client.from('toeic_questions').select('audio_path,image_path').eq('test_id', testId),
      ]);
      if (passagesResult.error || questionsResult.error) {
        throw new ToeicReadError('READ_FAILED', 'Unable to read TOEIC media references', {
          cause: passagesResult.error ?? questionsResult.error,
        });
      }

      const referenced = new Set<string>();
      for (const row of [...(passagesResult.data ?? []), ...(questionsResult.data ?? [])]) {
        const record = row as { audio_path?: string | null; image_path?: string | null };
        for (const source of [record.audio_path, record.image_path]) {
          const path = buildToeicMediaPath(mediaFolder, source);
          if (path) referenced.add(path);
        }
      }
      return referenced;
    },

    async createSignedUrls(paths, expiresInSeconds) {
      const { data, error } = await client.storage
        .from(TOEIC_MEDIA_BUCKET)
        .createSignedUrls([...paths], expiresInSeconds);
      if (error || !data) {
        throw new ToeicReadError('MEDIA_SIGNING_FAILED', 'Unable to sign TOEIC media URLs', { cause: error });
      }
      return data.map((row) => ({
        // Supabase types allow a missing path on an individual error row. An
        // empty path is intentionally retained so the caller rejects the
        // whole batch rather than returning a mismatched signed URL.
        path: row.path ?? '',
        signedUrl: row.signedUrl,
        error: row.error,
      }));
    },
  };
}

let defaultService: ReturnType<typeof createToeicMediaSigningService> | null = null;

/** Server-only entry point. Never import this module from a Client Component. */
export async function signToeicMediaUrls(input: SignToeicMediaInput): Promise<ReadonlyArray<ToeicSignedMediaResult>> {
  if (!defaultService) {
    defaultService = createToeicMediaSigningService(createDefaultDependencies(getAdminClient()));
  }
  return defaultService.sign(input);
}
