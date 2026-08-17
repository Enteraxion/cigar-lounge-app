/**
 * Security rules run against the real rules engine, in the Firestore
 * emulator.
 *
 * The rest of the integration suite checks the rules *file* textually. That
 * catches a wide-open file, but it cannot tell you whether a specific write
 * is actually refused — and the claim-decision notifications introduced a
 * rule where the difference matters a lot. `claim_approved` is a message
 * saying "Your business has been approved"; if any signed-in member can write
 * one into another member's notifications, that is a ready-made scam that
 * also points the victim at a listing they don't own. The rule restricting it
 * to admins is only worth anything if it works, so it is exercised here
 * rather than reasoned about.
 *
 * RUN: npm run test:rules   (starts the emulator itself — needs Java)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteField,
  collection,
  getDoc,
} from 'firebase/firestore';

const ADMIN_EMAIL = 'rohithakepati@gmail.com';
const PROJECT_ID = 'the-reserve-rules-test';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** A signed-in member with no admin rights — the attacker in these tests. */
function member(uid = 'member-1', email = 'member@example.com') {
  return testEnv.authenticatedContext(uid, { email, email_verified: true }).firestore();
}

function admin() {
  return testEnv.authenticatedContext('admin-1', {
    email: ADMIN_EMAIL,
    email_verified: true,
  }).firestore();
}

const notification = (type: string) => ({
  type,
  title: 'Your business has been approved',
  body: 'You are now the verified owner.',
  read: false,
  createdAt: new Date(),
  data: { loungeId: 'lounge-1' },
});

describe('notification create rules', () => {
  const target = 'victim-1';

  it('lets a member write the notification types their own actions cause', async () => {
    // These stay open because a member favouriting or reviewing legitimately
    // notifies someone else — see userActionsService.createNotification.
    const db = member();
    await assertSucceeds(
      addDoc(collection(db, 'users', target, 'notifications'), notification('review_helpful')),
    );
    await assertSucceeds(
      addDoc(
        collection(db, 'users', target, 'notifications'),
        notification('new_review_on_favorite'),
      ),
    );
  });

  it('refuses a member forging an approval notification', async () => {
    // The property this file exists for.
    const db = member();
    await assertFails(
      addDoc(collection(db, 'users', target, 'notifications'), notification('claim_approved')),
    );
  });

  it('refuses a member forging a rejection notification', async () => {
    const db = member();
    await assertFails(
      addDoc(collection(db, 'users', target, 'notifications'), notification('claim_rejected')),
    );
  });

  it('lets an admin write claim decisions', async () => {
    const db = admin();
    await assertSucceeds(
      addDoc(collection(db, 'users', target, 'notifications'), notification('claim_approved')),
    );
    await assertSucceeds(
      addDoc(collection(db, 'users', target, 'notifications'), notification('claim_rejected')),
    );
  });

  it('refuses an unknown notification type from anyone', async () => {
    await assertFails(
      addDoc(collection(member(), 'users', target, 'notifications'), notification('anything_else')),
    );
    await assertFails(
      addDoc(collection(admin(), 'users', target, 'notifications'), notification('anything_else')),
    );
  });

  it('refuses a notification that arrives pre-read', async () => {
    // `read: false` is enforced so a notification can't be written already
    // dismissed, which would make it invisible to the member it is for.
    await assertFails(
      addDoc(collection(member(), 'users', target, 'notifications'), {
        ...notification('review_helpful'),
        read: true,
      }),
    );
  });

  it('refuses extra fields beyond the documented shape', async () => {
    await assertFails(
      addDoc(collection(member(), 'users', target, 'notifications'), {
        ...notification('review_helpful'),
        isAdmin: true,
      }),
    );
  });

  it('refuses an unauthenticated write', async () => {
    await assertFails(
      addDoc(
        collection(testEnv.unauthenticatedContext().firestore(), 'users', target, 'notifications'),
        notification('review_helpful'),
      ),
    );
  });

  it('only lets the recipient read their own notifications', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(
        doc(context.firestore(), 'users', target, 'notifications', 'n1'),
        notification('claim_approved'),
      );
    });
    await assertFails(getDoc(doc(member(), 'users', target, 'notifications', 'n1')));
    await assertSucceeds(
      getDoc(doc(member(target, 'victim@example.com'), 'users', target, 'notifications', 'n1')),
    );
  });
});

/**
 * The claim lifecycle, as the app actually performs it.
 *
 * These write the exact field sets ownerService writes, because that is where
 * this can silently break: the rules gate lounge updates on
 * `affectedKeys().hasOnly([...])`, so adding a field to one of those service
 * functions and not to the rules produces a permission error that no
 * typecheck or unit test would catch.
 */
describe('lounge claim lifecycle rules', () => {
  const LOUNGE = 'lounge-1';
  const CLAIMANT = 'claimant-1';

  /** Writes a lounge straight past the rules, as the import scripts do. */
  async function seedLounge(fields: Record<string, unknown> = {}) {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'lounges', LOUNGE), {
        name: 'Test Lounge',
        address: '1 Main St',
        tags: [],
        amenities: [],
        images: [],
        ratings: { overall: 4 },
        reviewCount: 0,
        coordinates: { lat: 30, lng: -97 },
        ...fields,
      });
    });
  }

  it('lets a member submit a claim on an unclaimed lounge', async () => {
    await seedLounge();
    const db = member(CLAIMANT, 'claimant@example.com');
    await assertSucceeds(
      setDoc(
        doc(db, 'lounges', LOUNGE),
        {
          claimStatus: 'pending',
          claimantUserId: CLAIMANT,
          ownerName: 'A Owner',
          ownerContactEmail: 'a@example.com',
          ownerContactPhone: '555',
          claimedAt: new Date(),
        },
        { merge: true },
      ),
    );
  });

  it('refuses a member claiming on behalf of somebody else', async () => {
    await seedLounge();
    await assertFails(
      setDoc(
        doc(member(CLAIMANT, 'claimant@example.com'), 'lounges', LOUNGE),
        { claimStatus: 'pending', claimantUserId: 'someone-else' },
        { merge: true },
      ),
    );
  });

  it('refuses a member granting themselves ownership directly', async () => {
    // The whole reason approval is admin-gated: a member who could write
    // ownerId would skip review entirely and then pass isOwnListingEdit.
    await seedLounge({ claimStatus: 'pending', claimantUserId: CLAIMANT });
    await assertFails(
      setDoc(
        doc(member(CLAIMANT, 'claimant@example.com'), 'lounges', LOUNGE),
        { ownerId: CLAIMANT },
        { merge: true },
      ),
    );
  });

  it('lets an admin approve — the exact write approveLoungeClaim makes', async () => {
    await seedLounge({ claimStatus: 'pending', claimantUserId: CLAIMANT });
    await assertSucceeds(
      updateDoc(doc(admin(), 'lounges', LOUNGE), {
        ownerId: CLAIMANT,
        claimStatus: deleteField(),
      }),
    );
  });

  it('lets an admin reject — the exact write rejectLoungeClaim makes', async () => {
    await seedLounge({
      claimStatus: 'pending',
      claimantUserId: CLAIMANT,
      ownerName: 'A Owner',
      ownerContactEmail: 'a@example.com',
      ownerContactPhone: '555',
      claimedAt: new Date(),
    });
    await assertSucceeds(
      updateDoc(doc(admin(), 'lounges', LOUNGE), {
        claimStatus: deleteField(),
        claimantUserId: deleteField(),
        ownerName: deleteField(),
        ownerContactEmail: deleteField(),
        ownerContactPhone: deleteField(),
        claimedAt: deleteField(),
      }),
    );
  });

  it('lets the approved owner edit exactly the fields EditListing edits', async () => {
    await seedLounge({ ownerId: CLAIMANT });
    await assertSucceeds(
      updateDoc(doc(member(CLAIMANT, 'claimant@example.com'), 'lounges', LOUNGE), {
        description: 'Updated',
        hours: 'Mon-Fri 9-5',
        priceRange: '$$',
        amenities: ['wifi'],
      }),
    );
  });

  it('refuses an owner editing a field outside that set', async () => {
    // e.g. inflating their own rating.
    await seedLounge({ ownerId: CLAIMANT });
    await assertFails(
      updateDoc(doc(member(CLAIMANT, 'claimant@example.com'), 'lounges', LOUNGE), {
        ratings: { overall: 5 },
      }),
    );
  });

  it('refuses a pending claimant editing the listing before approval', async () => {
    // isOwnListingEdit keys off ownerId, not claimantUserId — this is the
    // asymmetry MyShopsScreen's `approved` flag has to mirror, or it would
    // offer an Edit button that fails on save.
    await seedLounge({ claimStatus: 'pending', claimantUserId: CLAIMANT });
    await assertFails(
      updateDoc(doc(member(CLAIMANT, 'claimant@example.com'), 'lounges', LOUNGE), {
        description: 'Updated',
      }),
    );
  });

  it('refuses a non-owner editing someone else’s listing', async () => {
    await seedLounge({ ownerId: 'real-owner' });
    await assertFails(
      updateDoc(doc(member(), 'lounges', LOUNGE), { description: 'Hijacked' }),
    );
  });
});

describe('aggregates rules', () => {
  it('is readable by anyone, including signed-out visitors', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'aggregates', 'cityStats'), { cities: [] });
    });
    await assertSucceeds(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'aggregates', 'cityStats')),
    );
  });

  it('refuses client writes even from an admin', async () => {
    // Written only by the Admin SDK, which bypasses rules entirely. Allowing
    // client writes would let whoever could reach it rewrite what every
    // member sees on the Search tab.
    await assertFails(setDoc(doc(member(), 'aggregates', 'cityStats'), { cities: [] }));
    await assertFails(setDoc(doc(admin(), 'aggregates', 'cityStats'), { cities: [] }));
  });
});
