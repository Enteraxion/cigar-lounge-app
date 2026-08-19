/**
 * createAdmin.ts — creates the single admin account the team signs in with after
 * scripts/resetDatabase.ts has emptied everything.
 *
 * It creates the Auth account *and* the matching users/{uid} document, because
 * the app reads a member's profile from Firestore and an Auth account with no
 * document shows a nameless profile with no stats.
 *
 * The new account is marked `ageVerification.status: 'verified'` deliberately.
 * Admin write access to that field is what firestore.rules grants admins, and an
 * admin who is themselves stuck behind the 21+ wall cannot reach the screen where
 * verifications are reviewed — including their own.
 *
 * THE PASSWORD IS NOT IN THIS FILE, and should not be added to it. It is read
 * from the ADMIN_PASSWORD environment variable so it never enters the repository.
 * Prefix it on the command line and it stays out of the file; note that it does
 * still land in your shell history, so use `history -d` afterwards or prefix the
 * command with a space if your shell is set to ignore those.
 *
 * SETUP: same serviceAccountKey.json as seedFirestore.ts.
 * RUN:   ADMIN_EMAIL=admin123@gmail.com ADMIN_PASSWORD='...' npm run create:admin
 *
 * ADMIN_EMAIL defaults to the address in src/config/admins.ts. Whatever address
 * is used must appear in ALL THREE of src/config/admins.ts, firestore.rules and
 * storage.rules, or the account signs in as an ordinary member — the rules are
 * the real boundary, and they cannot import the app's config.
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing serviceAccountKey.json at the project root.');
  process.exit(1);
}

const EMAIL = (process.env.ADMIN_EMAIL ?? 'admin123@gmail.com').toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error(
    'Set ADMIN_PASSWORD when running this, e.g.\n' +
      "  ADMIN_PASSWORD='your-password' npm run create:admin\n\n" +
      'It is read from the environment on purpose so it is never committed.',
  );
  process.exit(1);
}

if (PASSWORD.length < 6) {
  // Firebase's own minimum. Caught here so the failure is a clear message rather
  // than an auth/weak-password error from deep inside the SDK.
  console.error('Firebase requires at least 6 characters.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')) as ServiceAccount;
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  // An existing account is updated rather than duplicated, so re-running this
  // after a mistyped password fixes it instead of failing on email-already-in-use.
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(EMAIL);
    uid = existing.uid;
    await auth.updateUser(uid, { password: PASSWORD, displayName: 'Admin' });
    console.log(`Updated the existing account for ${EMAIL}`);
  } catch {
    const created = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Admin',
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`Created ${EMAIL}`);
  }

  await db.doc(`users/${uid}`).set(
    {
      name: 'Admin',
      email: EMAIL,
      avatarUrl: '',
      memberTier: 'Founding Member',
      homeCity: '',
      favoriteBrand: '',
      favoriteLounge: '',
      memberSince: Timestamp.now(),
      // See the header: an admin behind the 21+ wall cannot reach the review
      // screen, so this account is verified at creation.
      ageVerification: {
        dateOfBirth: '1990-01-01',
        status: 'verified',
        submittedAt: Timestamp.now(),
        reviewedAt: Timestamp.now(),
        reviewedBy: 'system:createAdmin',
      },
      stats: { reviewsWritten: 0, photosUploaded: 0, favorites: 0, collections: 0 },
    },
    { merge: true },
  );

  console.log(`Wrote users/${uid}`);
  console.log(
    '\nThis account only has admin powers if its address is listed in all three of\n' +
      '  src/config/admins.ts, firestore.rules, storage.rules\n' +
      'and the rules have been deployed:\n' +
      '  npx firebase-tools deploy --only firestore:rules,storage\n',
  );
  process.exit(0);
}

main().catch(error => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
