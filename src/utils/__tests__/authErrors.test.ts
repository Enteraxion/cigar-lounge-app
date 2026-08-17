/**
 * Login error messages.
 *
 * Found by actually signing in wrong on the simulator: the app answered a
 * plainly incorrect password with "Something went wrong. Please try again."
 * Firebase returns `auth/invalid-login-credentials` for that case when email
 * enumeration protection is enabled — which it is by default on this project
 * — and only the older `auth/wrong-password` / `auth/user-not-found` codes
 * were mapped. So the most common failure on the app's first screen produced
 * the message reserved for failures we don't understand.
 */

import { getAuthErrorMessage } from '../authErrors';

const err = (code: string) => ({ code });

describe('getAuthErrorMessage', () => {
  it('tells the member their credentials were wrong, on the modern code', () => {
    // The regression. This is the code this project actually receives.
    expect(getAuthErrorMessage(err('auth/invalid-login-credentials'))).toBe(
      'Incorrect email or password.',
    );
  });

  it('gives the same answer for every credential-failure code', () => {
    // Enumeration protection deliberately hides which half was wrong, and
    // older projects still emit the split codes — so all four must agree, or
    // the message would leak whether an account exists.
    const messages = [
      'auth/invalid-login-credentials',
      'auth/invalid-credential',
      'auth/wrong-password',
      'auth/user-not-found',
    ].map(code => getAuthErrorMessage(err(code)));
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toBe('Incorrect email or password.');
  });

  it('never says "user not found" or otherwise reveals the account exists', () => {
    for (const code of ['auth/user-not-found', 'auth/wrong-password']) {
      const message = getAuthErrorMessage(err(code)).toLowerCase();
      expect(message).not.toContain('not found');
      expect(message).not.toContain('no account');
      expect(message).not.toContain('does not exist');
    }
  });

  it('explains an unconfigured sign-in method instead of a generic failure', () => {
    // What the Apple and Google buttons raise today — neither provider is set
    // up. A generic message invites retrying a button that cannot ever work.
    expect(getAuthErrorMessage(err('auth/operation-not-allowed'))).toContain(
      'isn’t available yet',
    );
  });

  it('maps the remaining real codes to something actionable', () => {
    expect(getAuthErrorMessage(err('auth/invalid-email'))).toContain('valid email');
    expect(getAuthErrorMessage(err('auth/missing-password'))).toContain('enter a password');
    expect(getAuthErrorMessage(err('auth/weak-password'))).toContain('6 characters');
    expect(getAuthErrorMessage(err('auth/email-already-in-use'))).toContain('already exists');
    expect(getAuthErrorMessage(err('auth/too-many-requests'))).toContain('Too many attempts');
    expect(getAuthErrorMessage(err('auth/network-request-failed'))).toContain('Network error');
    expect(getAuthErrorMessage(err('auth/user-disabled'))).toContain('disabled');
  });

  it('falls back only for codes it genuinely does not know', () => {
    expect(getAuthErrorMessage(err('auth/some-future-code'))).toContain(
      'Something went wrong. Please try again.',
    );
  });

  it('shows the unmapped code in a development build, so one screenshot identifies it', () => {
    // The fallback used to discard the code, which is how a real sign-in
    // failure became undiagnosable — the member sees "something went wrong"
    // and nobody can see why.
    const dev = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(getAuthErrorMessage(err('auth/internal-error'))).toContain('auth/internal-error');
    (global as { __DEV__?: boolean }).__DEV__ = dev;
  });

  it('never leaks a raw code in a release build', () => {
    // The rule the dev suffix is an explicit exception to: a member has no use
    // for `auth/internal-error` and it makes the app look broken.
    const dev = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = false;
    const message = getAuthErrorMessage(err('auth/internal-error'));
    expect(message).toBe('Something went wrong. Please try again.');
    expect(message).not.toContain('auth/');
    (global as { __DEV__?: boolean }).__DEV__ = dev;
  });

  it('survives anything that is not a Firebase error', () => {
    // The catch block hands this whatever was thrown.
    for (const thrown of [null, undefined, 'a string', new Error('boom'), {}, 42]) {
      expect(typeof getAuthErrorMessage(thrown)).toBe('string');
      expect(getAuthErrorMessage(thrown).length).toBeGreaterThan(0);
    }
  });

  it('every message is a complete sentence a member can read', () => {
    // Release behaviour: no raw codes, no fragments. Checked with __DEV__ off
    // because the development build deliberately appends the code (above).
    const dev = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = false;
    const codes = [
      'auth/invalid-login-credentials',
      'auth/invalid-email',
      'auth/weak-password',
      'auth/operation-not-allowed',
      'auth/unknown',
    ];
    for (const code of codes) {
      const message = getAuthErrorMessage(err(code));
      expect(message).toMatch(/[.!]$/);
      expect(message).not.toMatch(/auth\//);
    }
    (global as { __DEV__?: boolean }).__DEV__ = dev;
  });
});
