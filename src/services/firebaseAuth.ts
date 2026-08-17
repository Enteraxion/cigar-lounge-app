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

import { getAuth, onAuthStateChanged, signOut, type User } from '@react-native-firebase/auth';

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

export function endSignUpTransition() {
  signUpTransitionActive = false;
}

export function isSignUpTransitionActive() {
  return signUpTransitionActive;
}

/**
 * Re-exported so every auth screen keeps importing it from here, while the
 * mapping itself lives in a module a unit test can load — this file calls
 * getAuth() above, which needs the native module. See src/utils/authErrors.ts
 * for why the mapping is worth testing.
 */
export { getAuthErrorMessage } from '../utils/authErrors';
