import type { SynonymPracticeItem, SynonymPracticeMode } from '../types';
import { seededShuffle } from '../utils/shuffle';

export type PracticeScope = {
  mode: SynonymPracticeMode;
  collectionId: string;
  topicId: string;
};

export type SessionCoverage = {
  cycle: number;
  seenIds: string[];
  orderIds: string[];
};

type CoverageInput = Readonly<{
  cycle: number;
  seenIds: readonly string[];
  orderIds: readonly string[];
}>;

export function scopeKey(scope: PracticeScope): string {
  return JSON.stringify([scope.mode, scope.collectionId, scope.topicId]);
}

function eligibleUniqueIds(ids: readonly string[], eligible: ReadonlySet<string>): string[] {
  return [...new Set(ids)].filter(id => eligible.has(id));
}

/** Planning is repeatable and never consumes coverage, including for abandoned sessions. */
export function planSessionTargets(
  eligibleItems: readonly SynonymPracticeItem[],
  count: number,
  coverage: CoverageInput,
  scope: PracticeScope,
): { targets: SynonymPracticeItem[]; cycle: number; orderIds: string[] } {
  const itemsById = new Map<string, SynonymPracticeItem>();
  for (const item of eligibleItems) {
    if (!itemsById.has(item.vocabularyId)) itemsById.set(item.vocabularyId, item);
  }
  const eligibleIds = [...itemsById.keys()];
  const eligible = new Set(eligibleIds);
  const seen = new Set(eligibleUniqueIds(coverage.seenIds, eligible));
  const previousOrder = eligibleUniqueIds(coverage.orderIds, eligible);
  const limit = Math.max(0, Math.floor(count)) || 0;
  let cycle = coverage.cycle;
  const nextCycle = limit > 0 && eligible.size > 0 && seen.size === eligible.size;
  if (nextCycle) {
    cycle += 1;
    seen.clear();
  }

  const shuffled = seededShuffle(eligibleIds, JSON.stringify([scopeKey(scope), cycle, eligibleIds]));
  const ordered = new Set(previousOrder);
  let orderIds = nextCycle
    ? shuffled
    : [...previousOrder, ...shuffled.filter(id => !ordered.has(id))];

  // Different seeds can produce the same permutation, especially for small pools.
  if (nextCycle && orderIds.length > 1 && orderIds.every((id, index) => id === previousOrder[index])) {
    orderIds = [...orderIds.slice(1), orderIds[0]];
  }

  const targetIds = orderIds.filter(id => !seen.has(id)).slice(0, limit);
  return {
    targets: targetIds.map(id => itemsById.get(id)!),
    cycle,
    orderIds,
  };
}

/** Call only for completed NORMAL sessions; retries must leave normal coverage alone. */
export function recordCompletedTargets(
  coverage: CoverageInput,
  eligibleIds: readonly string[],
  answeredIds: readonly string[],
  cycle: number,
  orderIds: readonly string[],
): SessionCoverage {
  const eligible = new Set(eligibleIds);
  const answered = eligibleUniqueIds(answeredIds, eligible);
  if (answered.length === 0) {
    return {
      cycle: coverage.cycle,
      seenIds: eligibleUniqueIds(coverage.seenIds, eligible),
      orderIds: eligibleUniqueIds(coverage.orderIds, eligible),
    };
  }

  // Use the planned cycle, rather than pool exhaustion, to discard the prior cycle.
  // Eligibility may have changed since the new cycle was planned.
  const previousSeen = cycle > coverage.cycle ? [] : coverage.seenIds;
  return {
    cycle,
    seenIds: eligibleUniqueIds([...previousSeen, ...answered], eligible),
    orderIds: eligibleUniqueIds(orderIds, eligible),
  };
}
