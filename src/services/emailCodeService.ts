/**
 * emailCodeService
 *
 * Client half of the 6-digit email verification code (see
 * functions/src/index.ts's sendEmailVerificationCode /
 * confirmEmailVerificationCode).
 *
 * Both calls are thin on purpose. Everything that decides anything — how long a
 * code lives, how many wrong guesses are allowed, how often one can be resent —
 * lives in the Cloud Function, because a limit enforced in the app is not a
 * limit. This file exists to turn a Firebase Functions error into a sentence a
 * member can act on.
 */

import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

// Emulator wiring, when it is on, lives in src/config/devEmulators.ts and is
// applied to this same default instance from index.js before anything here runs.
const functions = getFunctions(getApp());

export type SendCodeResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; message: string };

export type ConfirmCodeResult = { ok: true } | { ok: false; message: string };

/**
 * Turns a Firebase Functions error into a sentence a member can act on.
 *
 * The function sets its own messages deliberately — how many seconds to wait,
 * how many tries are left — so those are shown as written. What must NOT be
 * shown is the raw error for the codes where react-native-firebase puts a bare
 * status string in `message`: an 'internal' error arrived as the single word
 * "INTERNAL" and that is exactly what the wall displayed to Rohith on
 * 2026-08-23. A member cannot do anything with "INTERNAL", and it reads like a
 * crash rather than a problem on our side.
 *
 * 'internal' is always our fault, never the member's — the server hit something
 * it did not expect (a rejected SendGrid key, an unverified sender) and the real
 * reason is in the Cloud Functions log, deliberately not in the response.
 */
function messageFor(error: unknown, fallback: string): string {
  const details = error as { code?: string; message?: string } | null;
  const code = (details?.code ?? '').replace(/^functions\//, '');

  switch (code) {
    case 'unauthenticated':
      return 'Please sign in again.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'No connection. Check your network and try again.';
    case 'internal':
    case 'unknown':
      return "Something went wrong on our side — we couldn't send the code. Please try again in a moment.";
    default:
      break;
  }

  // Only trust the server's own wording when it actually reads like a sentence.
  // A bare status token ("INTERNAL", "NOT_FOUND") is the SDK echoing the code,
  // not a message written for anyone to read.
  const message = details?.message?.trim() ?? '';
  const looksLikeAStatusCode = /^[A-Z_]+$/.test(message);
  return message && !looksLikeAStatusCode ? message : fallback;
}

/** Asks the server to email a fresh code. */
export async function requestEmailCode(): Promise<SendCodeResult> {
  try {
    const call = httpsCallable<
      Record<string, never>,
      { sent: boolean; reason?: string }
    >(functions, 'sendEmailVerificationCode');
    const { data } = await call({});
    return { ok: true, alreadyVerified: data.reason === 'already-verified' };
  } catch (error) {
    return { ok: false, message: messageFor(error, "Couldn't send a code. Try again.") };
  }
}

/**
 * Submits a code.
 *
 * On success the server has already set `emailVerified` on the Firebase
 * account — but the app will keep showing the wall until the local ID token is
 * re-read, because the flag is baked into that cached token and does not change
 * on its own.
 *
 * This deliberately does NOT do that refresh. useEmailVerification owns a
 * module-level cache with a listener set, and its `refresh()` is the only thing
 * that publishes to every mounted instance. Refreshing the token from here
 * would update Firebase's user object and leave the navigator's copy of the
 * hook none the wiser — which is exactly the bug that made "I've confirmed —
 * continue" a dead button on 2026-08-21. The caller calls the hook's refresh().
 */
export async function submitEmailCode(code: string): Promise<ConfirmCodeResult> {
  try {
    const call = httpsCallable<{ code: string }, { verified: boolean }>(
      functions,
      'confirmEmailVerificationCode',
    );
    await call({ code: code.trim() });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: messageFor(error, "Couldn't check that code. Try again."),
    };
  }
}

/**
 * Asks for a password reset code.
 *
 * Always reports success, because the server always reports success — an
 * endpoint that answered differently for an unknown address would tell anyone
 * who asked which addresses have accounts. The screen therefore says "if that
 * address has an account, a code is on its way", which is both true and all we
 * are willing to say.
 */
export async function requestPasswordResetCode(email: string): Promise<ConfirmCodeResult> {
  try {
    const call = httpsCallable<{ email: string }, { sent: boolean }>(
      functions,
      'sendPasswordResetCode',
    );
    await call({ email: email.trim() });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageFor(error, "Couldn't send a code. Try again.") };
  }
}

/** Submits the code and the new password together. */
export async function submitPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<ConfirmCodeResult> {
  try {
    const call = httpsCallable<
      { email: string; code: string; newPassword: string },
      { reset: boolean }
    >(functions, 'confirmPasswordReset');
    await call({ email: email.trim(), code: code.trim(), newPassword });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageFor(error, "Couldn't reset your password. Try again.") };
  }
}
