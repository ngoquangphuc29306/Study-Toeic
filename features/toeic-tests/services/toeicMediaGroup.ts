import type { ToeicAttemptContentQuestion } from '../contentModel';

function canonicalMediaPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split(/[?#]/, 1)[0];
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

