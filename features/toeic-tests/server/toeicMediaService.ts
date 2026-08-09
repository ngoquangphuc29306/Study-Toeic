import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildToeicMediaPath } from '../mediaPath';
import {
  getConfiguredToeicExternalMediaHosts,
  mediaSourceKey,
  validateCanonicalToeicMediaSource,
  ToeicMediaSourceError,
  type ToeicMediaSource,
} from '../mediaSource';
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
  mediaFolder: string,
  allowedExternalMediaHosts: ReadonlySet<string>,
): ReadonlyArray<{ source: ToeicMediaSource; referenceKey: string }> {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media path count');
  }
  if (paths.some((path) => typeof path !== 'string' || path.trim() === '')) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media path');
  }
  if (paths.join('').length > MAX_TOTAL_PATH_LENGTH) {
    throw new ToeicReadError('INVALID_INPUT', 'TOEIC media request is too large');
  }

  const normalized = paths.map((path) => {
    try {
      const source = validateCanonicalToeicMediaSource(path, allowedExternalMediaHosts);
      if (source.type === 'external_url') return { source, referenceKey: mediaSourceKey(source) };
      const storagePath = buildToeicMediaPath(mediaFolder, source.value);
      if (!storagePath) throw new ToeicMediaSourceError('INVALID_URL', 'Invalid TOEIC media path');
      const storageSource: ToeicMediaSource = { type: 'storage_path', value: storagePath };
      return { source: storageSource, referenceKey: storageSource.value };
    } catch (error) {
      if (error instanceof ToeicMediaSourceError && error.code === 'HOST_NOT_ALLOWED') {
        throw new ToeicReadError('MEDIA_HOST_NOT_ALLOWED', 'TOEIC external media host is not allowlisted');
      }
      throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media source');
    }
  });

  const unique = new Map(normalized.map((item) => [item.referenceKey, item]));
  return [...unique.values()];
}

function getExpirySeconds(value: number | undefined): number {
  const seconds = value ?? DEFAULT_EXPIRY_SECONDS;
  if (!Number.isInteger(seconds) || seconds < MIN_EXPIRY_SECONDS || seconds > MAX_EXPIRY_SECONDS) {
    throw new ToeicReadError('INVALID_INPUT', 'Invalid TOEIC media URL expiry');
  }
  return seconds;
}

export function createToeicMediaSigningService(
  dependencies: ToeicMediaSigningDependencies,
  options: { allowedExternalMediaHosts?: ReadonlySet<string>; now?: () => number } = {},
) {
  const allowedExternalMediaHosts = options.allowedExternalMediaHosts ?? new Set<string>();
  const now = options.now ?? Date.now;
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

      const requested = normalizeRequestedPaths(input.paths, test.media_folder, allowedExternalMediaHosts);
      const referencedPaths = await dependencies.getReferencedPaths(input.testId, test.media_folder);
      if (requested.some((item) => !referencedPaths.has(item.referenceKey))) {
        throw new ToeicReadError('MEDIA_NOT_FOUND', 'TOEIC media was not found');
      }

      const storagePaths = requested
        .map((item) => item.source)
        .filter((source): source is { type: 'storage_path'; value: string } => source.type === 'storage_path')
        .map((source) => source.value);
      const expiresInSeconds = storagePaths.length > 0 ? getExpirySeconds(input.expiresInSeconds) : DEFAULT_EXPIRY_SECONDS;
      const rows = storagePaths.length > 0
        ? await dependencies.createSignedUrls(storagePaths, expiresInSeconds)
        : [];
      if (rows.length !== storagePaths.length || rows.some((row) => row.error || !row.signedUrl)) {
        throw new ToeicReadError('MEDIA_SIGNING_FAILED', 'Unable to sign TOEIC media URLs');
      }

      const rowsByPath = new Map(rows.map((row) => [row.path, row]));
      return requested.map(({ source }) => {
        if (source.type === 'external_url') {
          return {
            path: source.value,
            signedUrl: source.value,
            expiresAt: new Date(now() + DEFAULT_EXPIRY_SECONDS * 1000).toISOString(),
            sourceType: 'external_url' as const,
          };
        }
        return {
          path: source.value,
          signedUrl: rowsByPath.get(source.value)?.signedUrl as string,
          expiresAt: new Date(now() + expiresInSeconds * 1000).toISOString(),
          sourceType: 'storage_path' as const,
        };
      });
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
          if (!source?.trim()) continue;
          try {
            const parsed = validateCanonicalToeicMediaSource(source);
            if (parsed.type === 'external_url') referenced.add(mediaSourceKey(parsed));
            else {
              const path = buildToeicMediaPath(mediaFolder, parsed.value);
              if (path) referenced.add(path);
            }
          } catch {
            // Invalid or disallowed stored references are never playable.
          }
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
    defaultService = createToeicMediaSigningService(
      createDefaultDependencies(getAdminClient()),
      { allowedExternalMediaHosts: getConfiguredToeicExternalMediaHosts() },
    );
  }
  return defaultService.sign(input);
}
