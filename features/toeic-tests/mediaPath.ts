import {
  validateToeicMediaSource,
  type ToeicMediaSource,
} from "./mediaSource.ts";

/**
 * Pure helpers for resolving TOEIC media paths.
 *
 * The database should store a bucket-relative path (for example
 * `2026/t1/32-34.mp3`), not a project-specific Supabase URL. These helpers
 * accept legacy URLs as an input migration boundary without creating a client
 * or making a network request.
 */

const STORAGE_OBJECT_PATH_PATTERN = /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/i;

function stripQueryAndHash(value: string): string {
  return value.split(/[?#]/, 1)[0];
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePath(value: string): string {
  return stripQueryAndHash(value.trim())
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/');
}

function hasParentTraversal(value: string): boolean {
  return normalizePath(value).split('/').some((segment) => segment === '..');
}

function extractSupabaseObjectPath(value: string): string | null {
  try {
    const pathname = new URL(value).pathname;
    const match = pathname.match(STORAGE_OBJECT_PATH_PATTERN);
    return match ? normalizePath(decodePathPart(match[2])) : null;
  } catch {
    return null;
  }
}

function extractRelativeSource(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const supabaseObjectPath = extractSupabaseObjectPath(trimmed);
  if (supabaseObjectPath) return supabaseObjectPath;

  try {
    const parsed = new URL(trimmed);
    return normalizePath(decodePathPart(parsed.pathname));
  } catch {
    return normalizePath(decodePathPart(trimmed));
  }
}

function extractStorageSource(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const supabaseObjectPath = extractSupabaseObjectPath(trimmed);
  if (supabaseObjectPath) return supabaseObjectPath;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return normalizePath(decodePathPart(trimmed));
}

/** Returns only the filename from a URL or relative media path. */
export function extractStorageFilename(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const path = extractRelativeSource(value);
  if (!path || hasParentTraversal(path)) return null;

  const filename = path.split('/').at(-1);
  return filename || null;
}

/** Joins path segments without creating duplicate slashes. */
export function joinStoragePath(...segments: Array<string | null | undefined>): string {
  return segments
    .filter((segment): segment is string => Boolean(segment?.trim()))
    .map(normalizePath)
    .filter(Boolean)
    .join('/');
}

/**
 * Builds a bucket-relative path under a test's media folder.
 * Existing paths that already include the folder are not prefixed twice.
 */
export function buildToeicMediaPath(
  mediaFolder: string | null | undefined,
  source: string | null | undefined
): string | null {
  if (!source?.trim()) return null;

  const folder = mediaFolder ? normalizePath(mediaFolder) : '';
  const relativeSource = extractStorageSource(source);
  if (!relativeSource || hasParentTraversal(relativeSource)) return null;

  if (!folder) return relativeSource;
  if (relativeSource === folder || relativeSource.startsWith(`${folder}/`)) {
    return relativeSource;
  }

  return joinStoragePath(folder, relativeSource) || null;
}

/**
 * Normalizes an imported media value while preserving an approved external
 * URL exactly as a URL. Legacy storage paths and Supabase object URLs keep
 * the existing bucket-relative normalization behavior.
 */
export function normalizeToeicMediaSource(
  mediaFolder: string | null | undefined,
  source: string | null | undefined,
  allowedExternalHosts?: ReadonlySet<string>,
): ToeicMediaSource | null {
  if (!source?.trim()) return null;

  const parsed = validateToeicMediaSource(source, allowedExternalHosts);
  if (parsed.type === 'external_url') return parsed;

  const path = buildToeicMediaPath(mediaFolder, parsed.value);
  return path ? { type: 'storage_path', value: path } : null;
}

function encodeStoragePath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(decodePathPart(segment))).join('/');
}

/**
 * Resolves a public object URL from configured Supabase settings.
 * This function is intentionally pure and never creates a Supabase client.
 */
export function resolveToeicPublicMediaUrl(options: {
  supabaseUrl: string | null | undefined;
  bucket: string | null | undefined;
  mediaFolder: string | null | undefined;
  source: string | null | undefined;
}): string | null {
  const supabaseUrl = options.supabaseUrl?.trim().replace(/\/+$/, '');
  const bucket = options.bucket?.trim().replace(/^\/+|\/+$/g, '');
  const path = buildToeicMediaPath(options.mediaFolder, options.source);

  if (!supabaseUrl || !bucket || !path) return null;
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`;
}
