/**
 * backfillFromGoogle.ts — fills in `phone` and real `hours` for every lounge,
 * using Google Places (New) alone.
 *
 * Why this exists rather than the two scripts already here: `backfillPhones.ts`
 * is Yelp-only and Yelp returned TRIAL_EXPIRED on 2026-08-20, and
 * `backfillCityHours.ts` requires *both* keys. Julian agreed the same day to go
 * Google-only instead of paying Yelp $299/month, so this needs one key and no
 * subscription.
 *
 * What was actually missing when this was written, measured not assumed:
 *   - `phone`  — absent on all 8,496 documents. Not empty: the field did not
 *                exist on a single one, despite Dr. Brinkley asking for it in
 *                the 2026-08-17 demo. LoungeDetailScreen has rendered a tappable
 *                phone row since then, waiting for data.
 *   - `hours`  — 3,416 real, 5,080 still on the literal string
 *                "Hours not yet available" (5,017 of them Yelp-sourced).
 *
 * ONE CALL PER LOUNGE. Places API (New) returns the phone number and the opening
 * hours in the same response via the field mask, so this does not need the
 * old search-then-details pair. Two different paths, though:
 *
 *   - `google-<place_id>` docs (3,328) carry the place id in their own document
 *     id, so they are fetched directly. Exact, no matching risk.
 *   - `yelp-<id>` docs (5,168) have no place id, so they go through a text
 *     search — and a text search can return the wrong business. See
 *     `isTrustworthyMatch`: writing a stranger's phone number onto a real
 *     lounge is worse than leaving the field blank, so a result is only accepted
 *     when the name genuinely corresponds AND it is within 250m of the
 *     coordinates already on file.
 *
 * SAFE BY DEFAULT: a dry run that writes nothing and reports what it would do,
 * including the exact number of billable calls. Pass --confirm to write.
 *
 * SETUP: the key in google-places-key.txt at the project root (gitignored), or
 *        GOOGLE_PLACES_API_KEY in the environment. Same serviceAccountKey.json
 *        as the other scripts.
 *
 * RUN:
 *   npm run backfill:google -- --limit 20          # 20 lounges, dry, ~free
 *   npm run backfill:google -- --limit 20 --confirm
 *   npm run backfill:google                        # full dry run, no calls saved
 *   npm run backfill:google -- --confirm           # the real thing
 *
 * RESUMABLE: anything that already has a phone is skipped, so an interrupted run
 * can simply be run again without paying for the same lookups twice.
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ---------------------------------------------------------------- setup

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const PLACES_KEY_PATH = path.join(__dirname, '..', 'google-places-key.txt');

if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing serviceAccountKey.json at the project root.');
  process.exit(1);
}

const placesKey = (
  process.env.GOOGLE_PLACES_API_KEY ??
  (fs.existsSync(PLACES_KEY_PATH) ? fs.readFileSync(PLACES_KEY_PATH, 'utf8') : '')
).trim();

if (!placesKey) {
  console.error(
    'No Google Places key. Either put it in google-places-key.txt at the project\n' +
      'root (gitignored) or pass GOOGLE_PLACES_API_KEY in the environment.',
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')) as ServiceAccount;
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const CONFIRMED = process.argv.includes('--confirm');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

/**
 * `--only yelp` or `--only google`, so each path can be sampled on its own.
 * Document ids sort with every `google-` before every `yelp-`, so a plain
 * --limit only ever exercises the exact-lookup path and never the text search —
 * which is the one that can match the wrong business.
 */
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg >= 0 ? process.argv[onlyArg + 1] : '';

/** Firestore's hard cap on writes per batch. */
const BATCH_LIMIT = 400;
/** Paced to stay well inside Places' per-minute quota. */
const DELAY_MS = 120;
/** How far a text-search result may be from the address on file. */
const MAX_MATCH_METRES = 250;

const FIELD_MASK_SEARCH =
  'places.id,places.displayName,places.nationalPhoneNumber,' +
  'places.internationalPhoneNumber,places.location,' +
  'places.regularOpeningHours.weekdayDescriptions';

const FIELD_MASK_DETAILS =
  'id,displayName,nationalPhoneNumber,internationalPhoneNumber,location,' +
  'regularOpeningHours.weekdayDescriptions';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------- matching

/**
 * Strips a business name down to its distinguishing words.
 *
 * "The Brass Peacock Cigar Lounge, LLC" and "Brass Peacock" should match; the
 * words that every lounge shares carry no information and would make almost
 * anything look similar.
 */
const NOISE = new Set([
  'the', 'a', 'an', 'and', 'of', 'llc', 'inc', 'co', 'ltd', 'corp', 'company',
  'cigar', 'cigars', 'lounge', 'shop', 'store', 'bar', 'club', 'house', 'room',
  'smoke', 'smoking', 'tobacco', 'tobacconist', 'humidor', 'gmbh', 'kg',
]);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !NOISE.has(word)),
  );
}

/** Metres between two coordinates. */
function distanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Whether a text-search hit really is the lounge we asked about.
 *
 * This is the important function in the file. A text search always returns
 * *something*, and writing the wrong business's phone number onto a real lounge
 * is worse than leaving the field empty — a member would ring a stranger. So a
 * result has to clear two independent bars: the distinguishing words in the name
 * must overlap, and it must be physically where we already believe the lounge is.
 *
 * Proximity alone is not enough (city centres are dense with similar venues) and
 * name alone is not enough (chains repeat names across cities), so both are
 * required rather than either.
 */
export function isTrustworthyMatch(
  ours: { name: string; coordinates?: { lat: number; lng: number } },
  theirs: { name: string; location?: { latitude: number; longitude: number } },
): { ok: boolean; reason: string } {
  const a = nameTokens(ours.name);
  const b = nameTokens(theirs.name);

  // Some real names consist entirely of words this file treats as noise — "The
  // Smoking Room" is a genuine lounge whose every word is generic. Stripping it
  // leaves nothing to compare, and the first version of this rejected an exact
  // name match on those grounds, which threw away good data. When there are no
  // distinguishing words left, fall back to comparing the whole normalised
  // string and lean entirely on proximity to corroborate it.
  if (a.size === 0 || b.size === 0) {
    const flat = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (flat(ours.name) && flat(ours.name) === flat(theirs.name)) {
      return nearEnough(ours, theirs, 'identical generic name');
    }
    return { ok: false, reason: 'name has no distinguishing words' };
  }
  const shared = [...a].filter(token => b.has(token)).length;
  const overlap = shared / Math.min(a.size, b.size);
  if (overlap < 0.6) {
    return { ok: false, reason: `name overlap ${(overlap * 100).toFixed(0)}%` };
  }

  return nearEnough(ours, theirs, `name ${(overlap * 100).toFixed(0)}%`, overlap);
}

/**
 * The proximity half of the check, shared by both name paths above.
 *
 * With no coordinates to compare there is nothing to corroborate a name with, so
 * only an exact name is accepted — a 60% word overlap and no location is exactly
 * the combination that produces a wrong phone number.
 */
function nearEnough(
  ours: { name: string; coordinates?: { lat: number; lng: number } },
  theirs: { name: string; location?: { latitude: number; longitude: number } },
  why: string,
  overlap = 1,
): { ok: boolean; reason: string } {
  if (!ours.coordinates || !theirs.location) {
    return overlap >= 0.99
      ? { ok: true, reason: `${why}, no coordinates to check` }
      : { ok: false, reason: 'no coordinates and name not exact' };
  }
  const metres = distanceMetres(ours.coordinates, {
    lat: theirs.location.latitude,
    lng: theirs.location.longitude,
  });
  if (metres > MAX_MATCH_METRES) {
    return { ok: false, reason: `${Math.round(metres)}m away` };
  }
  return { ok: true, reason: `${why}, ${Math.round(metres)}m` };
}

// ---------------------------------------------------------------- Places calls

type PlaceResult = {
  id?: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

let billableCalls = 0;

async function placeDetails(placeId: string): Promise<PlaceResult | null> {
  billableCalls += 1;
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': placesKey, 'X-Goog-FieldMask': FIELD_MASK_DETAILS },
  });
  if (!response.ok) {
    // 404 is ordinary: places close and Google removes them. Anything else is
    // worth surfacing, because a bad key or an exhausted quota would otherwise
    // look like thousands of lounges simply having no phone number.
    if (response.status !== 404) {
      console.warn(`  ! details ${placeId}: HTTP ${response.status} ${await response.text()}`);
    }
    return null;
  }
  return (await response.json()) as PlaceResult;
}

async function searchPlace(query: string): Promise<PlaceResult | null> {
  billableCalls += 1;
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': placesKey,
      'X-Goog-FieldMask': FIELD_MASK_SEARCH,
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!response.ok) {
    console.warn(`  ! search: HTTP ${response.status} ${await response.text()}`);
    return null;
  }
  const body = (await response.json()) as { places?: PlaceResult[] };
  return body.places?.[0] ?? null;
}

// ---------------------------------------------------------------- main

const HOURS_PLACEHOLDER = 'hours not yet available';

function hoursAreMissing(hours: unknown): boolean {
  if (typeof hours !== 'string' || hours.trim() === '') {
    return true;
  }
  return hours.toLowerCase().includes(HOURS_PLACEHOLDER);
}

async function main() {
  console.log(
    CONFIRMED
      ? '\n!!  WRITING FOR REAL. Every lookup below is a billable Places call.\n'
      : '\nDRY RUN — no writes, and the call count at the end is what a real run would cost.\n',
  );

  const snapshot = await db.collection('lounges').get();
  console.log(`${snapshot.size} lounges in the directory\n`);

  let considered = 0;
  let byPlaceId = 0;
  let bySearch = 0;
  let gotPhone = 0;
  let gotHours = 0;
  let rejected = 0;
  let notFound = 0;
  let skipped = 0;

  let batch = db.batch();
  let pending = 0;

  for (const document of snapshot.docs) {
    if (considered >= LIMIT) {
      break;
    }
    if (ONLY && !document.id.startsWith(`${ONLY}-`)) {
      continue;
    }
    const data = document.data();
    const needsPhone = !data.phone;
    const needsHours = hoursAreMissing(data.hours);
    if (!needsPhone && !needsHours) {
      skipped += 1;
      continue;
    }
    considered += 1;

    let result: PlaceResult | null = null;
    let how = '';

    if (document.id.startsWith('google-')) {
      // The place id is the document id — exact, nothing to verify.
      result = await placeDetails(document.id.slice('google-'.length));
      how = 'place id';
      byPlaceId += 1;
    } else {
      const query = [data.name, data.address, data.city].filter(Boolean).join(', ');
      const hit = await searchPlace(query);
      bySearch += 1;
      if (hit) {
        const verdict = isTrustworthyMatch(
          { name: data.name ?? '', coordinates: data.coordinates },
          { name: hit.displayName?.text ?? '', location: hit.location },
        );
        if (verdict.ok) {
          result = hit;
          how = `search (${verdict.reason})`;
        } else {
          rejected += 1;
          console.log(`  ~ rejected "${data.name}" -> "${hit.displayName?.text}" (${verdict.reason})`);
        }
      }
    }

    await sleep(DELAY_MS);

    if (!result) {
      notFound += 1;
      continue;
    }

    const updates: Record<string, unknown> = {};
    const phone = result.nationalPhoneNumber || result.internationalPhoneNumber;
    if (needsPhone && phone) {
      updates.phone = phone;
      gotPhone += 1;
    }
    const days = result.regularOpeningHours?.weekdayDescriptions;
    if (needsHours && days && days.length > 0) {
      // Same shape the existing documents already use, so nothing downstream
      // has to change: one string, days joined by "; ".
      updates.hours = days.join('; ');
      gotHours += 1;
    }
    if (Object.keys(updates).length === 0) {
      continue;
    }

    if (considered <= 12 || considered % 250 === 0) {
      console.log(
        `  ${considered}. ${data.name} [${how}] ` +
          `${updates.phone ? `phone=${updates.phone} ` : ''}` +
          `${updates.hours ? 'hours=yes' : ''}`,
      );
    }

    if (!CONFIRMED) {
      continue;
    }
    batch.update(document.ref, updates);
    pending += 1;
    if (pending === BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
      console.log(`  … committed ${BATCH_LIMIT}`);
    }
  }

  if (CONFIRMED && pending > 0) {
    await batch.commit();
  }

  console.log('\n---------------------------------------------');
  console.log(`already complete, skipped : ${skipped}`);
  console.log(`looked up                 : ${considered}`);
  console.log(`  via place id (exact)    : ${byPlaceId}`);
  console.log(`  via text search         : ${bySearch}`);
  console.log(`phone numbers found       : ${gotPhone}`);
  console.log(`opening hours found       : ${gotHours}`);
  console.log(`search hits rejected      : ${rejected}  (wrong business — deliberately not written)`);
  console.log(`nothing found at all      : ${notFound}`);
  console.log(`BILLABLE PLACES CALLS     : ${billableCalls}`);
  console.log('---------------------------------------------');
  console.log(
    CONFIRMED
      ? 'Written. Re-run any time — completed lounges are skipped.\n'
      : 'Nothing written. Add --confirm to apply.\n',
  );
  process.exit(0);
}

main().catch(error => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  console.error(`Billable calls made before failing: ${billableCalls}`);
  process.exit(1);
});
