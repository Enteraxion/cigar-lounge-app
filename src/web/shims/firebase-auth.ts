/**
 * `@react-native-firebase/auth` on the web — see firebase-app.ts for why a
 * re-export is all this needs. Importing the app shim first guarantees
 * initializeApp() has run before any of these functions are called.
 */
import './firebase-app';

export * from 'firebase/auth';
