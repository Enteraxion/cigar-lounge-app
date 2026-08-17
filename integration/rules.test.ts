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
import { doc, setDoc, addDoc, collection, getDoc } from 'firebase/firestore';

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
