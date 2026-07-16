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
 * Maps a Firebase Auth error to a short, member-facing message. Falls back
 * to a generic message for codes we haven't special-cased.
 */
export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/missing-password':
      return 'Please enter a password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
