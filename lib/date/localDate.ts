export interface LocalDayRange {
  start: Date;
  end: Date;
}

/** Return the browser-local calendar date as YYYY-MM-DD. */
export function getLocalDateKey(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Return a new Date at local midnight; the input is never mutated. */
export function getLocalDayStart(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Return a new Date at the final millisecond of the local calendar day. */
export function getLocalDayEnd(date: Date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getLocalDayRange(date: Date = new Date()): LocalDayRange {
  return {
    start: getLocalDayStart(date),
    end: getLocalDayEnd(date),
  };
}

/**
 * Return local calendar keys in chronological order, including the reference
 * date. setDate() deliberately handles month/year boundaries and DST.
 */
export function getRecentLocalDateKeys(
  days: number,
  referenceDate: Date = new Date()
): string[] {
  if (days <= 0) return [];

  const firstDate = new Date(referenceDate);
  firstDate.setDate(firstDate.getDate() - (days - 1));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(firstDate);
    date.setDate(firstDate.getDate() + index);
    return getLocalDateKey(date);
  });
}

/** Count consecutive studied local days ending today or yesterday. */
export function getConsecutiveLocalStreak(
  studiedDates: ReadonlySet<string>,
  referenceDate: Date = new Date()
): number {
  if (studiedDates.size === 0) return 0;

  const today = new Date(referenceDate);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let currentDate: Date;
  if (studiedDates.has(getLocalDateKey(today))) {
    currentDate = today;
  } else if (studiedDates.has(getLocalDateKey(yesterday))) {
    currentDate = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (studiedDates.has(getLocalDateKey(currentDate))) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}