import { getRefreshMode, isBlockingRefresh } from './refreshPolicy';

describe('aggregate refresh policy', () => {
  test('keeps vocabulary and study stats on the immediate local path', () => {
    expect(getRefreshMode('vocabularies')).toBe('authoritative-local-patch');
    expect(getRefreshMode('studyStats')).toBe('authoritative-local-patch');
    expect(isBlockingRefresh('vocabularies')).toBe(true);
  });

  test('treats dashboard metrics and week activity as best effort', () => {
    expect(getRefreshMode('dashboardMetrics')).toBe('best-effort-immediate');
    expect(getRefreshMode('weekActivity')).toBe('best-effort-immediate');
    expect(isBlockingRefresh('dashboardMetrics')).toBe(false);
  });

  test('defers review log reconciliation after a rating', () => {
    expect(getRefreshMode('reviewLogs')).toBe('deferred');
  });
});
