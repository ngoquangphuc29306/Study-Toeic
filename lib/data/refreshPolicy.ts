export type RefreshTarget =
  | 'vocabularies'
  | 'studyStats'
  | 'dashboardMetrics'
  | 'weekActivity'
  | 'reviewLogs';

export type RefreshMode = 'authoritative-local-patch' | 'best-effort-immediate' | 'deferred';

const REFRESH_POLICY: Record<RefreshTarget, RefreshMode> = {
  vocabularies: 'authoritative-local-patch',
  studyStats: 'authoritative-local-patch',
  dashboardMetrics: 'best-effort-immediate',
  weekActivity: 'best-effort-immediate',
  reviewLogs: 'deferred',
};

export function getRefreshMode(target: RefreshTarget): RefreshMode {
  return REFRESH_POLICY[target];
}

export function isBlockingRefresh(target: RefreshTarget): boolean {
  return getRefreshMode(target) === 'authoritative-local-patch';
}
