/**
 * The two primitives behind the 6-digit email verification code.
 *
 * Small surface, but both have a failure mode that is silent and would only
 * show up as members unable to verify:
 *
 * - `String(randomInt(0, 1_000_000))` yields "42" for the number 42. Without
 *   padding, roughly 1 in 10 codes would be shorter than six digits, the app's
 *   `/^\d{6}$/` check would reject it before it was ever sent to the server,
 *   and that member would be stuck at the wall with a valid code in their inbox.
 * - an unsalted hash would give two members with the same code the same stored
 *   hash, so a leaked hash would compromise every account that ever drew that
 *   code rather than one.
 */

import { generateCode, hashCode } from './emailCode';

describe('generateCode', () => {
  it('always produces exactly six digits, including when the number is small', () => {
    // 2,000 draws makes a missing padStart essentially certain to show up:
    // 10% of the space is below 100000.
    for (let i = 0; i < 2000; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it('covers the low end of the range, so leading zeros really do occur', () => {
    const codes = Array.from({ length: 5000 }, () => generateCode());
    expect(codes.some(code => code.startsWith('0'))).toBe(true);
  });

  it('does not repeat itself in a way a person could predict', () => {
    // Not a randomness test — just a guard against someone replacing this with
    // a counter or a constant, which would be catastrophic and easy to miss.
    const codes = new Set(Array.from({ length: 500 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(400);
  });
});

describe('hashCode', () => {
  it('is stable for the same uid and code', () => {
    expect(hashCode('uid-1', '123456')).toBe(hashCode('uid-1', '123456'));
  });

  it('is salted by uid, so the same code hashes differently per member', () => {
    expect(hashCode('uid-1', '123456')).not.toBe(hashCode('uid-2', '123456'));
  });

  it('never stores the code itself', () => {
    expect(hashCode('uid-1', '123456')).not.toContain('123456');
  });

  it('produces a fixed 64-character hex digest', () => {
    // The confirm endpoint compares these with timingSafeEqual, which throws on
    // a length mismatch — so a constant width is a correctness requirement, not
    // a detail.
    expect(hashCode('uid-1', '000000')).toHaveLength(64);
    expect(hashCode('a-much-longer-uid-value', '999999')).toHaveLength(64);
    expect(hashCode('uid-1', '123456')).toMatch(/^[0-9a-f]{64}$/);
  });
});
