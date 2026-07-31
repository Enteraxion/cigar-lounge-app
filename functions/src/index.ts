/**
 * refreshCityLounges — Cloud Function backing "live refresh" search.
 *
 * The Yelp API key can't live in the mobile app bundle (anyone could
 * extract it and burn through/abuse the quota), so this function holds
 * it server-side as a Firebase secret. The app calls this (via
 * @react-native-firebase/functions) when someone searches a city; it
 * re-queries Yelp for that city and upserts results into the same
 * `lounges` collection scripts/importYelpLounges.ts populates — same
 * doc shape, same `yelp-<place_id>` ids, so this is just that script's
 * per-city logic re-run automatically instead of by hand.
 *
 * Rate-limited per city via `cityRefreshes/{citySlug}` — a city already
 * refreshed within the last 30 days is skipped, so repeat searches for
 * the same city don't re-hit Yelp when the data's still fresh (shop
 * details don't change often enough to need daily re-pulls).
 *
 * DEPLOY:
 *   firebase functions:secrets:set YELP_API_KEY   (one-time, or when it changes)
 *   npm --prefix functions run build && firebase deploy --only functions
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const yelpApiKey = defineSecret('YELP_API_KEY');

const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
// Yelp's own `cigarbars` category is narrow — a lot of real cigar
// lounges (especially in smaller cities) get listed under `hookah_bars`
// instead. Searching both (Yelp treats a comma-separated categories
// list as OR) catches more real venues without pulling in unrelated
// nightlife categories like plain `bars`/`lounges`.
const CATEGORY = 'cigarbars,hookah_bars';
const PAGE_SIZE = 50;
const MAX_RESULTS = 200;

// ---------------------------------------------------------------------------
// Yelp Fusion Business Search — same shape as scripts/importYelpLounges.ts
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

async function fetchYelpPage(
  apiKey: string,
  location: string,
  offset: number,
): Promise<YelpSearchResponse> {
  const url = new URL('https://api.yelp.com/v3/businesses/search');
  url.searchParams.set('location', location);
  url.searchParams.set('categories', CATEGORY);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = (await response.json()) as YelpSearchResponse;

  if (data.error) {
    throw new Error(`Yelp API error (${data.error.code}): ${data.error.description}`);
  }
  return data;
}

async function fetchAllResults(apiKey: string, location: string): Promise<YelpBusiness[]> {
  const all: YelpBusiness[] = [];
  let offset = 0;
  while (offset < MAX_RESULTS) {
    const page = await fetchYelpPage(apiKey, location, offset);
    all.push(...page.businesses);
    offset += PAGE_SIZE;
    if (offset >= page.total || page.businesses.length === 0) {
      break;
    }
  }
  return all;
}

// NOTE: Yelp's Business Details endpoint (one extra API call per
// business) does technically return a `photos` array, but for standard
// Fusion API access it comes back empty regardless of the business —
// Yelp restricts multi-photo display to partners with a separate display
// license (see their API Terms of Use / Display Requirements). Verified
// live against a 1,147-review business and got `"photos": []`, so this
// isn't worth an extra paid API call per business — `image_url` from
// Business Search remains the only photo we can actually get.

// ---------------------------------------------------------------------------
// Mapping onto the app's LoungeDocument shape (see src/types/firestore.ts —
// duplicated here rather than imported, since Firebase only deploys this
// `functions/` directory, not the rest of the repo)
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

function toLoungeDocument(business: YelpBusiness, now: Timestamp) {
  const images = business.image_url ? [business.image_url] : [];
  return {
    name: business.name,
    description: '',
    address: business.location.display_address.join(', '),
    coordinates: { lat: business.coordinates.latitude, lng: business.coordinates.longitude },
    hours: 'Hours not yet available',
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

function slugifyCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Callable function
// ---------------------------------------------------------------------------

export const refreshCityLounges = onCall(
  { secrets: [yelpApiKey] },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const city = String(request.data?.city ?? '').trim();
    if (!city) {
      throw new HttpsError('invalid-argument', 'city is required.');
    }

    const citySlug = slugifyCity(city);
    const refreshRef = db.collection('cityRefreshes').doc(citySlug);
    const refreshDoc = await refreshRef.get();
    const lastRefreshedAt = refreshDoc.data()?.lastRefreshedAt as Timestamp | undefined;

    if (lastRefreshedAt && Date.now() - lastRefreshedAt.toMillis() < REFRESH_INTERVAL_MS) {
      return { refreshed: false, reason: 'cached', city };
    }

    const businesses = await fetchAllResults(yelpApiKey.value(), city);
    const now = Timestamp.now();

    const batch = db.batch();
    for (const business of businesses) {
      const docRef = db.collection('lounges').doc(`yelp-${business.id}`);
      batch.set(docRef, toLoungeDocument(business, now), { merge: true });
    }
    batch.set(refreshRef, { lastRefreshedAt: now, city });
    await batch.commit();

    return { refreshed: true, city, count: businesses.length };
  },
);
