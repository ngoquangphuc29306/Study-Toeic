import type { ToeicAttemptContentQuestion } from '../contentModel';
import { parseToeicMediaSource } from '../mediaSource';

function canonicalMediaPath(path: string): string {
  const source = parseToeicMediaSource(path);
  if (source?.type === 'external_url') {
    const url = new URL(source.value);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  }
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split(/[?#]/, 1)[0];
}

export function canonicalToeicMediaIdentity(path: string): string {
  return canonicalMediaPath(path);
}

export function getToeicMediaGroupKey(
  item: ToeicAttemptContentQuestion,
): string {
  const passageId = item.passage?.id ?? item.question.passageId;
  if (passageId) return `passage:${passageId}`;

  const audioPath = item.passage?.audioPath ?? item.question.audioPath;
  if (audioPath?.trim()) return `audio:${canonicalMediaPath(audioPath)}`;

  return `question:${item.question.id}`;
}
