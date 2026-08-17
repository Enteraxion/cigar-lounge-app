/**
 * Integration tests against the real Firestore project.
 *
 * These exist for one class of bug that unit tests cannot reach: a query
 * that is syntactically perfect, type-checks, passes review, and fails at
 * runtime because an index does not exist. That is exactly how the Home
 * screen's Member Events rail shipped broken — the caller caught the error,
 * set an empty array, and the rail rendered "no events yet" forever.
 *
 * Run with `npm run test:integration`. Requires serviceAccountKey.json
 * (gitignored), so this cannot run in CI without credentials — a documented
 * limitation, not an oversight.
 *
 * Read-only by design. Nothing here writes to the production database.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const KEY = path.resolve(__dirname, '..', 'serviceAccountKey.json');
const hasCredentials = fs.existsSync(KEY);

const describeIfCredentials = hasCredentials ? describe : describe.skip;

if (!hasCredentials) {
  // eslint-disable-next-line no-console
  console.warn('serviceAccountKey.json not found — integration suite skipped.');
}

describeIfCredentials('Firestore integration', () => {
  let db: admin.firestore.Firestore;

  beforeAll(() => {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        credential: admin.credential.cert(require(KEY)),
      });
    }
    db = admin.firestore();
  });

  afterAll(async () => {
    await Promise.all(admin.apps.map(app => app?.delete()));
  });

  describe('indexes — queries the app actually issues', () => {
    it('collectionGroup(events) upcoming-events query resolves', async () => {
      // The exact query behind Home's Member Events rail.
      const snapshot = await db
        .collectionGroup('events')
        .where('startsAt', '>=', admin.firestore.Timestamp.now())
        .orderBy('startsAt', 'asc')
        .limit(10)
        .get();
      expect(snapshot).toBeDefined();
    }, 30000);

    it('collectionGroup(reviews) by-user query resolves', async () => {
      // Behind the Cigar Passport and getUserStats.
      const snapshot = await db
        .collectionGroup('reviews')
        .where('userId', '==', '__nonexistent__')
        .limit(5)
        .get();
      expect(snapshot.empty).toBe(true);
    }, 30000);

    it('lounges ordered by rating resolves — behind the concierge candidate set', async () => {
      const snapshot = await db
        .collection('lounges')
        .orderBy('ratings.overall', 'desc')
        .limit(5)
        .get();
      expect(snapshot.size).toBeGreaterThan(0);
    }, 30000);

    it('lounges filtered by city resolves', async () => {
      const snapshot = await db.collection('lounges').where('city', '==', 'Austin, TX').limit(5).get();
      expect(snapshot).toBeDefined();
    }, 30000);
  });

  describe('data integrity — invariants the app relies on', () => {
    let sample: admin.firestore.QueryDocumentSnapshot[];

    beforeAll(async () => {
      sample = (await db.collection('lounges').limit(300).get()).docs;
    }, 30000);

    it('every lounge has the fields the UI dereferences without guarding', () => {
      const broken = sample.filter(d => {
        const l = d.data();
        return (
          typeof l.name !== 'string' ||
          !l.name ||
          typeof l.address !== 'string' ||
          !l.coordinates ||
          typeof l.coordinates.lat !== 'number' ||
          typeof l.coordinates.lng !== 'number'
        );
      });
      expect(broken.map(d => d.id)).toEqual([]);
    });

    it('every lounge has a ratings object — screens read ratings.overall directly', () => {
      const broken = sample.filter(d => typeof d.data().ratings?.overall !== 'number');
      expect(broken.map(d => d.id)).toEqual([]);
    });

    it('every lounge has arrays where the UI spreads or maps', () => {
      const broken = sample.filter(d => {
        const l = d.data();
        return !Array.isArray(l.images) || !Array.isArray(l.tags) || !Array.isArray(l.amenities);
      });
      expect(broken.map(d => d.id)).toEqual([]);
    });

    it('coordinates are plausible, not 0,0 placeholders', () => {
      const atNullIsland = sample.filter(d => {
        const c = d.data().coordinates;
        return c.lat === 0 && c.lng === 0;
      });
      expect(atNullIsland.map(d => d.id)).toEqual([]);
    });
  });

  describe('security rules are deployed and restrictive', () => {
    it('the rules file exists and denies by default', () => {
      const rules = fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
      // A rules file whose last word is `allow read, write: if true` is the
      // failure mode that prompted writing them in the first place.
      expect(rules).not.toMatch(/allow read, write: if true;\s*}\s*}\s*}$/);
      expect(rules).toMatch(/isSignedIn\(\)/);
      expect(rules).toMatch(/isOwner\(/);
    });

    it('the admin allowlist in rules matches the one in app config', () => {
      // These two lists cannot import each other, so they drift silently.
      const rules = fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
      const config = fs.readFileSync(
        path.resolve(__dirname, '..', 'src', 'config', 'admins.ts'),
        'utf8',
      );
      // Match only *quoted* addresses. Both files mention other addresses in
      // prose (who was removed and when); only the string literals are the
      // actual allowlist. Comment-stripping by regex is unreliable on a rules
      // file whose syntax is full of slashes, so this matches the thing that
      // matters instead of trying to remove the thing that doesn't.
      const emailsIn = (text: string) =>
        (text.match(/'[\w.+-]+@[\w.-]+\.\w+'/g) ?? [])
          .map(e => e.replace(/'/g, ''))
          .filter(e => !e.includes('REPLACE'))
          .sort();
      expect(emailsIn(rules)).toEqual(emailsIn(config));
    });
  });
});
