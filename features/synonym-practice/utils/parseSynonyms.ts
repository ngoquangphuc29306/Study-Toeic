import { normalizeSynonym } from './normalizeSynonym';

export function parseSynonyms(value?: string | null): string[] {
  if (!value) return [];

  return Array.from(
    new Set(value.split(',').map((item) => normalizeSynonym(item)).filter(Boolean))
  );
}
