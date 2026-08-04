export function uniqueQuizLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const normalized = label.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
