/**
 * importYelpLounges.ts — pulls real cigar lounges/shops from the Yelp
 * Fusion API for a list of major cities and upserts them into
 * Firestore's `lounges` collection, using the same schema/admin-init
 * pattern as seedFirestore.ts.
 *
 * Yelp over Google Places: Yelp Fusion is free (no billing/credit card
 * required, just a developer signup) and has a dedicated "Cigar Bars"
 * category, which is a better match for this app than a generic Places
 * text search.
 *
 * ---------------------------------------------------------------------
 * SETUP:
 *
 *   1. Same `serviceAccountKey.json` as seedFirestore.ts (see that
 *      file's header for how to generate one).
 *   2. Sign up at https://www.yelp.com/developers, create an app under
 *      "Manage App" to get an API key (this is instant, free, no
 *      billing/card needed).
 *   3. Set it as an env var:
 *        YELP_API_KEY=xxxxx npm run import:lounges
 *
 * WHAT THIS DOES NOT DO (yet — deliberately out of scope for this pass):
 *   - Full operating hours (Yelp's search endpoint doesn't return them;
 *     would need a separate Business Details call per result).
 *   - Photos beyond Yelp's single `image_url` thumbnail — full photo
 *     sets need a separate paid Yelp endpoint.
 *   - Humidor inventory / custom rating categories — Yelp has no
 *     concept of these; they stay empty until a shop owner claims and
 *     fills in their listing (a separate, not-yet-built feature).
 *   - De-duplication against the ~17 hand-authored seedFirestore.ts
 *     lounges — those keep their existing ids and just sit alongside
 *     whatever this imports; if the same real-world place happens to be
 *     in both, you'd see it twice until that's reconciled.
 *
 * Idempotent like seedFirestore.ts: each doc's id is derived from
 * Yelp's stable business `id` (`yelp-<id>`), and writes use `.set()`
 * with `{ merge: true }`, so re-running updates existing docs rather
 * than duplicating them.
 *
 * RUN:
 *   npm run import:lounges
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import type { LoungeDocument, LoungeRatings } from '../src/types/firestore';

// ---------------------------------------------------------------------------
// Admin SDK init (mirrors seedFirestore.ts)
// ---------------------------------------------------------------------------

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`\nNo service account key found at:\n  ${serviceAccountPath}\n`);
  console.error(
    'Generate one from Firebase Console -> Project Settings -> Service Accounts -> ' +
      'Generate new private key, save it as serviceAccountKey.json in the project root ' +
      '(or set FIREBASE_SERVICE_ACCOUNT_PATH). See seedFirestore.ts for details.\n',
  );
  process.exit(1);
}

const YELP_API_KEY = process.env.YELP_API_KEY;

if (!YELP_API_KEY) {
  console.error('\nMissing YELP_API_KEY env var.\n');
  console.error('Get a free key at https://www.yelp.com/developers (Manage App), then:');
  console.error('  YELP_API_KEY=xxxxx npm run import:lounges\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount & {
  project_id: string;
};

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// Cities to search. This is a stopgap, hand-picked list (top US metro
// areas by population, plus London) — it will never be true nationwide
// coverage since it can only ever include cities someone thought to add
// ahead of time. Real "any US city" coverage needs the live per-search
// refresh instead (see functions/src/index.ts's refreshCityLounges,
// currently undeployed pending a Firebase Blaze plan decision — see the
// blaze_plan_decision memory / conversation with Julian Brinkley).
// ---------------------------------------------------------------------------

const CITIES = [
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Phoenix, AZ',
  'Philadelphia, PA',
  'San Antonio, TX',
  'San Diego, CA',
  'Dallas, TX',
  'Austin, TX',
  'Jacksonville, FL',
  'Fort Worth, TX',
  'San Jose, CA',
  'Columbus, OH',
  'Charlotte, NC',
  'Indianapolis, IN',
  'San Francisco, CA',
  'Seattle, WA',
  'Denver, CO',
  'Oklahoma City, OK',
  'Nashville, TN',
  'Washington, DC',
  'El Paso, TX',
  'Las Vegas, NV',
  'Boston, MA',
  'Detroit, MI',
  'Portland, OR',
  'Memphis, TN',
  'Louisville, KY',
  'Baltimore, MD',
  'Milwaukee, WI',
  'Albuquerque, NM',
  'Tucson, AZ',
  'Fresno, CA',
  'Sacramento, CA',
  'Kansas City, MO',
  'Atlanta, GA',
  'Miami, FL',
  'Raleigh, NC',
  'Omaha, NE',
  'Colorado Springs, CO',
  'Long Beach, CA',
  'Virginia Beach, VA',
  'Oakland, CA',
  'Minneapolis, MN',
  'Tulsa, OK',
  'Tampa, FL',
  'New Orleans, LA',
  'Wichita, KS',
  'Cleveland, OH',
  'Bakersfield, CA',
  'Honolulu, HI',
  'Greenville, SC',
  'Charleston, SC',
  'Richmond, VA',
  'Salt Lake City, UT',
  'Cincinnati, OH',
  'Pittsburgh, PA',
  'St. Louis, MO',
  'Orlando, FL',
  'London, UK',
];

const CATEGORY = 'cigarbars';
const PAGE_SIZE = 50; // Yelp's max per request
const MAX_PER_CITY = 200; // Yelp caps total offset+limit at 1000; this keeps us well under it per city

// ---------------------------------------------------------------------------
// Yelp Fusion Business Search types — only the fields we use
// ---------------------------------------------------------------------------

type YelpBusiness = {
  id: string;
  name: string;
  is_closed: boolean;
  rating?: number;
  review_count?: number;
  price?: string; // e.g. "$$"
  coordinates: { latitude: number; longitude: number };
  location: { display_address: string[]; city?: string; state?: string };
  image_url?: string;
};

type YelpSearchResponse = {
  businesses: YelpBusiness[];
  total: number;
  error?: { code: string; description: string };
};

async function fetchYelpPage(location: string, offset: number): Promise<YelpSearchResponse> {
  const url = new URL('https://api.yelp.com/v3/businesses/search');
  url.searchParams.set('location', location);
  url.searchParams.set('categories', CATEGORY);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${YELP_API_KEY}` },
  });
  const data = (await response.json()) as YelpSearchResponse;

  if (data.error) {
    throw new Error(`Yelp API error (${data.error.code}): ${data.error.description}`);
  }

  return data;
}

async function fetchAllResultsForCity(city: string): Promise<YelpBusiness[]> {
  const all: YelpBusiness[] = [];
  let offset = 0;

  while (offset < MAX_PER_CITY) {
    const page = await fetchYelpPage(city, offset);
    all.push(...page.businesses);
    offset += PAGE_SIZE;
    if (offset >= page.total || page.businesses.length === 0) {
      break;
    }
  }

  return all;
}

// ---------------------------------------------------------------------------
// Map a Yelp business onto our LoungeDocument shape
// ---------------------------------------------------------------------------

/**
 * Yelp only gives us one overall rating — every per-category score in
 * our schema mirrors it as a starting point until real reviews (or a
 * claimed owner) provide actual per-category data.
 */
function ratingsFromYelp(rating: number | undefined): LoungeRatings {
  const overall = rating ?? 0;
  return {
    overall,
    atmosphere: overall,
    humidorVariety: overall,
    service: overall,
    comfort: overall,
    ventilation: overall,
    wifiSpeed: overall,
    businessFriendly: overall,
    foodDrinksQuality: overall,
    socialScene: overall,
    parking: overall,
  };
}

function toLoungeDocument(business: YelpBusiness, now: Timestamp): LoungeDocument {
  return {
    name: business.name,
    description: '',
    address: business.location.display_address.join(', '),
    coordinates: { lat: business.coordinates.latitude, lng: business.coordinates.longitude },
    hours: 'Hours not yet available',
    status: business.is_closed ? 'closed' : 'open',
    images: business.image_url ? [business.image_url] : [],
    amenities: [],
    tags: ['imported-from-yelp'],
    priceRange: business.price ?? '',
    ratings: ratingsFromYelp(business.rating),
    reviewCount: business.review_count ?? 0,
    humidorItems: [],
    createdAt: now,
    updatedAt: now,
    city:
      business.location.city && business.location.state
        ? `${business.location.city}, ${business.location.state}`
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const now = Timestamp.now();
  let totalWritten = 0;

  for (const city of CITIES) {
    console.log(`\nSearching "${CATEGORY}" near ${city}...`);
    const results = await fetchAllResultsForCity(city);
    console.log(`  found ${results.length} places`);

    for (const business of results) {
      const docId = `yelp-${business.id}`;
      const loungeDoc = toLoungeDocument(business, now);
      await db.collection('lounges').doc(docId).set(loungeDoc, { merge: true });
      totalWritten += 1;
    }
  }

  console.log(`\nDone — upserted ${totalWritten} lounges across ${CITIES.length} cities.`);
}

main().catch(error => {
  console.error('\nImport failed:', error);
  process.exit(1);
});
