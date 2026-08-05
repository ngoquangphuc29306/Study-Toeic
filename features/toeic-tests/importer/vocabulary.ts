import type { JsonObject, JsonValue } from './types.ts';

export interface ParsedVocabularyItem {
  [key: string]: JsonValue;
  word: string;
  partOfSpeech: string | null;
  meaningVi: string;
}

export interface ParsedVocabularyContent {
  items: ParsedVocabularyItem[];
  raw: string;
  unparsedLineCount: number;
}

const VOCABULARY_LINE_PATTERN = /^(.+?)\s*\(([^)]+)\)\s*:\s*(.+)$/;

export function parseVocabularyContent(value: string | null | undefined): ParsedVocabularyContent | null {
  const raw = value?.trim() ?? '';
  if (!raw) return null;

  const items: ParsedVocabularyItem[] = [];
  let unparsedLineCount = 0;

  for (const block of raw.split(/\r?\n\s*\r?\n+/)) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const match = lines[0].match(VOCABULARY_LINE_PATTERN);
    if (!match) {
      unparsedLineCount += lines.length;
      continue;
    }

    const word = match[1].trim();
    const partOfSpeech = match[2].trim();
    const meaningVi = [match[3].trim(), ...lines.slice(1)].filter(Boolean).join('\n');
    if (!word || !meaningVi) {
      unparsedLineCount += lines.length;
      continue;
    }

    items.push({
      word,
      partOfSpeech: partOfSpeech || null,
      meaningVi,
    });
  }

  return { items, raw, unparsedLineCount };
}

export function toVocabularyContent(value: string | null | undefined): JsonObject | null {
  const parsed = parseVocabularyContent(value);
  if (!parsed) return null;

  return {
    items: parsed.items,
    raw: parsed.raw,
  };
}
