/**
 * removeDemoData.ts — deletes the hand-authored demo data seedFirestore.ts
 * wrote (the 17 mock lounges + their reviews + the demo user + its
 * favorites/collections), now that scripts/importYelpLounges.ts has
 * populated the `lounges` collection with real cigar lounges instead.
 *
 * Identifies demo lounges as any lounge doc whose `tags` does NOT include
 * 'imported-from-yelp' (every real lounge carries that tag — see
 * importYelpLounges.ts's toLoungeDocument) — a direct, reliable
 * discriminator rather than guessing from ids.
 *
 * Deletes, in order: each demo lounge's `reviews` subcollection, the demo
 * lounge docs themselves, the demo user's `favorites` and `collections`
 * subcollections, and finally the demo user doc
 * (DEMO_USER_ID = 'demo-alexander-rossi', matching seedFirestore.ts).
 *
 * This only removes what seedFirestore.ts created — running
 * `npm run seed:firestore` again would recreate the exact same demo data
 * if it's ever needed back.
 *
 * SETUP: same serviceAccountKey.json as seedFirestore.ts.
 * RUN: npm run remove:demo-data
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { LoungeDocument } from '../src/types/firestore';

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`\nNo service account key found at:\n  ${serviceAccountPath}\n`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount & {
  project_id: string;
};

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DEMO_USER_ID = 'demo-alexander-rossi';

async function main() {
  console.log(`\nRemoving demo data from Firestore project: ${serviceAccount.project_id}\n`);

  const loungesSnapshot = await db.collection('lounges').get();
  const demoLounges = loungesSnapshot.docs.filter(doc => {
    const data = doc.data() as LoungeDocument;
    return !data.tags?.includes('imported-from-yelp');
  });

  console.log(`Found ${demoLounges.length} demo lounges (of ${loungesSnapshot.size} total).`);

  for (const loungeDoc of demoLounges) {
    const reviewsSnapshot = await loungeDoc.ref.collection('reviews').get();
    for (const reviewDoc of reviewsSnapshot.docs) {
      await reviewDoc.ref.delete();
    }
    if (reviewsSnapshot.size > 0) {
      console.log(`  deleted ${reviewsSnapshot.size} reviews under ${loungeDoc.id}`);
    }
    await loungeDoc.ref.delete();
  }
  console.log(`Deleted ${demoLounges.length} demo lounges.`);

  const demoUserRef = db.collection('users').doc(DEMO_USER_ID);
  const demoUserSnapshot = await demoUserRef.get();
  if (demoUserSnapshot.exists) {
    for (const sub of ['favorites', 'collections']) {
      const subSnapshot = await demoUserRef.collection(sub).get();
      for (const doc of subSnapshot.docs) {
        await doc.ref.delete();
      }
      console.log(`Deleted ${subSnapshot.size} ${sub} for demo user.`);
    }
    await demoUserRef.delete();
    console.log(`Deleted demo user (${DEMO_USER_ID}).`);
  } else {
    console.log('Demo user already absent.');
  }

  console.log('\nDone.\n');
}

main().catch(error => {
  console.error('\nCleanup failed:', error);
  process.exit(1);
});
