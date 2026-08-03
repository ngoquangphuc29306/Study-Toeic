export function normalizeSynonym(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
