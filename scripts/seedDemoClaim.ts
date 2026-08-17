/**
 * seedDemoClaim.ts — puts one real lounge into `claimStatus: 'pending'` so the
 * claim-review flow can be demonstrated end to end.
 *
 * Admin Claim Review, the approval notification and My Shops are all correct
 * and all invisible with zero pending claims — the screen shows its empty
 * state, which is honest but demonstrates nothing. This writes exactly the
 * fields ClaimListingScreen writes (see ownerService.submitLoungeClaim), so
 * the resulting claim is indistinguishable from one a member submitted.
 *
 * The claimant defaults to the same account that reviews it, which is what
 * makes this demonstrable by one person on one device: submit is already
 * shown, then approve as admin, then the approval notification arrives in
 * that same account's bell icon, then the lounge appears under My Shops.
 * Pass a different uid as the second argument for a two-account run.
 *
 * SETUP: same serviceAccountKey.json as seedFirestore.ts.
 * RUN:   npm run seed:demo-claim -- <loungeId> [claimantUserId]
 *        npm run seed:demo-claim -- --undo <loungeId>
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

import type { LoungeDocument } from '../src/types/firestore';

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing serviceAccountKey.json at the project root.');
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')) as ServiceAccount),
});
const db = getFirestore();

/** The account that reviews claims — see src/config/admins.ts. */
const DEFAULT_CLAIMANT = 'Lq35g8HzfqP0zlV1FpYV0tyec003';

async function undo(loungeId: string): Promise<void> {
  // The same field set rejectLoungeClaim clears, so this leaves the lounge
  // exactly as unclaimed as it started.
  await db.doc(`lounges/${loungeId}`).update({
    claimStatus: FieldValue.delete(),
    claimantUserId: FieldValue.delete(),
    ownerName: FieldValue.delete(),
    ownerContactEmail: FieldValue.delete(),
    ownerContactPhone: FieldValue.delete(),
    claimedAt: FieldValue.delete(),
  });
  console.log(`Cleared any claim on ${loungeId}.`);
}

async function seed(loungeId: string, claimantUserId: string): Promise<void> {
  const ref = db.doc(`lounges/${loungeId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    console.error(`No lounge with id ${loungeId}.`);
    process.exit(1);
  }
  const lounge = snapshot.data() as LoungeDocument;

  // Refuse rather than overwrite: silently clobbering a real owner's record
  // to set up a demo would be a genuinely bad trade.
  if (lounge.ownerId) {
    console.error(`${lounge.name} is already owned by ${lounge.ownerId}. Pick another lounge.`);
    process.exit(1);
  }
  if (lounge.claimStatus === 'pending') {
    console.log(`${lounge.name} already has a claim pending — nothing to do.`);
    return;
  }

  await ref.update({
    claimStatus: 'pending',
    claimantUserId,
    ownerName: 'Rohith Akepati',
    ownerContactEmail: 'rohith.akepati@enteraxion.com',
    ownerContactPhone: '(732) 555-0142',
    claimedAt: Timestamp.now(),
  });

  console.log(`Pending claim created on "${lounge.name}" (${loungeId}).`);
  console.log(`  claimant: ${claimantUserId}`);
  console.log('\nDemo path:');
  console.log('  1. Profile -> Review Business Claims  (admin only)');
  console.log('  2. Approve');
  console.log('  3. Bell icon -> "Your business has been approved"');
  console.log('  4. Profile -> My Shops -> Edit listing details');
  console.log(`\nTo reset: npm run seed:demo-claim -- --undo ${loungeId}`);
}

const args = process.argv.slice(2);
const run =
  args[0] === '--undo'
    ? undo(args[1])
    : seed(args[0], args[1] ?? DEFAULT_CLAIMANT);

if (!args[0] || (args[0] === '--undo' && !args[1])) {
  console.error('Usage: npm run seed:demo-claim -- <loungeId> [claimantUserId]');
  console.error('       npm run seed:demo-claim -- --undo <loungeId>');
  process.exit(1);
}

run.catch(error => {
  console.error(error);
  process.exit(1);
});
