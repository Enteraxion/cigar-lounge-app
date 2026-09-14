/**
 * createReviewerAccount.ts — creates the demo account handed to Apple's App
 * Review team in App Store Connect's "Sign-In Information" box.
 *
 * Why this exists rather than "just make one in the app": the 21+ gate. A
 * reviewer who signs up fresh is sent straight to the ID wall and asked to
 * photograph a passport or driving licence. They will not do that, and they
 * cannot review what they cannot reach — reviewing, reserving and claiming a
 * business are all behind it. An app in this category being rejected because
 * the reviewer got stuck at verification is one of the commonest ways this
 * goes wrong, and it looks like a bug rather than a policy.
 *
 * So the account is created already verified, with no identity document
 * attached to it — there is no document to attach, which is the point. It is
 * an ordinary member in every other respect: NOT an admin, so handing these
 * credentials to Apple grants no access to the admin portal, member data or
 * anyone's identity documents.
 *
 * THE PASSWORD IS NOT IN THIS FILE and must not be added to it. It is read
 * from REVIEWER_PASSWORD so it never enters the repository. It does still land
 * in your shell history — prefix the command with a space, or run `history -d`
 * afterwards.
 *
 * SETUP: the same serviceAccountKey.json seedFirestore.ts needs.
 * RUN:   REVIEWER_EMAIL=appreview@enteraxion.com REVIEWER_PASSWORD='...' \
 *          npm run create:reviewer
 *
 * Re-running with an existing address updates that account rather than
 * failing, so a forgotten password is fixed by running it again.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(KEY_PATH)) {
  console.error('serviceAccountKey.json not found. See CLAUDE.md — it is gitignored.');
  process.exit(1);
}

const email = process.env.REVIEWER_EMAIL;
const password = process.env.REVIEWER_PASSWORD;

if (!email || !password) {
  console.error(
    'Set both REVIEWER_EMAIL and REVIEWER_PASSWORD.\n' +
      "  REVIEWER_EMAIL=appreview@enteraxion.com REVIEWER_PASSWORD='...' npm run create:reviewer",
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error('Apple will type this by hand. Use at least 8 characters.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});

const auth = admin.auth();
const db = admin.firestore();

/**
 * Comfortably over 21 and a fixed date, so the account does not quietly age
 * into a different test case months from now.
 */
const DATE_OF_BIRTH = '1985-06-15';

async function main(): Promise<void> {
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(email!);
    uid = existing.uid;
    await auth.updateUser(uid, { password, emailVerified: true, displayName: 'App Review' });
    console.log(`Updated the existing account (${uid}).`);
  } catch {
    const created = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: 'App Review',
    });
    uid = created.uid;
    console.log(`Created the account (${uid}).`);
  }

  // merge: true so re-running never wipes anything the reviewer saved while
  // they were looking around.
  await db.doc(`users/${uid}`).set(
    {
      name: 'App Review',
      email,
      homeCity: 'Houston, TX',
      // Verified with no document on file. deriveAgeGateState treats a record
      // with no documentType as complete — the path that exists for members
      // who verified before the two-sided flow shipped — so the app lets this
      // account straight through without an image to inspect.
      ageVerification: {
        status: 'verified',
        dateOfBirth: DATE_OF_BIRTH,
        reviewedAt: admin.firestore.Timestamp.now(),
        reviewedBy: 'app-review-demo-account',
      },
    },
    { merge: true },
  );

  console.log('\nReady. Paste these into App Store Connect → Sign-In Information:');
  console.log(`  Username : ${email}`);
  console.log('  Password : (the one you just set — not printed here)');
  console.log('\nAnd in the Notes box, something like:');
  console.log(
    '  "This account is already age-verified. Lounge Locator requires members to be\n' +
      '   21+ and to verify with a photo ID before reviewing, reserving or claiming a\n' +
      '   business; this demo account bypasses that step so every feature is reachable."',
  );
  console.log('\nThis account is NOT an admin and cannot reach the admin portal.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
