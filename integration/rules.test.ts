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

// Must match an address in firestore.rules' isAdmin(). Reduced to this single
// account on 2026-08-19 — see scripts/resetDatabase.ts.
const ADMIN_EMAIL = 'admin123@gmail.com';
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

  it('refuses a member forging an ownership-revoked notification', async () => {
    await assertFails(
      addDoc(collection(member(), 'users', target, 'notifications'), notification('ownership_revoked')),
    );
  });

  it('lets an admin write every claim decision', async () => {
    const db = admin();
    for (const type of ['claim_approved', 'claim_rejected', 'ownership_revoked']) {
      await assertSucceeds(
        addDoc(collection(db, 'users', target, 'notifications'), notification(type)),
      );
    }
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

  it('lets an admin revoke — the exact write revokeLoungeOwnership makes', async () => {
    // Approval used to be irreversible. This is the write that undoes it, and
    // it must clear ownerId specifically: leaving it behind is what would let
    // a removed owner keep passing isOwnListingEdit forever.
    await seedLounge({ ownerId: CLAIMANT, claimantUserId: CLAIMANT, ownerName: 'A Owner' });
    await assertSucceeds(
      updateDoc(doc(admin(), 'lounges', LOUNGE), {
        ownerId: deleteField(),
        claimStatus: deleteField(),
        claimantUserId: deleteField(),
        ownerName: deleteField(),
        ownerContactEmail: deleteField(),
        ownerContactPhone: deleteField(),
        claimedAt: deleteField(),
      }),
    );
  });

  it('refuses a member revoking somebody else’s ownership', async () => {
    await seedLounge({ ownerId: 'real-owner' });
    await assertFails(
      updateDoc(doc(member(), 'lounges', LOUNGE), { ownerId: deleteField() }),
    );
  });

  it('leaves a revoked lounge claimable again', async () => {
    // The point of clearing rather than flagging: the shop can come back.
    await seedLounge();
    await assertSucceeds(
      setDoc(
        doc(member(CLAIMANT, 'claimant@example.com'), 'lounges', LOUNGE),
        { claimStatus: 'pending', claimantUserId: CLAIMANT },
        { merge: true },
      ),
    );
  });

  it('refuses a non-owner editing someone else’s listing', async () => {
    await seedLounge({ ownerId: 'real-owner' });
    await assertFails(
      updateDoc(doc(member(), 'lounges', LOUNGE), { description: 'Hijacked' }),
    );
  });
});

/**
 * The 21+ age gate, at the rules layer.
 *
 * The gate is only worth something if a member cannot grant it to themselves.
 * Before this rule existed `allow write: if isOwner(userId)` let anyone set
 * their own `ageVerification.status` to 'verified' with a single request, which
 * would have made the whole feature decorative.
 */
describe('age verification rules', () => {
  const ME = 'member-1';

  async function seedUser(fields: Record<string, unknown> = {}) {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', ME), { name: 'A Member', ...fields });
    });
  }

  it('lets a member submit their own verification as pending', async () => {
    await seedUser();
    await assertSucceeds(
      setDoc(
        doc(member(ME), 'users', ME),
        { ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } },
        { merge: true },
      ),
    );
  });

  it('refuses a member marking themselves verified', async () => {
    // The property this block exists for.
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertFails(
      setDoc(
        doc(member(ME), 'users', ME),
        { ageVerification: { status: 'verified' } },
        { merge: true },
      ),
    );
  });

  it('refuses a member marking themselves rejected either', async () => {
    // Not harmful, but the rule should be about who decides, not about which
    // outcome happens to be favourable.
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertFails(
      setDoc(
        doc(member(ME), 'users', ME),
        { ageVerification: { status: 'rejected' } },
        { merge: true },
      ),
    );
  });

  it('lets an admin decide', async () => {
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertSucceeds(
      setDoc(
        doc(admin(), 'users', ME),
        { ageVerification: { status: 'verified', reviewedBy: 'admin-1' } },
        { merge: true },
      ),
    );
  });

  it('still lets a verified member edit the rest of their profile', async () => {
    // The regression the existing-vs-incoming comparison prevents: a verified
    // member's document still says 'verified' on every subsequent write, and
    // that must not be read as an attempt to grant it.
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'verified' } });
    await assertSucceeds(
      setDoc(doc(member(ME), 'users', ME), { homeCity: 'Austin, TX' }, { merge: true }),
    );
  });

  it('lets an admin read a member document to review it', async () => {
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertSucceeds(getDoc(doc(admin(), 'users', ME)));
  });

  it('does not let one member read another', async () => {
    await seedUser();
    await assertFails(getDoc(doc(member('someone-else'), 'users', ME)));
  });

  // ---------------- two-sided documents (2026-08-19) ----------------

  it('lets a member attach both sides of a card and the document type', async () => {
    // What ageVerificationService.attachIdDocument actually writes. If the rules
    // refused these newer fields the entire upload would fail silently behind a
    // "check your connection" alert.
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertSucceeds(
      setDoc(
        doc(member(ME), 'users', ME),
        {
          ageVerification: {
            documentType: 'drivers_license',
            idImageUrl: 'https://example/front.jpg',
            idBackImageUrl: 'https://example/back.jpg',
            status: 'pending',
          },
        },
        { merge: true },
      ),
    );
  });

  it('lets a rejected member resubmit, which puts them back to pending', async () => {
    // attachIdDocument clears the old decision and re-enters the queue. Going
    // rejected -> pending is a member-permitted transition; it has to be, or a
    // rejection would be permanent.
    await seedUser({
      ageVerification: {
        dateOfBirth: '1990-01-01',
        status: 'rejected',
        rejectionReason: 'Too blurry',
      },
    });
    await assertSucceeds(
      setDoc(
        doc(member(ME), 'users', ME),
        {
          ageVerification: {
            documentType: 'passport',
            idImageUrl: 'https://example/page.jpg',
            status: 'pending',
          },
        },
        { merge: true },
      ),
    );
  });

  it('lets a member record that they skipped the wall for now', async () => {
    // deferAgeVerification. A merge write that only adds deferredAt leaves status
    // as 'pending', so it is not a decision — but that depends on the rule
    // comparing incoming against existing, which is worth pinning.
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertSucceeds(
      setDoc(
        doc(member(ME), 'users', ME),
        { ageVerification: { deferredAt: new Date().toISOString() } },
        { merge: true },
      ),
    );
  });

  it('refuses a member who tries to skip straight to verified', async () => {
    // The obvious abuse of a skip button: send the deferral and the outcome
    // together and never photograph anything.
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertFails(
      setDoc(
        doc(member(ME), 'users', ME),
        { ageVerification: { deferredAt: new Date().toISOString(), status: 'verified' } },
        { merge: true },
      ),
    );
  });

  it('still refuses a member who attaches images and marks themselves verified', async () => {
    // The bypass the two-sided change could have opened: a legitimate-looking
    // upload with 'verified' smuggled in alongside it.
    await seedUser({ ageVerification: { dateOfBirth: '1990-01-01', status: 'pending' } });
    await assertFails(
      setDoc(
        doc(member(ME), 'users', ME),
        {
          ageVerification: {
            documentType: 'drivers_license',
            idImageUrl: 'https://example/front.jpg',
            idBackImageUrl: 'https://example/back.jpg',
            status: 'verified',
          },
        },
        { merge: true },
      ),
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
