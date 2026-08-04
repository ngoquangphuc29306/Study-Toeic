/** Pure deterministic shuffle. The input array is never mutated. */
export function seededShuffle<T>(array: T[], seed: string): T[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const result = [...array];
  for (let index = result.length - 1; index > 0; index -= 1) {
    hash = (hash * 9301 + 49297) % 233280;
    const swapIndex = Math.abs(hash) % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
