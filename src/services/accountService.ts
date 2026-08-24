/**
 * accountService
 *
 * Deleting your own account, from inside the app.
 *
 * Required by Apple guideline 5.1.1(v): an app that offers account creation must
 * offer account deletion, in-app, without emailing support. It is one of the most
 * common App Store rejections, and until 2026-08-24 nothing here could do it.
 *
 * All the work happens in the `deleteMyAccount` Cloud Function, which takes no
 * arguments — the uid comes from the caller's token, never from the app. That is
 * deliberate: an endpoint that accepted a userId would let any signed-in member
 * delete anybody.
 */

import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

const functions = getFunctions(getApp());

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Deletes the signed-in member's account and everything attached to it.
 *
 * On success the Auth account is gone, so `onAuthStateChanged` fires and the
 * navigator returns to the sign-in screen on its own — there is no need to sign
 * out afterwards, and trying to would fail against a user that no longer exists.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  try {
    const call = httpsCallable<Record<string, never>, { authDeleted: boolean }>(
      functions,
      'deleteMyAccount',
    );
    await call({});
    return { ok: true };
  } catch (error) {
    const details = error as { code?: string; message?: string } | null;
    const code = (details?.code ?? '').replace(/^functions\//, '');
    if (code === 'unauthenticated') {
      return { ok: false, message: 'Please sign in again, then try once more.' };
    }
    if (code === 'failed-precondition') {
      // The admin guard. Its message is written to be read.
      return { ok: false, message: details?.message ?? 'This account cannot be deleted.' };
    }
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      return { ok: false, message: 'No connection. Check your network and try again.' };
    }
    return {
      ok: false,
      message: "Something went wrong and your account was not deleted. Please try again.",
    };
  }
}
