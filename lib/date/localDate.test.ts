import {
  getConsecutiveLocalStreak,
  getLocalDateKey,
  getLocalDayRange,
  getRecentLocalDateKeys,
} from './localDate';

describe('local date utilities', () => {
  test('maps a Vietnam local 00:30 event to the correct calendar date', () => {
    // The product timezone strategy is the browser local timezone. Run this
    // case with TZ=Asia/Ho_Chi_Minh to verify the UTC+7 boundary explicitly.
    const date = new Date('2026-08-03T17:30:00.000Z');

    expect(getLocalDateKey(date)).toBe('2026-08-04');
  });

  test('keeps the final local millisecond on the same calendar date', () => {
    const date = new Date(2026, 7, 4, 23, 59, 59, 999);

    expect(getLocalDateKey(date)).toBe('2026-08-04');
  });

  test('returns local day boundaries without mutating the input', () => {
    const input = new Date(2026, 7, 4, 12, 0, 0, 0);
    const originalTime = input.getTime();
    const { start, end } = getLocalDayRange(input);

    expect(input.getTime()).toBe(originalTime);
    expect(getLocalDateKey(start)).toBe('2026-08-04');
    expect(getLocalDateKey(end)).toBe('2026-08-04');
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });

  test('maps a UTC review event to its browser-local calendar date', () => {
    const date = new Date('2026-08-04T16:59:59.999Z');

    expect(getLocalDateKey(date)).toBe('2026-08-04');
  });

  test('iterates calendar days across month and year boundaries', () => {
    expect(getRecentLocalDateKeys(4, new Date(2026, 0, 1, 12))).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
    ]);
    expect(getRecentLocalDateKeys(3, new Date(2026, 2, 1, 12))).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  test('iterates Sunday to Monday by calendar date', () => {
    expect(getRecentLocalDateKeys(2, new Date(2026, 7, 3, 12))).toEqual([
      '2026-08-02',
      '2026-08-03',
    ]);
  });

  test('deduplicates same-day activity and stops streaks at gaps', () => {
    const referenceDate = new Date(2026, 7, 4, 12);

    expect(
      getConsecutiveLocalStreak(
        new Set(['2026-08-02', '2026-08-03', '2026-08-04']),
        referenceDate
      )
    ).toBe(3);
    expect(
      getConsecutiveLocalStreak(
        new Set(['2026-08-02', '2026-08-04']),
        referenceDate
      )
    ).toBe(1);
    expect(
      getConsecutiveLocalStreak(new Set(['2026-08-02']), referenceDate)
    ).toBe(0);
  });
});
