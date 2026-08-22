/**
 * Firebase config for the Owner Portal web app — same Firebase project
 * ("the-reserve-app-c44ed") the mobile app uses, so an owner signs in
 * with the exact same account. This is the public web SDK config (not a
 * secret — Firebase web API keys are meant to be embedded in client code;
 * real access control is enforced by firestore.rules, not by hiding this).
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'the-reserve-app-c44ed',
  appId: '1:345721268939:web:8032a5fda9afbe9147894e',
  storageBucket: 'the-reserve-app-c44ed.firebasestorage.app',
  apiKey: 'AIzaSyBw99La_Ivt6CvVujjRx1kMwCjbBZcBBfA',
  authDomain: 'the-reserve-app-c44ed.firebaseapp.com',
  messagingSenderId: '345721268939',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
