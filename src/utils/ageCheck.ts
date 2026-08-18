/**
 * Age from a date of birth, and the 21+ gate.
 *
 * Requested by Dr. Brinkley in the 2026-08-17 demo: "the only people who
 * should be able to register are people who are 21 and up."
 *
 * Pure and heavily tested on purpose. Everything else in the verification flow
 * is a screen or a Firestore write that a person can eyeball; this is
 * arithmetic that decides whether a minor gets an account, and the classic
 * failure — treating "born 21 years ago this year" as 21 when the birthday
 * hasn't happened yet — admits someone up to 364 days early.
 */

export const MINIMUM_AGE = 21;

/**
 * A date of birth as three numbers, which is what a form collects. Kept
 * separate from `Date` because constructing a Date from user input invites
 * timezone drift: `new Date('2005-08-18')` is parsed as UTC midnight, so for
 * anyone west of Greenwich it is still the 17th locally, and a birthday check
 * lands a day early.
 */
export type BirthDate = {
  year: number;
  /** 1-12, as a human writes it — not JavaScript's 0-11. */
  month: number;
  day: number;
};

/** Whether the three numbers describe a real calendar date. */
export function isRealDate({ year, month, day }: BirthDate): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  // Day 0 of the following month is the last day of this one, which handles
  // both 30/31-day months and leap Februaries without a table.
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return day <= lastDayOfMonth;
}

/**
 * Completed years between `birth` and `on`.
 *
 * Compares month and day before decrementing, so someone whose birthday is
 * later this year is correctly still a year younger. `on` is injectable so the
 * tests can pin a date rather than depending on when they run.
 */
export function ageOn(birth: BirthDate, on: Date = new Date()): number {
  let age = on.getFullYear() - birth.year;
  const monthNow = on.getMonth() + 1;
  const dayNow = on.getDate();
  if (monthNow < birth.month || (monthNow === birth.month && dayNow < birth.day)) {
    age -= 1;
  }
  return age;
}

/** Whether a date of birth is in the future relative to `on`. */
export function isFuture(birth: BirthDate, on: Date = new Date()): boolean {
  return ageOn(birth, on) < 0;
}

export type AgeCheck =
  | { ok: true; age: number }
  | { ok: false; reason: 'incomplete' | 'invalid-date' | 'future' | 'too-young'; age?: number };

/**
 * The single decision the sign-up flow asks for.
 *
 * Returns a reason rather than a bare boolean so the screen can say something
 * specific — "please check that date" is a different problem from "you must be
 * 21 or over", and telling someone the wrong one wastes their time.
 *
 * A Feb 29 birthday turns 21 on Mar 1 in a non-leap year, which is what
 * `ageOn` produces naturally: on Feb 28 the day-of-month comparison still
 * holds them back, and on Mar 1 the month comparison has moved past February.
 */
export function checkMinimumAge(
  birth: Partial<BirthDate>,
  on: Date = new Date(),
): AgeCheck {
  const { year, month, day } = birth;
  if (year === undefined || month === undefined || day === undefined) {
    return { ok: false, reason: 'incomplete' };
  }
  const complete = { year, month, day };
  if (!isRealDate(complete)) {
    return { ok: false, reason: 'invalid-date' };
  }
  if (isFuture(complete, on)) {
    return { ok: false, reason: 'future' };
  }
  const age = ageOn(complete, on);
  if (age < MINIMUM_AGE) {
    return { ok: false, reason: 'too-young', age };
  }
  return { ok: true, age };
}

/** Member-facing wording for each refusal. */
export function ageCheckMessage(check: AgeCheck): string | null {
  if (check.ok) {
    return null;
  }
  switch (check.reason) {
    case 'incomplete':
      return 'Please enter your full date of birth.';
    case 'invalid-date':
      return "That date doesn't exist. Please check it and try again.";
    case 'future':
      return 'That date is in the future. Please check it and try again.';
    case 'too-young':
      // Deliberately does not say their age back to them — it reads as an
      // accusation, and it is not information they need.
      return `You must be ${MINIMUM_AGE} or over to join.`;
  }
}

/** ISO `YYYY-MM-DD`, for storing a birth date without timezone ambiguity. */
export function toIsoDate({ year, month, day }: BirthDate): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Parses `YYYY-MM-DD` back. Returns null on anything else. */
export function fromIsoDate(iso: string): BirthDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    return null;
  }
  const birth = { year: +match[1], month: +match[2], day: +match[3] };
  return isRealDate(birth) ? birth : null;
}
