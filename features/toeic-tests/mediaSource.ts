export type ToeicMediaKind = 'audio' | 'image';

export type ToeicMediaSource =
  | { type: 'storage_path'; value: string }
  | { type: 'external_url'; value: string };

export type ToeicMediaSourceErrorCode =
  | 'INVALID_URL'
  | 'AMBIGUOUS_MARKDOWN'
  | 'UNSUPPORTED_SCHEME'
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'LOCAL_HOST_NOT_ALLOWED'
  | 'PRIVATE_HOST_NOT_ALLOWED'
  | 'PORT_NOT_ALLOWED'
  | 'HOST_NOT_ALLOWED';

export class ToeicMediaSourceError extends Error {
  readonly code: ToeicMediaSourceErrorCode;

  constructor(code: ToeicMediaSourceErrorCode, message: string) {
    super(message);
    this.name = 'ToeicMediaSourceError';
    this.code = code;
  }
}

const MAX_EXTERNAL_MEDIA_URL_LENGTH = 2048;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export interface ToeicMediaSourceValidationOptions {
  allowLocalDevelopment?: boolean;
}

function unwrapQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1).trim();
    }
  }
  return value;
}

/**
 * Converts only the legacy exact Markdown representation `[URL](URL)` to its
 * canonical URL. It deliberately does not parse arbitrary Markdown labels or
 * guess which side of a malformed link should be used.
 */
export function normalizeToeicMediaReference(rawValue: string | null): string | null {
  if (rawValue === null || typeof rawValue !== 'string') return null;
  const value = unwrapQuotes(rawValue.trim());
  if (!value) return null;

  if (!value.startsWith('[')) return value;
  const match = value.match(/^\[([^\]\r\n]+)\]\(([\s\S]+)\)$/);
  if (!match) {
    throw new ToeicMediaSourceError('AMBIGUOUS_MARKDOWN', 'Malformed Markdown media value.');
  }

  const label = match[1];
  const destination = match[2];
  if (label !== destination) {
    throw new ToeicMediaSourceError('AMBIGUOUS_MARKDOWN', 'Markdown media label and destination must be identical.');
  }

  try {
    const url = new URL(destination);
    if (url.protocol !== 'https:') {
      throw new ToeicMediaSourceError('UNSUPPORTED_SCHEME', 'Only HTTPS Markdown media URLs are allowed.');
    }
  } catch (error) {
    if (error instanceof ToeicMediaSourceError) throw error;
    throw new ToeicMediaSourceError('INVALID_URL', 'Markdown media URL is malformed.');
  }
  return destination;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}

function isLocalOrPrivateHostname(hostname: string): 'local' | 'private' | null {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    normalized === '0.0.0.0' ||
    normalized === 'metadata.google.internal'
  ) {
    return 'local';
  }
  if (normalized.includes(':') || isPrivateIpv4(normalized)) return 'private';
  return null;
}

function parseExternalUrl(value: string, options: ToeicMediaSourceValidationOptions = {}): ToeicMediaSource | null {
  if (!/^https:\/\//i.test(value)) return null;
  if (value.length > MAX_EXTERNAL_MEDIA_URL_LENGTH) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    if (url.port && !options.allowLocalDevelopment) return null;
    const hostKind = isLocalOrPrivateHostname(url.hostname);
    if (hostKind === 'local' && !options.allowLocalDevelopment) return null;
    if (hostKind === 'private') return null;
    return { type: 'external_url', value: url.href };
  } catch {
    return null;
  }
}

/**
 * Classifies an imported value without making a network request. Invalid
 * schemes and malformed external URLs return null so callers can attach
 * field/test/question context to their own validation issue.
 */
export function parseToeicMediaSource(
  rawValue: string | null,
  options: ToeicMediaSourceValidationOptions = {},
): ToeicMediaSource | null {
  if (rawValue === null || typeof rawValue !== 'string') return null;
  const value = unwrapQuotes(rawValue.trim());
  if (!value) return null;

  if (SCHEME_PATTERN.test(value)) return parseExternalUrl(value, options);
  return { type: 'storage_path', value };
}

export function parseToeicExternalMediaUrl(rawValue: string): URL | null {
  const source = parseToeicMediaSource(rawValue);
  if (!source || source.type !== 'external_url') return null;
  return new URL(source.value);
}

export function parseToeicExternalMediaHosts(rawValue: string | null | undefined): ReadonlySet<string> {
  return new Set(
    (rawValue ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Reads only the server-side allowlist; never NEXT_PUBLIC_* configuration. */
export function getConfiguredToeicExternalMediaHosts(): ReadonlySet<string> {
  const rawValue = typeof process === 'undefined' ? '' : process.env.TOEIC_EXTERNAL_MEDIA_HOSTS;
  return parseToeicExternalMediaHosts(rawValue);
}

export function isAllowedToeicExternalMediaUrl(
  url: URL,
  allowedHosts: ReadonlySet<string>,
): boolean {
  return url.protocol === 'https:' && allowedHosts.has(url.hostname.toLowerCase());
}

export function validateToeicMediaSource(
  rawValue: string | null,
  allowedHosts?: ReadonlySet<string>,
  options: ToeicMediaSourceValidationOptions = {},
): ToeicMediaSource {
  const canonicalValue = normalizeToeicMediaReference(rawValue);
  return validateCanonicalToeicMediaSource(canonicalValue, allowedHosts, options);
}

/**
 * Validates a value that is already expected to be canonical. Runtime media
 * resolution uses this boundary so it rejects legacy Markdown instead of
 * silently repairing data that should have been normalized by the importer.
 */
export function validateCanonicalToeicMediaSource(
  rawValue: string | null,
  allowedHosts?: ReadonlySet<string>,
  options: ToeicMediaSourceValidationOptions = {},
): ToeicMediaSource {
  if (rawValue === null || typeof rawValue !== 'string') {
    throw new ToeicMediaSourceError('INVALID_URL', 'Media value is empty.');
  }
  const value = unwrapQuotes(rawValue.trim());
  if (!value) {
    throw new ToeicMediaSourceError('INVALID_URL', 'Media value is empty.');
  }
  if (value.startsWith('[')) {
    throw new ToeicMediaSourceError('AMBIGUOUS_MARKDOWN', 'Media value must be a canonical URL or storage path.');
  }

  if (SCHEME_PATTERN.test(value) && !/^https:\/\//i.test(value)) {
    throw new ToeicMediaSourceError('UNSUPPORTED_SCHEME', 'Only HTTPS external media URLs are allowed.');
  }

  const source = parseToeicMediaSource(value, options);
  if (!source) {
    throw new ToeicMediaSourceError('INVALID_URL', 'Media URL is malformed or unsafe.');
  }
  if (source.type === 'external_url') {
    const url = new URL(source.value);
    const hostKind = isLocalOrPrivateHostname(url.hostname);
    if (hostKind === 'local' && !options.allowLocalDevelopment) {
      throw new ToeicMediaSourceError('LOCAL_HOST_NOT_ALLOWED', 'Local media hosts are not allowed.');
    }
    if (hostKind === 'private') {
      throw new ToeicMediaSourceError('PRIVATE_HOST_NOT_ALLOWED', 'Private media hosts are not allowed.');
    }
    if (url.port && !options.allowLocalDevelopment) {
      throw new ToeicMediaSourceError('PORT_NOT_ALLOWED', 'External media ports are not allowed.');
    }
    if (allowedHosts && !isAllowedToeicExternalMediaUrl(url, allowedHosts)) {
      throw new ToeicMediaSourceError('HOST_NOT_ALLOWED', 'External media host is not allowlisted.');
    }
  }
  return source;
}

export function mediaSourceKey(source: ToeicMediaSource): string {
  return `${source.type}:${source.value}`;
}

export function redactToeicMediaUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search ? '?[redacted]' : ''}`;
  } catch {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }
}
