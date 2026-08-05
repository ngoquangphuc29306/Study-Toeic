export interface ToeicDictationComparison {
  normalizedExpected: string;
  normalizedInput: string;
  isMatch: boolean;
  matchingWords: number;
  missingWords: ReadonlyArray<string>;
  extraWords: ReadonlyArray<string>;
}

export function normalizeDictation(value: string): string {
  return value.toLocaleLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function evaluateDictation(expected: string, input: string): ToeicDictationComparison {
  const normalizedExpected = normalizeDictation(expected);
  const normalizedInput = normalizeDictation(input);
  const expectedWords = normalizedExpected ? normalizedExpected.split(' ') : [];
  const inputWords = normalizedInput ? normalizedInput.split(' ') : [];
  const remaining = [...inputWords];
  let matchingWords = 0;
  const missingWords: string[] = [];
  for (const word of expectedWords) { const index = remaining.indexOf(word); if (index >= 0) { matchingWords += 1; remaining.splice(index, 1); } else missingWords.push(word); }
  return { normalizedExpected, normalizedInput, isMatch: normalizedExpected === normalizedInput, matchingWords, missingWords, extraWords: remaining };
}
