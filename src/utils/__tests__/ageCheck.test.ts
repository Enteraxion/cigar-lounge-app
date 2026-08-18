/**
 * The 21+ gate.
 *
 * Tested harder than anything else in the app because it is the one piece of
 * arithmetic whose failure mode is "a minor gets an account". The boundary
 * cases below are the ones a naive `thisYear - birthYear` gets wrong, and they
 * are not edge cases in practice — the day before a 21st birthday happens to
 * every member exactly once.
 */

import {
  ageCheckMessage,
  ageOn,
  checkMinimumAge,
  fromIsoDate,
  isRealDate,
  MINIMUM_AGE,
  toIsoDate,
} from '../ageCheck';

/** A fixed "today" so these never depend on when they run. */
const TODAY = new Date(2026, 7, 18); // 18 Aug 2026, local time

describe('ageOn', () => {
  it('counts completed years', () => {
    expect(ageOn({ year: 2000, month: 8, day: 18 }, TODAY)).toBe(26);
  });

  it('does not credit a birthday that has not happened yet', () => {
    // The whole reason this file exists.
    expect(ageOn({ year: 2005, month: 8, day: 19 }, TODAY)).toBe(20);
    expect(ageOn({ year: 2005, month: 12, day: 1 }, TODAY)).toBe(20);
  });

  it('counts the birthday itself', () => {
    expect(ageOn({ year: 2005, month: 8, day: 18 }, TODAY)).toBe(21);
  });

  it('handles a birthday earlier in the same month', () => {
    expect(ageOn({ year: 2005, month: 8, day: 17 }, TODAY)).toBe(21);
  });
});

describe('checkMinimumAge — the boundary', () => {
  it('refuses someone one day short of 21', () => {
    const check = checkMinimumAge({ year: 2005, month: 8, day: 19 }, TODAY);
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toBe('too-young');
  });

  it('admits someone exactly 21 today', () => {
    expect(checkMinimumAge({ year: 2005, month: 8, day: 18 }, TODAY).ok).toBe(true);
  });

  it('admits someone comfortably over 21', () => {
    expect(checkMinimumAge({ year: 1980, month: 1, day: 1 }, TODAY).ok).toBe(true);
  });

  it('refuses a 20-year-old whose birthday already passed this year', () => {
    // Passing the birthday is not the test — completing 21 years is.
    expect(checkMinimumAge({ year: 2006, month: 1, day: 1 }, TODAY).ok).toBe(false);
  });
});

describe('checkMinimumAge — leap years', () => {
  it('turns 21 on 1 March in a non-leap year for a 29 Feb birthday', () => {
    const leapBorn = { year: 2004, month: 2, day: 29 };
    // 2025 is not a leap year: on 28 Feb they are still 20.
    expect(checkMinimumAge(leapBorn, new Date(2025, 1, 28)).ok).toBe(false);
    expect(checkMinimumAge(leapBorn, new Date(2025, 2, 1)).ok).toBe(true);
  });

  it('turns 21 on the day itself in a leap year', () => {
    expect(checkMinimumAge({ year: 2004, month: 2, day: 29 }, new Date(2028, 1, 29)).ok).toBe(true);
  });
});

describe('checkMinimumAge — bad input', () => {
  it('asks for the missing parts rather than guessing', () => {
    const check = checkMinimumAge({ year: 2000, month: 8 }, TODAY);
    expect(check.ok === false && check.reason).toBe('incomplete');
  });

  it('rejects a date that does not exist', () => {
    expect(checkMinimumAge({ year: 2001, month: 2, day: 30 }, TODAY).ok).toBe(false);
    expect(checkMinimumAge({ year: 2001, month: 13, day: 1 }, TODAY).ok).toBe(false);
    expect(checkMinimumAge({ year: 2001, month: 4, day: 31 }, TODAY).ok).toBe(false);
  });

  it('rejects a future date distinctly from too-young', () => {
    const check = checkMinimumAge({ year: 2030, month: 1, day: 1 }, TODAY);
    expect(check.ok === false && check.reason).toBe('future');
  });

  it('accepts 29 Feb in a leap year and rejects it otherwise', () => {
    expect(isRealDate({ year: 2004, month: 2, day: 29 })).toBe(true);
    expect(isRealDate({ year: 2005, month: 2, day: 29 })).toBe(false);
  });
});

describe('ageCheckMessage', () => {
  it('says nothing when the check passed', () => {
    expect(ageCheckMessage({ ok: true, age: 30 })).toBeNull();
  });

  it('distinguishes a typo from being underage', () => {
    // Telling a 19-year-old to "check the date" wastes their time, and telling
    // someone who typed 2031 that they are too young is simply wrong.
    expect(ageCheckMessage({ ok: false, reason: 'invalid-date' })).toContain('exist');
    expect(ageCheckMessage({ ok: false, reason: 'future' })).toContain('future');
    expect(ageCheckMessage({ ok: false, reason: 'too-young', age: 19 })).toContain(
      String(MINIMUM_AGE),
    );
  });

  it('does not read the member their age back', () => {
    // It reads as an accusation and is not information they need.
    expect(ageCheckMessage({ ok: false, reason: 'too-young', age: 19 })).not.toContain('19');
  });
});

describe('iso round trip', () => {
  it('survives a round trip', () => {
    const birth = { year: 1994, month: 3, day: 7 };
    expect(fromIsoDate(toIsoDate(birth))).toEqual(birth);
  });

  it('zero-pads', () => {
    expect(toIsoDate({ year: 1994, month: 3, day: 7 })).toBe('1994-03-07');
  });

  it('returns null for anything that is not an ISO date', () => {
    for (const bad of ['', '07/03/1994', '1994-3-7', '1994-02-30', 'not a date']) {
      expect(fromIsoDate(bad)).toBeNull();
    }
  });

  it('is timezone-proof — no Date parsing of a string anywhere', () => {
    // `new Date('2005-08-18')` is UTC midnight, which is the 17th locally for
    // anyone west of Greenwich. Storing and parsing components avoids it.
    const birth = fromIsoDate('2005-08-18')!;
    expect(checkMinimumAge(birth, TODAY).ok).toBe(true);
  });
});
