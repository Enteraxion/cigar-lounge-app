/**
 * Validation helpers.
 *
 * The property under test throughout is the *status code*, not just the
 * rejection: before this pass, malformed input either sailed through into an
 * outbound request or came back as `internal`. A caller cannot fix a 500;
 * they can fix an `invalid-argument` that names the field.
 */

import { optionalString, requireEmail, requireString } from './validation';

/** Extracts the HttpsError code without depending on the class at runtime. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code ?? 'no-code';
  }
  return 'did-not-throw';
}

describe('requireString', () => {
  it('trims and returns a valid value', () => {
    expect(requireString('  Austin, TX  ', 'city')).toBe('Austin, TX');
  });

  it('rejects empty, whitespace-only, null and undefined as invalid-argument', () => {
    for (const bad of ['', '   ', null, undefined]) {
      expect(codeOf(() => requireString(bad, 'city'))).toBe('invalid-argument');
    }
  });

  it('rejects a value over the length cap rather than forwarding it', () => {
    expect(codeOf(() => requireString('x'.repeat(201), 'city'))).toBe('invalid-argument');
    expect(requireString('x'.repeat(200), 'city')).toHaveLength(200);
  });

  it('names the offending field in the message', () => {
    try {
      requireString('', 'guestName');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('guestName');
    }
  });

  it('coerces non-strings rather than crashing on them', () => {
    expect(requireString(42, 'n')).toBe('42');
    expect(codeOf(() => requireString({}, 'o'))).toBe('did-not-throw');
  });
});

describe('optionalString', () => {
  it('allows absence', () => {
    expect(optionalString(undefined, 'notes')).toBe('');
    expect(optionalString('', 'notes')).toBe('');
  });

  it('still enforces the length cap when a value is supplied', () => {
    expect(codeOf(() => optionalString('x'.repeat(501), 'notes', 500))).toBe('invalid-argument');
  });
});

describe('requireEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const good of ['a@b.co', 'first.last+tag@sub.domain.com', 'UPPER@Example.COM']) {
      expect(requireEmail(good, 'email')).toBe(good.trim());
    }
  });

  it('rejects obvious junk as invalid-argument, not internal', () => {
    for (const bad of ['not-an-email', 'missing@tld', '@nolocal.com', 'spaces in@email.com', 'a@b.c']) {
      expect(codeOf(() => requireEmail(bad, 'email'))).toBe('invalid-argument');
    }
  });

  it('rejects a missing address', () => {
    expect(codeOf(() => requireEmail(undefined, 'ownerContactEmail'))).toBe('invalid-argument');
  });
});
