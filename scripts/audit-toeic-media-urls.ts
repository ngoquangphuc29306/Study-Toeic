import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getConfiguredToeicExternalMediaHosts,
  isAllowedToeicExternalMediaUrl,
  parseToeicExternalMediaUrl,
  parseToeicMediaSource,
  redactToeicMediaUrl,
} from '../features/toeic-tests/mediaSource.ts';

type AuditStatus = 'PASS' | 'WARNING' | 'FAIL';

interface AuditResult {
  url: string;
  status: AuditStatus;
  message: string;
}

interface RawQuestion {
  audio_url?: unknown;
  image_url?: unknown;
  question_number?: unknown;
  part?: unknown;
}

const CONCURRENCY = 4;
const TIMEOUT_MS = 8_000;

function parseFileArgument(argv: string[]): string {
  const index = argv.indexOf('--file');
  const value = index >= 0 ? argv[index + 1] : 'prototype/2026-test-1-id_ad780150.json';
  if (!value || value.startsWith('--')) throw new Error('--file requires a JSON path.');
  return path.resolve(value);
}

function getContentType(headers: Headers): string {
  return headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
}

function isExpectedContentType(contentType: string, kind: 'audio' | 'image'): boolean {
  if (kind === 'audio') return contentType.startsWith('audio/');
  if (kind === 'image') return contentType.startsWith('image/');
  return contentType.startsWith('audio/') || contentType.startsWith('image/');
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, redirect: 'follow', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function auditUrl(url: string, allowedHosts: ReadonlySet<string>, kind: 'audio' | 'image'): Promise<AuditResult> {
  const parsed = parseToeicExternalMediaUrl(url);
  if (!parsed || !isAllowedToeicExternalMediaUrl(parsed, allowedHosts)) {
    return { url: redactToeicMediaUrl(url), status: 'FAIL', message: 'URL is not a valid HTTPS URL on the configured allowlist.' };
  }

  try {
    let response = await fetchWithTimeout(parsed.href, { method: 'HEAD' });
    if (!response.ok || !getContentType(response.headers)) {
      response = await fetchWithTimeout(parsed.href, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    }
    const finalUrl = new URL(response.url);
    if (!isAllowedToeicExternalMediaUrl(finalUrl, allowedHosts)) {
      return { url: redactToeicMediaUrl(url), status: 'FAIL', message: 'Redirect destination is outside the configured allowlist.' };
    }
    if (!response.ok) {
      return { url: redactToeicMediaUrl(url), status: 'FAIL', message: `HTTP ${response.status}.` };
    }
    const contentType = getContentType(response.headers);
    if (!isExpectedContentType(contentType, kind)) {
      return { url: redactToeicMediaUrl(url), status: 'WARNING', message: `Content-Type ${contentType || '(missing)'} does not match ${kind}.` };
    }
    const rangeWarning = kind === 'audio' && response.status !== 206
      ? ' Audio server did not confirm a 206 range response.'
      : '';
    return { url: redactToeicMediaUrl(url), status: rangeWarning ? 'WARNING' : 'PASS', message: `HTTP ${response.status}, ${contentType || 'unknown content type'}.${rangeWarning}` };
  } catch (error) {
    return { url: redactToeicMediaUrl(url), status: 'FAIL', message: error instanceof Error ? error.message : 'Request failed.' };
  }
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = [];
  let cursor = 0;
  async function consume(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      output.push(await worker(item));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => consume()));
  return output;
}

async function main(): Promise<void> {
  const filePath = parseFileArgument(process.argv.slice(2));
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  const questions = parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown }).questions)
    ? (parsed as { questions: RawQuestion[] }).questions
    : [];
  const allowedHosts = getConfiguredToeicExternalMediaHosts();
  const entries = new Map<string, { kind: 'audio' | 'image'; questionNumber: unknown; part: unknown }>();
  for (const question of questions) {
    for (const [field, kind] of [['audio_url', 'audio'], ['image_url', 'image']] as const) {
      if (typeof question[field] !== 'string' || !question[field].trim()) continue;
      const source = parseToeicMediaSource(question[field]);
      if (!source || source.type !== 'external_url') continue;
      entries.set(source.value, { kind, questionNumber: question.question_number, part: question.part });
    }
  }

  const duplicateCount = questions.flatMap((question) => [question.audio_url, question.image_url])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '').length - entries.size;
  console.log(`Auditing ${entries.size} unique external media URL(s); duplicate references: ${Math.max(duplicateCount, 0)}.`);
  if (allowedHosts.size === 0) console.log('WARNING: TOEIC_EXTERNAL_MEDIA_HOSTS is empty; external URLs will fail allowlist checks.');

  const results = await mapWithConcurrency([...entries.entries()], async ([url, metadata]) => {
    const result = await auditUrl(url, allowedHosts, metadata.kind);
    return { ...result, message: `Part ${metadata.part ?? '?'} question ${metadata.questionNumber ?? '?'}: ${result.message}` };
  });
  for (const result of results) console.log(`${result.status} ${result.url} — ${result.message}`);
  const counts = results.reduce<Record<AuditStatus, number>>((summary, result) => {
    summary[result.status] += 1;
    return summary;
  }, { PASS: 0, WARNING: 0, FAIL: 0 });
  console.log(`Summary: PASS ${counts.PASS}; WARNING ${counts.WARNING}; FAIL ${counts.FAIL}.`);
  if (counts.FAIL > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'TOEIC media audit failed.');
  process.exitCode = 1;
});
