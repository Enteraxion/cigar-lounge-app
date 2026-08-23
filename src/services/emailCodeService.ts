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

const functions = getFunctions(getApp());

export type SendCodeResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; message: string };

export type ConfirmCodeResult = { ok: true } | { ok: false; message: string };

/**
 * Firebase Functions errors arrive as `{ code: 'functions/resource-exhausted',
 * message }`. The function sets messages deliberately — how many seconds to
 * wait, how many tries are left — so the message is shown as written rather
 * than replaced with something generic, which is the whole reason those
 * messages say what they say.
 */
function messageFor(error: unknown, fallback: string): string {
  const details = error as { code?: string; message?: string } | null;
  const code = details?.code ?? '';
  if (code.endsWith('unauthenticated')) {
    return 'Please sign in again.';
  }
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded/network')) {
    return 'No connection. Check your network and try again.';
  }
  return details?.message?.trim() || fallback;
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
