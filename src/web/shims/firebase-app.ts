/**
 * `@react-native-firebase/app` on the web.
 *
 * The app talks to Firebase through the MODULAR API — getFirestore(), doc(),
 * getDocs() — and React Native Firebase deliberately mirrors the web SDK's
 * function names and signatures for exactly that API. So the 24 files that use
 * Firebase need no changes at all: the web build aliases each
 * `@react-native-firebase/*` import to one of these shims, and the same source
 * runs on both.
 *
 * The config below is the same public web config the Owner and Admin portals
 * already use. Firebase web API keys are meant to be embedded in client code —
 * access control is firestore.rules, not secrecy.
 */
import { initializeApp, getApp as webGetApp, getApps } from 'firebase/app';

const firebaseConfig = {
  projectId: 'the-reserve-app-c44ed',
  appId: '1:345721268939:web:8032a5fda9afbe9147894e',
  storageBucket: 'the-reserve-app-c44ed.firebasestorage.app',
  apiKey: 'AIzaSyBw99La_Ivt6CvVujjRx1kMwCjbBZcBBfA',
  authDomain: 'the-reserve-app-c44ed.firebaseapp.com',
  messagingSenderId: '345721268939',
};

// React Native Firebase reads google-services.json / GoogleService-Info.plist
// at launch, so the native app never initialises explicitly. The web SDK has no
// such file, so do it here, once, before anything asks for the app.
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}

export const getApp = webGetApp;
export * from 'firebase/app';
