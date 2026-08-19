/**
 * resetDatabase.ts — returns the project to a clean slate: no accounts, no
 * member data, every lounge unclaimed.
 *
 * Rohith, 2026-08-19: months of claim testing left it unclear which shop
 * belonged to whom, so the answer is to wipe the people and the claims and start
 * over with one known admin.
 *
 * WHAT IT DELETES
 *   - every Firebase Auth account, including the admin ones
 *   - users/{uid} and all subcollections (favorites, collections, notifications,
 *     saved conversations, issue reports, age verifications)
 *   - every review, reservation and owner-authored event under every lounge
 *   - the claim fields on every lounge (ownerId, claimStatus, claimantUserId,
 *     ownerName, ownerContactEmail, ownerContactPhone, claimedAt) and
 *     favoritedByUserIds — this is what makes every shop free to claim again
 *   - everything under users/ in Cloud Storage, which is where the photographs
 *     of members' IDs live
 *
 * WHAT IT DELIBERATELY KEEPS
 *   - **the lounge documents themselves.** All 8,496 came from the Yelp and
 *     Google imports; the Yelp key expires 2026-08-19, so a wiped directory
 *     could not be rebuilt. "All the shops should be free" means unclaimed, not
 *     gone.
 *   - aggregates/cityStats, derived from those lounges and holding no member data
 *   - cityRefreshes, the import bookkeeping
 *
 * This is irreversible. Firestore has no undo and a deleted Auth account cannot
 * be restored, so the script reports what it would do and changes nothing unless
 * you pass --confirm.
 *
 * SETUP: same serviceAccountKey.json as seedFirestore.ts.
 * RUN:   npm run reset:database                (dry run — counts only)
 *        npm run reset:database -- --confirm   (does it)
 *
 * The replacement admin is created by scripts/createAdmin.ts afterwards, so no
 * password ever has to live in this file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(KEY_PATH)) {
  console.error(
    'Missing serviceAccountKey.json at the project root.\n' +
      'Download it from Firebase Console → Project settings → Service accounts.',
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')) as ServiceAccount & {
  project_id?: string;
};

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});
const db = getFirestore(app);
const auth = getAuth(app);
const bucket = getStorage(app).bucket();

const CONFIRMED = process.argv.includes('--confirm');

/** Exactly the fields ownerService.ts's CLAIM_FIELDS clears, kept in step by hand. */
const CLAIM_FIELDS = [
  'ownerId',
  'claimStatus',
  'claimantUserId',
  'ownerName',
  'ownerContactEmail',
  'ownerContactPhone',
  'claimedAt',
] as const;

/** Firestore's hard limit on writes in one batch. */
const BATCH_LIMIT = 500;

async function deleteEveryAccount(): Promise<number> {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const uids = page.users.map(user => user.uid);
    total += uids.length;
    if (CONFIRMED && uids.length > 0) {
      const result = await auth.deleteUsers(uids);
      if (result.failureCount > 0) {
        // Reported rather than thrown: one stubborn account must not abandon the
        // rest of the wipe half-done, which is the worst outcome available here.
        console.warn(`  ! ${result.failureCount} account(s) could not be deleted`);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return total;
}

/** Every document in a collection group — all `reviews` under all lounges, etc. */
async function countCollectionGroup(name: string): Promise<number> {
  const snapshot = await db.collectionGroup(name).count().get();
  return snapshot.data().count;
}

async function deleteCollectionGroup(name: string): Promise<number> {
  const total = await countCollectionGroup(name);
  if (!CONFIRMED) {
    return total;
  }
  for (;;) {
    const snapshot = await db.collectionGroup(name).limit(BATCH_LIMIT).get();
    if (snapshot.empty) {
      return total;
    }
    const batch = db.batch();
    snapshot.docs.forEach(document => batch.delete(document.ref));
    await batch.commit();
  }
}

async function deleteAllUserDocuments(): Promise<number> {
  const snapshot = await db.collection('users').get();
  if (CONFIRMED) {
    for (const document of snapshot.docs) {
      // recursiveDelete rather than a plain delete: a user document's real bulk is
      // its subcollections, and deleting the parent leaves those orphaned but
      // still readable by their own paths.
      await db.recursiveDelete(document.ref);
    }
  }
  return snapshot.size;
}

async function freeEveryLounge(): Promise<{ scanned: number; cleared: number }> {
  const snapshot = await db.collection('lounges').get();
  let cleared = 0;
  let batch = db.batch();
  let pending = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const updates: Record<string, unknown> = {};
    for (const field of CLAIM_FIELDS) {
      if (data[field] !== undefined) {
        updates[field] = FieldValue.delete();
      }
    }
    if (Array.isArray(data.favoritedByUserIds) && data.favoritedByUserIds.length > 0) {
      updates.favoritedByUserIds = [];
    }
    if (Object.keys(updates).length === 0) {
      continue;
    }
    cleared += 1;
    if (!CONFIRMED) {
      continue;
    }
    batch.update(document.ref, updates);
    pending += 1;
    if (pending === BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (CONFIRMED && pending > 0) {
    await batch.commit();
  }
  return { scanned: snapshot.size, cleared };
}

async function deleteMemberUploads(): Promise<number> {
  const [files] = await bucket.getFiles({ prefix: 'users/' });
  if (CONFIRMED && files.length > 0) {
    await bucket.deleteFiles({ prefix: 'users/', force: true });
  }
  return files.length;
}

async function main() {
  console.log(
    CONFIRMED
      ? '\n!!  DELETING FOR REAL — Firestore and Auth have no undo.\n'
      : '\nDRY RUN — nothing will be changed. Re-run with --confirm to apply.\n',
  );

  const accounts = await deleteEveryAccount();
  console.log(`Auth accounts .................. ${accounts}`);

  const userDocs = await deleteAllUserDocuments();
  console.log(`users/ documents (+subcolls) ... ${userDocs}`);

  for (const group of ['reviews', 'reservations', 'events']) {
    const count = await deleteCollectionGroup(group);
    console.log(`${(group + ' ').padEnd(31, '.')} ${count}`);
  }

  const lounges = await freeEveryLounge();
  console.log(
    `lounges ........................ ${lounges.scanned} kept, ` +
      `${lounges.cleared} had claim/favourite data cleared`,
  );

  const uploads = await deleteMemberUploads();
  console.log(`Storage objects under users/ ... ${uploads}`);

  console.log(
    CONFIRMED
      ? '\nDone. Every shop is unclaimed and no member data remains.\n' +
          'Next: ADMIN_PASSWORD=... npm run create:admin\n'
      : '\nNothing was changed.\n',
  );
  process.exit(0);
}

main().catch(error => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
