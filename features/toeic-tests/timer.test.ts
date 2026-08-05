import { describe, expect, it } from 'vitest';
import { getRemainingToeicSeconds, getServerClockOffsetMs } from './timer';

describe('TOEIC server-clock timer', () => {
  it('uses server offset and never goes negative', () => {
    const clientNow = Date.parse('2026-08-05T00:00:00.000Z');
    const offset = getServerClockOffsetMs('2026-08-05T00:00:05.000Z', clientNow);
    expect(getRemainingToeicSeconds({ deadlineAt: '2026-08-05T00:01:00.000Z' }, clientNow, offset)).toBe(55);
    expect(getRemainingToeicSeconds({ deadlineAt: '2026-08-04T23:59:00.000Z' }, clientNow, offset)).toBe(0);
  });

  it('returns null for practice attempts', () => {
    expect(getRemainingToeicSeconds({ deadlineAt: null })).toBeNull();
  });
});
