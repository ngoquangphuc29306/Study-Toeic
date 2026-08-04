export interface PronunciationEvaluation {
  normalizedExpected: string;
  normalizedTranscript: string;
  isCorrect: boolean;
}

function normalizePronunciation(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Evaluates only an actual recognition transcript. Environmental failures must
 * never call this as a fallback or be treated as a learning result.
 */
export function evaluatePronunciation(
  expected: string,
  transcript: string
): PronunciationEvaluation {
  const normalizedExpected = normalizePronunciation(expected);
  const normalizedTranscript = normalizePronunciation(transcript);

  return {
    normalizedExpected,
    normalizedTranscript,
    isCorrect:
      normalizedExpected.length > 0 &&
      normalizedTranscript.length > 0 &&
      ` ${normalizedTranscript} `.includes(` ${normalizedExpected} `),
  };
}
