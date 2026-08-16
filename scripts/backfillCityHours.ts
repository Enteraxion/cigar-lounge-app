/**
 * backfillCityHours.ts — one-time bulk version of functions/src/index.ts's
 * refreshCityLounges, run across every city already in Firestore instead
 * of waiting for someone to organically re-search each one (that function
 * only refreshes a city when a real user searches it, rate-limited to
 * once per 30 days — see that file's header comment).
 *
 * Why this exists: adding Google Places to refreshCityLounges (2026-08-13)
 * only backfills real hours for a city once someone searches it again.
 * Every lounge imported before that point (most of the ~2,700 from
 * scripts/importYelpLounges.ts) would otherwise sit on the
 * "Hours not yet available" placeholder indefinitely. This runs the same
 * Yelp+Google merge once, immediately, across every distinct `city`
 * already on a lounge doc.
 *
 * Also seeds a small curated list of major international cities
 * (SEED_CITIES below) that have zero lounges yet — added per Julian
 * Brinkley's TestFlight feedback (2026-08-13: "Would be good if we had
 * major international cities like Munich, London, Berlin, Madrid, etc.").
 * SearchSuggestionsScreen's "Cities" list is ranked purely by real lounge
 * count per city (see loungeService.ts's getDistinctCities) — there's no
 * hardcoded/fake entry point for it, so a city can only appear there once
 * it actually has real data. Note: `isKnownUsCityName` (cityAutocomplete.ts)
 * already coincidentally lets a live in-app search of these exact city
 * names through too — the bundled US Census dataset happens to contain
 * small identically-named US towns (Munich ND, Madrid IA, etc.), so
 * `isKnownUsCityName` returns true and the query string (e.g. "Munich,
 * Germany") passes through to Yelp/Google as-is, which resolve it
 * correctly since it's an unambiguous, fully-qualified location string.
 * This script just seeds them once up front instead of waiting on that.
 *
 * Same admin-init pattern as seedFirestore.ts/importYelpLounges.ts.
 * Merge logic duplicated from functions/src/index.ts rather than
 * imported, same reasoning as that file's own header comment (Firebase
 * only deploys the functions/ directory; scripts/ only deploys via this
 * file directly, run locally).
 *
 * ---------------------------------------------------------------------
 * SETUP:
 *   1. Same serviceAccountKey.json as seedFirestore.ts/importYelpLounges.ts.
 *   2. The same two API keys already used server-side — pass them as env
 *      vars (never paste real keys into chat/commands run by anyone else):
 *        YELP_API_KEY=xxxxx GOOGLE_PLACES_API_KEY=xxxxx npm run backfill:hours
 *
 * Idempotent: same yelp-<id>/google-<place_id> doc ids and `.set(...,
 * {merge:true})` as the live function, so re-running just re-applies the
 * same merge rather than duplicating anything — safe to run again even
 * though it already ran once for the pre-existing 732 cities.
 *
 * RUN:
 *   npm run backfill:hours
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import type { LoungeDocument } from '../src/types/firestore';

// ---------------------------------------------------------------------------
// Admin SDK init (mirrors seedFirestore.ts/importYelpLounges.ts)
// ---------------------------------------------------------------------------

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`\nNo service account key found at:\n  ${serviceAccountPath}\n`);
  process.exit(1);
}

const YELP_API_KEY = process.env.YELP_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!YELP_API_KEY || !GOOGLE_PLACES_API_KEY) {
  console.error('\nMissing YELP_API_KEY and/or GOOGLE_PLACES_API_KEY env vars.\n');
  console.error('  YELP_API_KEY=xxxxx GOOGLE_PLACES_API_KEY=xxxxx npm run backfill:hours\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount & {
  project_id: string;
};

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Same constants as functions/src/index.ts
const CATEGORY = 'cigarbars,hookah_bars';
const PAGE_SIZE = 50;
const MAX_RESULTS = 200;
const MATCH_DISTANCE_MILES = 0.2;
const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
// Politeness delay between cities — neither API documents a hard per-second
// cap at this scale, but there's no reason to hammer both concurrently
// across dozens of cities in a tight loop.
const DELAY_BETWEEN_CITIES_MS = 400;

// ---------------------------------------------------------------------------
// Yelp Fusion Business Search — same shape as functions/src/index.ts
// ---------------------------------------------------------------------------

type YelpBusiness = {
  id: string;
  name: string;
  is_closed: boolean;
  rating?: number;
  review_count?: number;
  price?: string;
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

async function fetchAllYelpResults(location: string): Promise<YelpBusiness[]> {
  const all: YelpBusiness[] = [];
  let offset = 0;
  while (offset < MAX_RESULTS) {
    const page = await fetchYelpPage(location, offset);
    all.push(...page.businesses);
    offset += PAGE_SIZE;
    if (offset >= page.total || page.businesses.length === 0) {
      break;
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Google Places (New) Text Search — same shape as functions/src/index.ts
// ---------------------------------------------------------------------------

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

type GoogleSearchResponse = {
  places?: GooglePlace[];
  error?: { code: number; message: string; status: string };
};

async function fetchGooglePlaces(location: string): Promise<GooglePlace[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours',
    },
    body: JSON.stringify({ textQuery: `cigar lounge in ${location}`, maxResultCount: 20 }),
  });
  const data = (await response.json()) as GoogleSearchResponse;
  if (data.error) {
    throw new Error(`Google Places API error (${data.error.status}): ${data.error.message}`);
  }
  if (!response.ok) {
    throw new Error(`Google Places API HTTP ${response.status}`);
  }
  return data.places ?? [];
}

function haversineDistanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ---------------------------------------------------------------------------
// Mapping onto LoungeDocument — same as functions/src/index.ts
// ---------------------------------------------------------------------------

function ratingsFromYelp(rating: number | undefined) {
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

function toLoungeDocument(business: YelpBusiness, hours: string, now: Timestamp): LoungeDocument {
  const images = business.image_url ? [business.image_url] : [];
  return {
    name: business.name,
    description: '',
    address: business.location.display_address.join(', '),
    coordinates: { lat: business.coordinates.latitude, lng: business.coordinates.longitude },
    hours,
    status: business.is_closed ? 'closed' : 'open',
    images,
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

function toLoungeDocumentFromGoogle(place: GooglePlace, hours: string, now: Timestamp): LoungeDocument {
  return {
    name: place.displayName?.text ?? 'Unnamed Lounge',
    description: '',
    address: place.formattedAddress ?? '',
    coordinates: { lat: place.location?.latitude ?? 0, lng: place.location?.longitude ?? 0 },
    hours,
    status: 'open',
    images: [],
    amenities: [],
    tags: ['imported-from-google'],
    priceRange: '',
    ratings: ratingsFromYelp(undefined),
    reviewCount: 0,
    humidorItems: [],
    createdAt: now,
    updatedAt: now,
  };
}

function slugifyCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Major international cities with no lounges yet — see this file's header
// comment for why (Julian Brinkley's TestFlight feedback, 2026-08-13).
// Full "City, Country" strings so Yelp/Google resolve them unambiguously.
const SEED_CITIES = [
  'Munich, Germany',
  'Berlin, Germany',
  'Madrid, Spain',
  'London, UK',
  'Paris, France',
  'Rome, Italy',
  'Barcelona, Spain',
  'Amsterdam, Netherlands',
];

async function getDistinctCities(): Promise<string[]> {
  const snapshot = await db.collection('lounges').get();
  const cities = new Set<string>(SEED_CITIES);
  snapshot.forEach(doc => {
    const city = (doc.data() as LoungeDocument).city;
    if (city) {
      cities.add(city);
    }
  });
  return Array.from(cities).sort();
}

async function refreshCity(city: string, now: Timestamp): Promise<{ yelp: number; google: number; matched: number }> {
  const [businesses, googlePlaces] = await Promise.all([
    fetchAllYelpResults(city),
    fetchGooglePlaces(city).catch(error => {
      console.error(`  Google Places failed for ${city}: ${(error as Error).message}`);
      return [];
    }),
  ]);

  const googleByName = new Map<string, GooglePlace[]>();
  for (const place of googlePlaces) {
    const key = normalizeName(place.displayName?.text ?? '');
    const bucket = googleByName.get(key) ?? [];
    bucket.push(place);
    googleByName.set(key, bucket);
  }

  const batch = db.batch();
  const matchedGoogleIds = new Set<string>();

  for (const business of businesses) {
    const candidates = googleByName.get(normalizeName(business.name)) ?? [];
    const match = candidates.find(
      candidate =>
        candidate.location &&
        haversineDistanceMiles(
          { lat: business.coordinates.latitude, lng: business.coordinates.longitude },
          { lat: candidate.location.latitude, lng: candidate.location.longitude },
        ) <= MATCH_DISTANCE_MILES,
    );
    const hours = match?.regularOpeningHours?.weekdayDescriptions?.join('; ') ?? 'Hours not yet available';
    if (match) {
      matchedGoogleIds.add(match.id);
    }
    batch.set(db.collection('lounges').doc(`yelp-${business.id}`), toLoungeDocument(business, hours, now), {
      merge: true,
    });
  }

  for (const place of googlePlaces) {
    if (matchedGoogleIds.has(place.id) || !place.location) {
      continue;
    }
    const hours = place.regularOpeningHours?.weekdayDescriptions?.join('; ') ?? 'Hours not yet available';
    batch.set(db.collection('lounges').doc(`google-${place.id}`), toLoungeDocumentFromGoogle(place, hours, now), {
      merge: true,
    });
  }

  batch.set(db.collection('cityRefreshes').doc(slugifyCity(city)), { lastRefreshedAt: now, city });
  await batch.commit();

  return { yelp: businesses.length, google: googlePlaces.length, matched: matchedGoogleIds.size };
}

async function main() {
  const cities = await getDistinctCities();
  console.log(`Found ${cities.length} distinct cities (existing + seed list).\n`);

  const now = Timestamp.now();
  let citiesProcessed = 0;
  let citiesSkipped = 0;
  let citiesFailed = 0;

  for (const city of cities) {
    // Re-running this script (e.g. just to add SEED_CITIES) shouldn't
    // re-hit both APIs for every city already refreshed within the same
    // window the live refreshCityLounges function itself respects.
    const refreshDoc = await db.collection('cityRefreshes').doc(slugifyCity(city)).get();
    const lastRefreshedAt = refreshDoc.data()?.lastRefreshedAt as Timestamp | undefined;
    if (lastRefreshedAt && now.toMillis() - lastRefreshedAt.toMillis() < REFRESH_INTERVAL_MS) {
      citiesSkipped += 1;
      continue;
    }

    console.log(`Refreshing ${city}...`);
    try {
      const result = await refreshCity(city, now);
      console.log(
        `  Yelp: ${result.yelp}, Google: ${result.google}, matched: ${result.matched}, ` +
          `new-from-google: ${result.google - result.matched}`,
      );
      citiesProcessed += 1;
    } catch (error) {
      console.error(`  Failed: ${(error as Error).message}`);
      citiesFailed += 1;
    }
    await delay(DELAY_BETWEEN_CITIES_MS);
  }

  console.log(
    `\nDone — ${citiesProcessed} cities refreshed, ${citiesSkipped} already-fresh cities skipped, ${citiesFailed} failed.`,
  );
}

main().catch(error => {
  console.error('\nBackfill failed:', error);
  process.exit(1);
});
