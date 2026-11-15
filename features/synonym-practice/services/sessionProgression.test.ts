import type { SynonymPracticeItem } from '../types';
import {
  planSessionTargets,
  recordCompletedTargets,
  scopeKey,
  type PracticeScope,
  type SessionCoverage,
} from './sessionProgression';

const scope: PracticeScope = { mode: 'typing', collectionId: 'collection', topicId: 'topic' };
const empty = (): SessionCoverage => ({ cycle: 0, seenIds: [], orderIds: [] });
const items: SynonymPracticeItem[] = Array.from({ length: 12 }, (_, index) => ({
  vocabularyId: String(index + 1),
  word: `word ${index + 1}`,
  meaning: 'meaning',
  synonyms: ['synonym'],
  source: { id: String(index + 1), topic_id: 'topic', word: `word ${index + 1}`, meaning: 'meaning', part_of_speech: 'noun' },
}));
const ids = (pool: readonly SynonymPracticeItem[]) => pool.map(item => item.vocabularyId);
const complete = (coverage: SessionCoverage, plan: ReturnType<typeof planSessionTargets>) =>
  recordCompletedTargets(coverage, ids(items), ids(plan.targets), plan.cycle, plan.orderIds);

describe('session coverage progression', () => {
  test('covers 12 items in disjoint sessions of 5, 5, 2 before starting a different cycle', () => {
    let coverage = empty();
    const first = planSessionTargets(items, 5, coverage, scope);
    coverage = complete(coverage, first);
    const second = planSessionTargets(items, 5, coverage, scope);
    expect(first.targets).toHaveLength(5);
    expect(second.targets).toHaveLength(5);
    expect(second.targets.map(item => item.vocabularyId).filter(id => first.targets.some(item => item.vocabularyId === id))).toEqual([]);
    coverage = complete(coverage, second);
    const third = planSessionTargets(items, 5, coverage, scope);
    expect(third.targets).toHaveLength(2);
    expect(new Set([...ids(first.targets), ...ids(second.targets), ...ids(third.targets)]).size).toBe(12);
    expect(third.orderIds).toEqual(first.orderIds);
    coverage = complete(coverage, third);
    const fourth = planSessionTargets(items, 5, coverage, scope);
    expect(fourth.cycle).toBe(1);
    expect(fourth.targets).toHaveLength(5);
    expect(fourth.orderIds).not.toEqual(first.orderIds);
    coverage = complete(coverage, fourth);
    expect(coverage.seenIds).toEqual(ids(fourth.targets));
    const fifth = planSessionTargets(items, 5, coverage, scope);
    expect(fifth.cycle).toBe(1);
    expect(ids(fifth.targets).filter(id => coverage.seenIds.includes(id))).toEqual([]);
  });

  test('caps a session at the unique pool size', () => {
    const plan = planSessionTargets([...items, items[0]], 20, empty(), scope);
    expect(plan.targets).toHaveLength(12);
    expect(new Set(ids(plan.targets)).size).toBe(12);
    expect(plan.orderIds).toHaveLength(12);
  });

  test('aborted plans and retry planning leave normal coverage untouched', () => {
    const coverage = empty();
    const first = planSessionTargets(items, 5, coverage, scope);
    planSessionTargets(first.targets.slice(0, 2), 2, coverage, scope);
    expect(coverage).toEqual(empty());
    expect(planSessionTargets(items, 5, coverage, scope)).toEqual(first);
  });

  test('records only eligible answered IDs, deduplicated, and preserves the full planned order', () => {
    const coverage: SessionCoverage = { cycle: 0, seenIds: ['1', 'removed'], orderIds: ['removed', '1', '2'] };
    expect(recordCompletedTargets(coverage, ['1', '2', '3'], ['2', '2', 'foreign'], 0, ['1', '2', '2', 'removed', '3']))
      .toEqual({ cycle: 0, seenIds: ['1', '2'], orderIds: ['1', '2', '3'] });
  });

  test('discards removed IDs while keeping surviving queue order', () => {
    const coverage: SessionCoverage = { cycle: 0, seenIds: ['1', 'removed'], orderIds: ['removed', '3', '1', '2'] };
    const plan = planSessionTargets(items.slice(0, 3), 5, coverage, scope);
    expect(ids(plan.targets)).toEqual(['3', '2']);
    expect(plan.orderIds).toEqual(['3', '1', '2']);
    expect(recordCompletedTargets(coverage, ['1', '2', '3'], ids(plan.targets), plan.cycle, plan.orderIds).seenIds)
      .toEqual(['1', '3', '2']);
  });

  test('adds new IDs to the remaining queue without replaying seen IDs or restarting the cycle', () => {
    const coverage: SessionCoverage = { cycle: 3, seenIds: ['1'], orderIds: ['1', '2'] };
    const plan = planSessionTargets(items.slice(0, 3), 5, coverage, scope);
    expect(ids(plan.targets)).toEqual(['2', '3']);
    expect(plan.orderIds).toEqual(['1', '2', '3']);
    expect(plan.cycle).toBe(3);
  });

  test('treats a newly eligible ID as unseen even when the old pool was exhausted', () => {
    const coverage: SessionCoverage = { cycle: 2, seenIds: ['1', '2'], orderIds: ['2', '1'] };
    const plan = planSessionTargets(items.slice(0, 3), 5, coverage, scope);
    expect(ids(plan.targets)).toEqual(['3']);
    expect(plan.cycle).toBe(2);
  });

  test('clears old-cycle seen IDs even when eligibility changes between planning and completion', () => {
    const coverage: SessionCoverage = { cycle: 4, seenIds: ['1', '2'], orderIds: ['1', '2'] };
    const result = recordCompletedTargets(coverage, ['1', '2', '3'], ['2'], 5, ['2', '1']);
    expect(result).toEqual({ cycle: 5, seenIds: ['2'], orderIds: ['2', '1'] });
    expect(ids(planSessionTargets(items.slice(0, 3), 5, result, scope).targets)).toEqual(['1', '3']);
  });

  test.each([0, -1, NaN])('count %s does not advance an exhausted cycle', count => {
    const coverage: SessionCoverage = { cycle: 2, seenIds: ['1', '2'], orderIds: ['1', '2'] };
    const plan = planSessionTargets(items.slice(0, 2), count, coverage, scope);
    expect(plan).toEqual({ targets: [], cycle: 2, orderIds: ['1', '2'] });
  });

  test('empty eligibility does not advance the cycle and prunes obsolete order and seen IDs', () => {
    const coverage: SessionCoverage = { cycle: 2, seenIds: ['1'], orderIds: ['1'] };
    expect(planSessionTargets([], 5, coverage, scope)).toEqual({ targets: [], cycle: 2, orderIds: [] });
    expect(recordCompletedTargets(coverage, [], ['1'], 3, ['1']))
      .toEqual({ cycle: 2, seenIds: [], orderIds: [] });
  });

  test('empty or wholly ineligible answers do not commit a new cycle', () => {
    const coverage: SessionCoverage = { cycle: 2, seenIds: ['1'], orderIds: ['1'] };
    for (const answers of [[], ['removed']]) {
      expect(recordCompletedTargets(coverage, ['1'], answers, 3, ['1'])).toEqual(coverage);
    }
  });

  test('successive two-item cycles always change order, including seed collisions', () => {
    let coverage = empty();
    let previousOrder: string[] = [];
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const plan = planSessionTargets(items.slice(0, 2), 5, coverage, scope);
      expect(plan.cycle).toBe(cycle);
      expect(plan.orderIds).not.toEqual(previousOrder);
      previousOrder = plan.orderIds;
      coverage = recordCompletedTargets(coverage, ['1', '2'], ids(plan.targets), plan.cycle, plan.orderIds);
    }
  });

  test('a singleton can repeat only in the next cycle', () => {
    const first = planSessionTargets(items.slice(0, 1), 5, empty(), scope);
    const coverage = recordCompletedTargets(empty(), ['1'], ['1'], first.cycle, first.orderIds);
    expect(planSessionTargets(items.slice(0, 1), 5, coverage, scope))
      .toEqual({ targets: [items[0]], cycle: 1, orderIds: ['1'] });
  });

  test('accepts frozen inputs and returns deterministic plans without mutation', () => {
    const pool = Object.freeze(items.map(item => Object.freeze({ ...item })));
    const coverage = Object.freeze({ cycle: 0, seenIds: Object.freeze(['1']), orderIds: Object.freeze(['1', '2']) });
    const eligibleIds = Object.freeze(ids(pool));
    const answers = Object.freeze(['2']);
    const plan = planSessionTargets(pool, 5, coverage, Object.freeze(scope));
    expect(planSessionTargets(pool, 5, coverage, scope)).toEqual(plan);
    const result = recordCompletedTargets(coverage, eligibleIds, answers, plan.cycle, Object.freeze(plan.orderIds));
    result.seenIds.push('local-only');
    expect(coverage.seenIds).toEqual(['1']);
    expect(coverage.orderIds).toEqual(['1', '2']);
    expect(answers).toEqual(['2']);
    expect(pool).toHaveLength(12);
  });

  test.each([
    { ...scope, mode: 'matching' as const },
    { ...scope, collectionId: 'other' },
    { ...scope, topicId: 'other' },
  ])('separates progress for scope %j', otherScope => {
    const coverages: Record<string, SessionCoverage> = {};
    const first = planSessionTargets(items, 5, empty(), scope);
    coverages[scopeKey(scope)] = complete(empty(), first);
    expect(scopeKey(otherScope)).not.toBe(scopeKey(scope));
    const other = planSessionTargets(items, 20, coverages[scopeKey(otherScope)] ?? empty(), otherScope);
    expect(other.targets).toHaveLength(12);
    expect(other.cycle).toBe(0);
    expect(planSessionTargets(items, 20, coverages[scopeKey(scope)], scope).targets).toHaveLength(7);
  });

  test('scope keys cannot collide when IDs contain separators', () => {
    expect(scopeKey({ ...scope, collectionId: 'a:b', topicId: 'c' }))
      .not.toBe(scopeKey({ ...scope, collectionId: 'a', topicId: 'b:c' }));
    expect(scopeKey({ ...scope })).toBe(scopeKey(scope));
  });
});
