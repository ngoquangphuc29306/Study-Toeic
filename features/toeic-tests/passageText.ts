const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

/**
 * Legacy imports may store a simple passage as HTML. Convert only a small,
 * presentation-safe subset to readable text rather than injecting the source
 * HTML into the test-taking UI.
 */
export function normalizeToeicPassageText(value: string): string {
  const normalizedSource = HTML_TAG_PATTERN.test(value)
    ? value
        .replace(/<\s*br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote)\s*>/gi, "\n")
        .replace(/<\s*li\b[^>]*>/gi, "• ")
        .replace(/<[^>]*>/g, "")
    : value;

  return decodeHtmlEntities(normalizedSource)
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
