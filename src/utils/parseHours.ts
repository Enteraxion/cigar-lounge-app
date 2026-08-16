/**
 * Parses the semicolon-joined "Day: Time" hours string Google Places
 * merges in (see functions/src/index.ts's toLoungeDocument/
 * toLoungeDocumentFromGoogle — `weekdayDescriptions.join('; ')`), e.g.
 * "Monday: 8:00 AM – 10:00 PM; Tuesday: 8:00 AM – 10:00 PM; ...".
 *
 * Returns null for anything that doesn't look like real structured
 * hours (the "Hours not yet available" placeholder, or free-text seed
 * data like "Currently closed"/"Open now") — callers should fall back to
 * showing that string as plain text instead of a per-day list.
 */

export type DayHours = { day: string; time: string };

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function parseWeeklyHours(hours: string): DayHours[] | null {
  const segments = hours
    .split(';')
    .map(segment => segment.trim())
    .filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const rows: DayHours[] = [];
  for (const segment of segments) {
    const separatorIndex = segment.indexOf(':');
    if (separatorIndex === -1) {
      return null;
    }
    const day = segment.slice(0, separatorIndex).trim();
    const time = segment.slice(separatorIndex + 1).trim();
    if (!DAY_ORDER.includes(day) || !time) {
      return null;
    }
    rows.push({ day, time });
  }
  return rows;
}

/** Rotates a full week so it starts at today (e.g. Thu, Fri, Sat, ... Wed). */
export function rotateToToday(rows: DayHours[]): DayHours[] {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayIndex = rows.findIndex(row => row.day === today);
  if (todayIndex === -1) {
    return rows;
  }
  return [...rows.slice(todayIndex), ...rows.slice(0, todayIndex)];
}
