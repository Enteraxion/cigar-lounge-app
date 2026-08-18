/**
 * seedAgeVerification.ts — puts an account into `pending` so the 21+ flow can
 * be tested on a login that already exists.
 *
 * ProfileScreen only shows the Age Verification card while there is something
 * to do (`pending` or `rejected`). Accounts created before the feature existed
 * have no record at all and deliberately are not nagged, which is correct
 * behaviour but leaves the tester with no way in short of creating a second
 * account.
 *
 * Writes only `ageVerification`, merged, so nothing else on the profile is
 * touched. `--undo` removes the field entirely and returns the account to
 * exactly the state it was in.
 *
 * SETUP: serviceAccountKey.json at the project root.
 * RUN:   npm run seed:age-verification -- <email> [YYYY-MM-DD]
 *        npm run seed:age-verification -- --undo <email>
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing serviceAccountKey.json at the project root.');
  process.exit(1);
}
initializeApp({
  credential: cert(JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')) as ServiceAccount),
});
const db = getFirestore();

async function uidFor(email: string): Promise<string> {
  const user = await getAuth().getUserByEmail(email);
  return user.uid;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const undo = args[0] === '--undo';
  const email = undo ? args[1] : args[0];
  const dateOfBirth = undo ? undefined : args[1] ?? '1990-06-15';

  if (!email) {
    console.error('Usage: npm run seed:age-verification -- <email> [YYYY-MM-DD]');
    console.error('       npm run seed:age-verification -- --undo <email>');
    process.exit(1);
  }

  const uid = await uidFor(email);

  if (undo) {
    await db.doc(`users/${uid}`).update({ ageVerification: FieldValue.delete() });
    console.log(`Removed ageVerification from ${email} (${uid}).`);
    console.log('The Profile card will disappear again.');
    return;
  }

  await db.doc(`users/${uid}`).set(
    {
      ageVerification: {
        dateOfBirth,
        status: 'pending',
        submittedAt: Timestamp.now(),
      },
    },
    { merge: true },
  );

  console.log(`${email} (${uid}) is now pending, DOB ${dateOfBirth}.`);
  console.log('\nWhat to check:');
  console.log('  1. Profile -> Age Verification        (member side, upload an ID)');
  console.log('  2. Profile -> Review Age Verification (admin side, it now lists you)');
  console.log(`\nTo reset: npm run seed:age-verification -- --undo ${email}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
