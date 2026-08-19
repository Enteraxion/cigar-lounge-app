/**
 * Centralized Firebase Auth setup for The Reserve.
 *
 * All three auth screens (Login, SignUp, ForgotPassword) and AppNavigator's
 * session-persistence listener import from here rather than touching
 * @react-native-firebase/auth directly, so the auth instance and the
 * error-code -> friendly-message mapping stay in one place.
 *
 * Uses the modular API (getAuth/signInWithEmailAndPassword/etc.) — the
 * namespaced `auth()` API is deprecated as of @react-native-firebase v22.
 */

import {
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  type User,
} from '@react-native-firebase/auth';

export const auth = getAuth();

export type AuthUser = User;

export { onAuthStateChanged, signOut };

/**
 * createUserWithEmailAndPassword signs the new user in immediately, firing
 * a signed-in event on this same `auth` instance before SignUpScreen can
 * sign back out. AppNavigator's session listener checks this flag to
 * ignore that one transient signed-in event, so it never mounts Main for
 * an instant during sign-up.
 */
let signUpTransitionActive = false;

export function beginSignUpTransition() {
  signUpTransitionActive = true;
}

/**
 * Notified when the sign-up transition ends.
 *
 * Needed because the suppression above swallows the one `onAuthStateChanged`
 * event that would otherwise let AppNavigator in. Sign-up now keeps the session
 * — a new member goes straight to the ID upload rather than being bounced to a
 * login form — so something has to tell the navigator the session is ready
 * *after* the age-verification record exists. Without that ordering the
 * navigator would evaluate the 21+ gate against a document that has not been
 * written yet and let the member past it.
 */
let onSignUpTransitionEnd: (() => void) | null = null;

export function setSignUpTransitionEndListener(listener: (() => void) | null) {
  onSignUpTransitionEnd = listener;
}

export function endSignUpTransition() {
  signUpTransitionActive = false;
  onSignUpTransitionEnd?.();
}

export function isSignUpTransitionActive() {
  return signUpTransitionActive;
}

/**
 * Asks Firebase to email the member a link confirming they own the address.
 *
 * Rohith, 2026-08-19: every new member should prove their email. Firebase has no
 * OTP code for password accounts — it sends a link — and this is the free,
 * server-side version of that with no email provider of our own to configure.
 *
 * Never allowed to fail loudly. It is called immediately after sign-up, where
 * throwing would surface as "couldn't create your account" over an account that
 * was in fact created. The member can resend from the banner, and the address
 * being unconfirmed is already a state the app handles.
 */
export async function sendVerificationEmail(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || user.emailVerified) {
    return false;
  }
  try {
    await sendEmailVerification(user);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-reads the account so `emailVerified` reflects a link tapped elsewhere.
 *
 * The flag is baked into the cached ID token, so it does not change on its own
 * when the member confirms in their mail app — without an explicit reload the app
 * would keep insisting the address is unconfirmed until the token happened to
 * refresh. Callers poll this when the app returns to the foreground, which is
 * exactly when someone has come back from tapping the link.
 */
export async function refreshEmailVerified(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) {
    return false;
  }
  try {
    await user.reload();
    return auth.currentUser?.emailVerified ?? false;
  } catch {
    // A failed refresh reports the value already held rather than false, so a
    // dropped request cannot un-verify somebody who is verified.
    return auth.currentUser?.emailVerified ?? false;
  }
}

/**
 * Re-exported so every auth screen keeps importing it from here, while the
 * mapping itself lives in a module a unit test can load — this file calls
 * getAuth() above, which needs the native module. See src/utils/authErrors.ts
 * for why the mapping is worth testing.
 */
export { getAuthErrorMessage } from '../utils/authErrors';
