/**
 * Firebase Auth error codes to member-facing messages.
 *
 * Extracted from firebaseAuth.ts so it can be tested: that module calls
 * `getAuth()` at import time, which needs the native Firebase module and so
 * can't be loaded in a unit test. Same split as functions/src/relevance.ts.
 *
 * The reason this needed testing at all: the app showed "Something went wrong.
 * Please try again." for a simply-wrong password. Firebase changed which code
 * it returns for that case — projects with **email enumeration protection**
 * enabled (the default for anything created since late 2023, including this
 * one) return `auth/invalid-login-credentials` rather than
 * `auth/wrong-password` or `auth/user-not-found`. Those two older codes were
 * mapped and the new one wasn't, so the single most common login failure fell
 * through to the generic fallback.
 *
 * The whole point of enumeration protection is that the server will not tell
 * you *which* half was wrong — that's what stops an attacker using the login
 * form to discover who has an account. So one message has to cover both, and
 * "Incorrect email or password" is it.
 */

/** Codes that all mean "those credentials didn't work", without saying which part. */
const BAD_CREDENTIAL_CODES = [
  // Returned when email enumeration protection is ON. This is the code this
  // project actually gets, and the one that was missing.
  'auth/invalid-login-credentials',
  'auth/invalid-credential',
  // Still returned by older projects with enumeration protection OFF.
  'auth/wrong-password',
  'auth/user-not-found',
];

export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';

  if (BAD_CREDENTIAL_CODES.includes(code)) {
    return 'Incorrect email or password.';
  }

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-email':
      return 'Please enter your email address.';
    case 'auth/missing-password':
      return 'Please enter a password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.';
    /**
     * The sign-in method isn't switched on in the Firebase console. Worth its
     * own message because it is the exact error the Apple and Google buttons
     * on LoginScreen would raise — neither provider is configured yet — and
     * "something went wrong" would send a member retrying a button that
     * cannot work no matter how many times they press it.
     */
    case 'auth/operation-not-allowed':
      return 'That sign-in method isn’t available yet. Please use your email and password.';
    case 'auth/requires-recent-login':
      return 'Please sign in again to continue.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
