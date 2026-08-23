/**
 * devEmulators
 *
 * Points the app at the local Firebase emulators so the whole email-code flow
 * can be driven from the real UI with no SendGrid key, no verified sender and no
 * DNS. The emulator-side Cloud Function logs the 6-digit code to the terminal
 * instead of emailing it (see functions/src/index.ts's FUNCTIONS_EMULATOR
 * branch), so you read it off the console and type it into the app.
 *
 * ---------------------------------------------------------------------------
 * HOW TO USE
 *
 *   1. Set ENABLED below to true.
 *   2. `npm run emulate` in one terminal. Wait for "All emulators ready".
 *   3. Rebuild the app (a JS reload is enough — this file is plain JS).
 *   4. Create a NEW account in the app. The emulator's Auth store starts empty,
 *      so existing accounts do not exist here — that is expected, not a bug.
 *   5. Tap "Email me a code". The code appears in the emulator terminal, and in
 *      the Emulator UI at http://localhost:4000/logs.
 *   6. Type it in. The wall drops.
 *   7. Set ENABLED back to false when you are done.
 *
 * ---------------------------------------------------------------------------
 * WHY ALL THREE, not just Functions
 *
 * An earlier version of this connected only Functions, which does not work and
 * cost me an hour to understand. The account lives wherever Auth points; the
 * emulator's `confirmEmailVerificationCode` calls `getAuth().updateUser(uid)`
 * against whatever Auth *it* is configured for. Connect Functions alone and the
 * app signs in to production while the function looks that uid up in the
 * emulator's empty Auth and fails with "There is no user record".
 *
 * Firestore comes along too, because a token minted by the Auth emulator is not
 * one production Firestore will accept — every signed-in read would fail. The
 * cost is a directory with no lounges in it, since the Firestore emulator starts
 * empty. That is fine for testing this flow and worth knowing before you wonder
 * where the 8,496 lounges went.
 *
 * ---------------------------------------------------------------------------
 * SAFETY
 *
 * Guarded by __DEV__ as well as ENABLED, so a release build cannot be made to
 * talk to a laptop even if this is committed set to true. Release builds strip
 * the branch entirely.
 */

import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';

/** Flip to true to use the emulators. Leave false on any commit you did not mean to. */
const ENABLED = false;

/**
 * Where the emulators are running.
 *
 * The Mac's LAN address rather than 'localhost', because that works from BOTH an
 * iOS simulator and a physical iPhone — localhost on a real device means the
 * phone itself. Run `ipconfig getifaddr en0` and put the result here; it changes
 * when the Mac moves network.
 */
const HOST = '192.168.1.192';

const PORTS = { auth: 9099, firestore: 8080, functions: 5001 };

if (__DEV__ && ENABLED) {
  const app = getApp();
  // Ordering matters only in that this must run before any service module calls
  // getFirestore() and issues a read — hence the import at the very top of
  // index.js, ahead of App.
  connectAuthEmulator(getAuth(app), `http://${HOST}:${PORTS.auth}`);
  connectFirestoreEmulator(getFirestore(app), HOST, PORTS.firestore);
  connectFunctionsEmulator(getFunctions(app), HOST, PORTS.functions);
  console.warn(
    `[dev] Firebase emulators at ${HOST} — Auth and Firestore are EMPTY. ` +
      'Create a new account. Verification codes print in the emulator terminal.',
  );
}

export const USING_EMULATORS = __DEV__ && ENABLED;
