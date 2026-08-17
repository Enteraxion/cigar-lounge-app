/**
 * refreshCityLounges — Cloud Function backing "live refresh" search.
 *
 * The Yelp/Google API keys can't live in the mobile app bundle (anyone
 * could extract them and burn through/abuse the quota), so this function
 * holds them server-side as Firebase secrets. The app calls this (via
 * @react-native-firebase/functions) when someone searches a city; it
 * re-queries Yelp AND Google Places for that city and upserts results
 * into the same `lounges` collection scripts/importYelpLounges.ts
 * populates — same doc shape, same `yelp-<place_id>` ids for Yelp results,
 * so this is just that script's per-city logic re-run automatically
 * instead of by hand, now with Google Places merged in too.
 *
 * Combining both sources (per Julian Brinkley's direction, 2026-08-10):
 * Yelp and Google Places each return partial info — Yelp has strong
 * ratings/review-count/price-tier data but no real hours without an
 * extra paid Business Details call (see the NOTE below on photos, same
 * restriction applies to hours); Google Places returns real structured
 * opening hours cheaply. So for any business both sources agree on
 * (matched by name + within ~0.2mi), we keep Yelp's rating/price/reviews
 * but take real hours from Google instead of the "Hours not yet
 * available" placeholder. Google-only results (no Yelp match — smaller
 * towns/global coverage Yelp doesn't cover as well) are added as their
 * own docs (`google-<place_id>`).
 *
 * Rate-limited per city via `cityRefreshes/{citySlug}` — a city already
 * refreshed within the last 30 days is skipped, so repeat searches for
 * the same city don't re-hit either API when the data's still fresh
 * (shop details don't change often enough to need daily re-pulls).
 *
 * DEPLOY:
 *   firebase functions:secrets:set YELP_API_KEY            (one-time, or when it changes)
 *   firebase functions:secrets:set GOOGLE_PLACES_API_KEY    (one-time, or when it changes)
 *   npm --prefix functions run build && firebase deploy --only functions
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';
import {
  amenitiesFromGoogle,
  isRelevantGooglePlace,
  isRelevantYelpBusiness,
  normalizeName,
  type GooglePlace,
  type YelpBusiness,
} from './relevance';
import { optionalString, requireEmail, requireString } from './validation';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import sgMail from '@sendgrid/mail';

initializeApp();
const db = getFirestore();

const yelpApiKey = defineSecret('YELP_API_KEY');
const googlePlacesApiKey = defineSecret('GOOGLE_PLACES_API_KEY');
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
// Yelp's own `cigarbars` category is narrow — a lot of real cigar
// lounges (especially in smaller cities) get listed under `hookah_bars`
// instead. Searching both (Yelp treats a comma-separated categories
// list as OR) catches more real venues without pulling in unrelated
// nightlife categories like plain `bars`/`lounges`.
const CATEGORY = 'cigarbars,hookah_bars';
const PAGE_SIZE = 50;
const MAX_RESULTS = 200;
// Same-business match threshold when reconciling a Yelp result against
// Google Places results for the same city — two listings within this
// distance of each other are treated as the same real-world venue.
const MATCH_DISTANCE_MILES = 0.2;

// ---------------------------------------------------------------------------
// Yelp Fusion Business Search — same shape as scripts/importYelpLounges.ts
// ---------------------------------------------------------------------------


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

async function fetchAllYelpResults(apiKey: string, location: string): Promise<YelpBusiness[]> {
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
// Google Places (New) Text Search — supplies real opening hours and
// catches businesses Yelp doesn't have listed (smaller towns/global).
// ---------------------------------------------------------------------------



type GoogleSearchResponse = {
  places?: GooglePlace[];
  error?: { code: number; message: string; status: string };
};

async function fetchGooglePlaces(apiKey: string, location: string): Promise<GooglePlace[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // places.photos matters more than it looks: without it every
      // Google-sourced lounge stored images:[] and the app rendered a
      // blank box where the photo goes. Yelp returns a photo by default,
      // Google only if asked — which is why exactly the Google half of
      // the directory had no pictures.
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,' +
        'places.regularOpeningHours,places.primaryType,places.photos,' +
        // Atmosphere-tier fields — see amenitiesFromGoogle. These move the
        // request into a higher-priced Places SKU, which is a deliberate
        // trade: without them the app's Amenities/Entertainment filters
        // cannot work at all.
        'places.outdoorSeating,places.liveMusic,places.servesCocktails,places.servesCoffee,' +
        'places.goodForWatchingSports,places.goodForGroups,places.reservable,places.parkingOptions',
    },
    body: JSON.stringify({
      textQuery: `cigar lounge in ${location}`,
      maxResultCount: 20,
    }),
  });
  const data = (await response.json()) as GoogleSearchResponse;
  if (data.error) {
    // Places (New) returns 200-with-error-body in some cases as well as
    // real HTTP error codes — check both so a bad/restricted key or a
    // not-yet-enabled API doesn't silently look like "zero results."
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
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

/**
 * Turns a Places photo resource name into a URL the app can render.
 *
 * The obvious approach — building a `.../media?key=...` URL and storing it
 * — would bake our API key into 3,000 public Firestore documents, i.e.
 * publish it. Asking with `skipHttpRedirect` instead returns the underlying
 * googleusercontent URI, which needs no key, and that is what gets stored.
 *
 * Best-effort by design: one extra request per lounge, and a lounge with no
 * usable photo just keeps an empty images array and falls back to curated
 * artwork in the app (src/utils/loungeImage.ts). Never worth failing a
 * whole city refresh over.
 */
async function resolveGooglePhotoUri(
  apiKey: string,
  photoName: string,
): Promise<string | null> {
  try {
    const url =
      `https://places.googleapis.com/v1/${photoName}/media` +
      `?maxWidthPx=1200&skipHttpRedirect=true&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { photoUri?: string };
    return data.photoUri ?? null;
  } catch {
    return null;
  }
}


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

function toLoungeDocument(business: YelpBusiness, hours: string, now: Timestamp) {
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

function toLoungeDocumentFromGoogle(
  place: GooglePlace,
  hours: string,
  now: Timestamp,
  images: string[] = [],
) {
  const amenities = amenitiesFromGoogle(place);
  return {
    name: place.displayName?.text ?? 'Unnamed Lounge',
    description: '',
    address: place.formattedAddress ?? '',
    coordinates: { lat: place.location?.latitude ?? 0, lng: place.location?.longitude ?? 0 },
    hours,
    status: 'open' as const,
    images,
    amenities,
    // The amenities double as tags so they're visible on cards, not just
    // filterable — displayTags strips the internal imported-from-* marker.
    tags: ['imported-from-google', ...amenities],
    priceRange: '',
    ratings: ratingsFromYelp(undefined),
    reviewCount: 0,
    humidorItems: [] as never[],
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

// ---------------------------------------------------------------------------
// Callable function
// ---------------------------------------------------------------------------

export const refreshCityLounges = onCall(
  { secrets: [yelpApiKey, googlePlacesApiKey] },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    // Bounded, and rejected outright if it contains anything a city name
    // never does. This value reaches an outbound HTTP query string, so
    // "present" was never a sufficient check.
    const city = requireString(request.data?.city, 'city', 100);
    // A literal space rather than \s: \s matches newlines and tabs, and a
    // city name containing either is not a city name — it is someone
    // probing what this field forwards.
    if (!/^[\p{L}\p{M} .,'’&()-]+$/u.test(city)) {
      throw new HttpsError('invalid-argument', 'city contains unsupported characters.');
    }

    return guarded('refreshCityLounges', async () => {
    const citySlug = slugifyCity(city);
    const refreshRef = db.collection('cityRefreshes').doc(citySlug);
    const refreshDoc = await refreshRef.get();
    const lastRefreshedAt = refreshDoc.data()?.lastRefreshedAt as Timestamp | undefined;

    if (lastRefreshedAt && Date.now() - lastRefreshedAt.toMillis() < REFRESH_INTERVAL_MS) {
      return { refreshed: false, reason: 'cached', city };
    }

    const [businesses, googlePlaces] = await Promise.all([
      fetchAllYelpResults(yelpApiKey.value(), city),
      // Best-effort — a Google Places outage/quota issue shouldn't block
      // the Yelp-only refresh that already worked fine before this merge.
      fetchGooglePlaces(googlePlacesApiKey.value(), city).catch(error => {
        logger.error('Google Places fetch failed', { city, error: String(error) });
        return [];
      }),
    ]);
    // Drop results that each API's own categories say aren't cigar venues,
    // before any matching or writing happens.
    const relevantBusinesses = businesses.filter(isRelevantYelpBusiness);
    const relevantGooglePlaces = googlePlaces.filter(isRelevantGooglePlace);
    logger.info('Fetched source results', {
      city,
      yelpCount: businesses.length,
      googleCount: googlePlaces.length,
      yelpRejected: businesses.length - relevantBusinesses.length,
      googleRejected: googlePlaces.length - relevantGooglePlaces.length,
    });

    // Index Google results by normalized name for matching against Yelp.
    const googleByName = new Map<string, GooglePlace[]>();
    for (const place of relevantGooglePlaces) {
      const key = normalizeName(place.displayName?.text ?? '');
      const bucket = googleByName.get(key) ?? [];
      bucket.push(place);
      googleByName.set(key, bucket);
    }

    const now = Timestamp.now();
    const batch = db.batch();
    const matchedGoogleIds = new Set<string>();

    for (const business of relevantBusinesses) {
      const candidates = googleByName.get(normalizeName(business.name)) ?? [];
      const match = candidates.find(
        candidate =>
          candidate.location &&
          haversineDistanceMiles(
            { lat: business.coordinates.latitude, lng: business.coordinates.longitude },
            { lat: candidate.location.latitude, lng: candidate.location.longitude },
          ) <= MATCH_DISTANCE_MILES,
      );

      const hours =
        match?.regularOpeningHours?.weekdayDescriptions?.join('; ') ?? 'Hours not yet available';
      if (match) {
        matchedGoogleIds.add(match.id);
      }

      const docRef = db.collection('lounges').doc(`yelp-${business.id}`);
      batch.set(docRef, toLoungeDocument(business, hours, now), { merge: true });
    }

    // Google-only businesses (no Yelp match) — new venues Yelp doesn't cover.
    const googleOnly = relevantGooglePlaces.filter(
      place => !matchedGoogleIds.has(place.id) && place.location,
    );
    // Photo URIs resolve in parallel — one extra request each, and they're
    // independent, so doing them serially would add seconds per city for
    // no reason.
    const photoUris = await Promise.all(
      googleOnly.map(place => {
        const photoName = place.photos?.[0]?.name;
        return photoName
          ? resolveGooglePhotoUri(googlePlacesApiKey.value(), photoName)
          : Promise.resolve(null);
      }),
    );
    googleOnly.forEach((place, index) => {
      const hours =
        place.regularOpeningHours?.weekdayDescriptions?.join('; ') ?? 'Hours not yet available';
      const uri = photoUris[index];
      const docRef = db.collection('lounges').doc(`google-${place.id}`);
      batch.set(docRef, toLoungeDocumentFromGoogle(place, hours, now, uri ? [uri] : []), {
        merge: true,
      });
    });

    batch.set(refreshRef, { lastRefreshedAt: now, city });
    await batch.commit();

    logger.info('Merge complete', {
      city,
      yelpCount: relevantBusinesses.length,
      googleCount: relevantGooglePlaces.length,
      matchedCount: matchedGoogleIds.size,
      googleOnlyAdded: relevantGooglePlaces.filter(p => !matchedGoogleIds.has(p.id)).length,
    });

    return {
      refreshed: true,
      city,
      count:
        relevantBusinesses.length +
        relevantGooglePlaces.filter(p => !matchedGoogleIds.has(p.id)).length,
    };
    });
  },
);

// ---------------------------------------------------------------------------
// sendClaimInquiryEmail — notifies sales of a "Claim Business" inquiry
// ---------------------------------------------------------------------------

// Real sales inbox, per Sean's email to Rohith (2026-08-10). FROM_EMAIL is
// still a placeholder — it needs to be an address whose domain is verified
// as a sender in SendGrid once SENDGRID_API_KEY is a real key, otherwise
// SendGrid will reject the send regardless of the API key being valid.
const SALES_INQUIRY_EMAIL = 'sean@joalcigar.com';
const FROM_EMAIL = 'no-reply@REPLACE_WITH_REAL_DOMAIN.com';

/**
 * Emails the sales team a business's claim inquiry (see
 * src/screens/ClaimListingScreen.tsx) — there is no in-app payment (per
 * Julian Brinkley's direction, 2026-08-10); the $399/month + free kiosk
 * deal is closed by sales outside the app. This is best-effort from the
 * client's side — the claim itself is already recorded in Firestore by
 * ownerService.submitLoungeClaim before this is called, so a failure here
 * doesn't lose the inquiry, just delays sales finding out about it.
 *
 * DEPLOY:
 *   firebase functions:secrets:set SENDGRID_API_KEY   (one-time, or when it changes)
 *   npm --prefix functions run build && firebase deploy --only functions
 */
export const sendClaimInquiryEmail = onCall(
  { secrets: [sendgridApiKey] },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const loungeId = requireString(request.data?.loungeId, 'loungeId', 128);
    const ownerName = requireString(request.data?.ownerName, 'ownerName', 120);
    const ownerContactEmail = requireEmail(request.data?.ownerContactEmail, 'ownerContactEmail');
    const ownerContactPhone = optionalString(request.data?.ownerContactPhone, 'ownerContactPhone', 40);

    return guarded('sendClaimInquiryEmail', async () => {
    const loungeSnapshot = await db.collection('lounges').doc(loungeId).get();
    if (!loungeSnapshot.exists) {
      // 'not-found', not 'internal' — the caller sent a bad id, and saying so
      // is the difference between a fixable error and a mystery.
      throw new HttpsError('not-found', 'That lounge no longer exists.');
    }
    const loungeName = (loungeSnapshot.data()?.name as string | undefined) ?? loungeId;

    sgMail.setApiKey(sendgridApiKey.value());
    await sgMail.send({
      to: SALES_INQUIRY_EMAIL,
      from: FROM_EMAIL,
      subject: `Claim Business inquiry: ${loungeName}`,
      text: [
        `Lounge: ${loungeName} (${loungeId})`,
        `Name: ${ownerName}`,
        `Email: ${ownerContactEmail}`,
        `Phone: ${ownerContactPhone}`,
      ].join('\n'),
    });

    return { sent: true };
    });
  },
);

// ---------------------------------------------------------------------------
// sendReservationEmail — notifies a lounge's owner of a new reservation
// ---------------------------------------------------------------------------

/**
 * Emails a lounge's contact address that a member has reserved a table and
 * is on the way (per Julian Brinkley's TestFlight bug report, 2026-08-13:
 * "Reserve a table should send an email to the lounge with the users
 * information indicating that the user is on the way"). The "share
 * additional info" part of that same report is the reservation form's
 * existing Notes field (see ReserveTableScreen.tsx) — included in the
 * email body below rather than a second dialog, since the form already
 * collects it.
 *
 * Only sends if the lounge has an `ownerContactEmail` — that's only set
 * once a claim on the lounge is approved (see ownerService.ts), so most
 * lounges (unclaimed, imported from Yelp/Google) have no address to send
 * to yet. That's expected, not an error — this returns `{ sent: false,
 * reason: 'no-contact-email' }` rather than throwing, since the
 * reservation itself (already written to Firestore by
 * reservationService.createReservation before this is called) is the
 * part that actually matters; the email is a best-effort bonus on top.
 *
 * DEPLOY:
 *   firebase functions:secrets:set SENDGRID_API_KEY   (one-time, or when it changes — already set)
 *   npm --prefix functions run build && firebase deploy --only functions
 */
export const sendReservationEmail = onCall(
  { secrets: [sendgridApiKey] },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const loungeId = requireString(request.data?.loungeId, 'loungeId', 128);
    const guestName = requireString(request.data?.guestName, 'guestName', 120);
    const contactPhone = requireString(request.data?.contactPhone, 'contactPhone', 40);
    const date = requireString(request.data?.date, 'date', 40);
    const timeSlot = requireString(request.data?.timeSlot, 'timeSlot', 40);
    // Free text from a member goes into an email body — cap it hard.
    const notes = optionalString(request.data?.notes, 'notes', 500);

    // Party size was only checked for truthiness, so 0 was rejected but 1e9
    // and -4 both sailed through into an email to a real shop owner.
    const partySize = Number(request.data?.partySize);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
      throw new HttpsError('invalid-argument', 'partySize must be a whole number between 1 and 50.');
    }

    return guarded('sendReservationEmail', async () => {
    const loungeSnapshot = await db.collection('lounges').doc(loungeId).get();
    const lounge = loungeSnapshot.data();
    const ownerContactEmail = lounge?.ownerContactEmail as string | undefined;
    if (!ownerContactEmail) {
      return { sent: false, reason: 'no-contact-email' };
    }
    const loungeName = (lounge?.name as string | undefined) ?? loungeId;

    sgMail.setApiKey(sendgridApiKey.value());
    await sgMail.send({
      to: ownerContactEmail,
      from: FROM_EMAIL,
      subject: `New reservation at ${loungeName}: ${guestName}, party of ${partySize}`,
      text: [
        `${guestName} has reserved a table and is on the way.`,
        '',
        `Date: ${date}`,
        `Time: ${timeSlot}`,
        `Party size: ${partySize}`,
        `Contact phone: ${contactPhone}`,
        notes ? `Notes: ${notes}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    return { sent: true };
    });
  },
);

// ---------------------------------------------------------------------------
// askConcierge — the AI Concierge, grounded in this app's real lounge data
//
// The Concierge was the largest mock surface left in the app: every reply,
// suggestion chip and "result" was a hardcoded string in
// src/data/mockConcierge.ts, identical for every member and unrelated to any
// lounge actually in the database.
//
// It lives in a Cloud Function rather than the app for one non-negotiable
// reason: an Anthropic API key shipped in a React Native bundle is a
// published API key. The key never leaves the server.
//
// Grounding, not free association: the function retrieves real candidate
// lounges from Firestore first and asks Claude to recommend *from that list
// only*, returning the ids it picked. So a recommendation is always a real
// lounge the member can tap through to, and the model cannot invent a venue.
// That is also why this uses a structured output rather than parsing prose.
// ---------------------------------------------------------------------------

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

/**
 * Runs a handler and converts anything unexpected into a generic `internal`
 * error. HttpsError instances the handler raised deliberately pass through
 * untouched — those carry messages written for the client. Everything else
 * is logged server-side and replaced, so a stack trace or a third-party
 * error body never reaches a caller.
 */
async function guarded<T>(name: string, handler: () => Promise<T>): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`${name} failed`, { error: String(error) });
    throw new HttpsError('internal', 'Something went wrong. Please try again.');
  }
}

/** How many real lounges to offer the model to choose between. */
const CONCIERGE_CANDIDATES = 40;
/** Generous, because thinking and the reply share this budget on Opus 5. */
const CONCIERGE_MAX_TOKENS = 8000;

const CONCIERGE_SYSTEM = `You are the concierge for The Reserve, an app for discovering cigar lounges.

You help members find a lounge to visit. You are knowledgeable about cigars,
spirits and lounge etiquette, and you talk like a well-informed host — warm,
direct, never salesy.

Rules you must follow:
- Recommend ONLY lounges from the CANDIDATE LOUNGES list in the user message.
  Never invent a lounge, an address, an opening time or a rating. If none of
  the candidates fit what the member asked for, say so plainly and suggest
  what to search for instead.
- Put the ids of any lounges you recommend in loungeIds, most relevant first,
  at most three. Leave it empty when you aren't recommending a specific venue.
- Do not repeat the lounge's address, hours or rating in your reply — the app
  renders those on the card. Say why this lounge suits what they asked.
- Keep replies to a few sentences. This is a chat, not a brochure.
- For questions that aren't about finding a lounge (cigar pairings, how to
  cut and light, etiquette), just answer them well and leave loungeIds empty.`;

const CONCIERGE_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: 'The concierge’s reply to the member, a few sentences.',
    },
    loungeIds: {
      type: 'array',
      description: 'Ids of recommended lounges, most relevant first. May be empty.',
      items: { type: 'string' },
    },
  },
  required: ['reply', 'loungeIds'],
  additionalProperties: false,
} as const;

type ConciergeTurn = { role: 'user' | 'assistant'; text: string };

/**
 * Personalisation from the member's AI Settings screen. Optional because a
 * member who has never opened that screen has none — and an absent
 * preference is omitted from the prompt entirely rather than defaulted,
 * since "no stated preference" and "prefers business trips" are different
 * instructions to give a model.
 */
type ConciergePreferences = {
  experienceMode?: 'business' | 'vacation';
  maxTravelDistanceMiles?: number;
  atmospheres?: string[];
};

function preferenceBrief(preferences: ConciergePreferences | undefined): string {
  if (!preferences) {
    return '';
  }
  const lines: string[] = [];
  if (preferences.experienceMode) {
    lines.push(
      preferences.experienceMode === 'business'
        ? 'They are usually travelling for work — favour lounges that suit meetings and working alone.'
        : 'They are usually travelling for leisure — favour atmosphere and somewhere worth lingering.',
    );
  }
  if (typeof preferences.maxTravelDistanceMiles === 'number') {
    lines.push(`They prefer not to travel more than ${preferences.maxTravelDistanceMiles} miles.`);
  }
  if (preferences.atmospheres?.length) {
    lines.push(`Atmospheres they like: ${preferences.atmospheres.join(', ')}.`);
  }
  return lines.length ? `\n\nABOUT THIS MEMBER:\n${lines.join('\n')}` : '';
}

/**
 * Compact one-line-per-lounge catalog. Deliberately small: the model needs
 * enough to choose well, and every extra field is tokens on every turn.
 */
function buildCandidateCatalog(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
): string {
  return docs
    .map(doc => {
      const lounge = doc.data();
      const tags = (lounge.tags ?? [])
        .filter((tag: string) => !tag.startsWith('imported-from-'))
        .slice(0, 4)
        .join(', ');
      const rating = lounge.ratings?.overall ? `${lounge.ratings.overall}/5` : 'unrated';
      return [
        `id=${doc.id}`,
        `name=${lounge.name}`,
        lounge.city ? `city=${lounge.city}` : null,
        `rating=${rating}`,
        lounge.priceRange ? `price=${lounge.priceRange}` : null,
        tags ? `tags=${tags}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
    })
    .join('\n');
}

export const askConcierge = onCall(
  { secrets: [anthropicApiKey], timeoutSeconds: 120 },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use the concierge.');
    }

    const turns = (request.data?.messages ?? []) as ConciergeTurn[];
    const preferences = request.data?.preferences as ConciergePreferences | undefined;
    const city = typeof request.data?.city === 'string' ? request.data.city.trim() : '';
    if (!Array.isArray(turns) || turns.length === 0) {
      throw new HttpsError('invalid-argument', 'messages is required.');
    }

    // Prefer lounges in the member's city; fall back to the highest-rated
    // overall so the concierge still has real venues to work with when we
    // don't know where they are.
    let snapshot: FirebaseFirestore.QuerySnapshot | null = null;
    if (city) {
      snapshot = await db
        .collection('lounges')
        .where('city', '==', city)
        .limit(CONCIERGE_CANDIDATES)
        .get();
    }
    if (!snapshot || snapshot.empty) {
      snapshot = await db
        .collection('lounges')
        .orderBy('ratings.overall', 'desc')
        .limit(CONCIERGE_CANDIDATES)
        .get();
    }

    const catalog = buildCandidateCatalog(snapshot.docs);
    const knownIds = new Set(snapshot.docs.map(doc => doc.id));

    const history = turns.slice(-10).map(turn => ({
      role: turn.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: turn.text,
    }));

    // The catalog rides on the latest user turn rather than the system
    // prompt: it changes with the member's city, and the system prompt is
    // the stable, cacheable part of every request.
    const last = history[history.length - 1];
    last.content =
      `CANDIDATE LOUNGES${city ? ` (near ${city})` : ''}:\n${catalog}` +
      preferenceBrief(preferences) +
      `\n\nMEMBER:\n${last.content}`;

    // The secret must exist for this function to deploy at all, so during
    // the "built but not switched on" phase it holds a placeholder. Saying
    // so plainly beats a generic failure: a tester who sees "something went
    // wrong" files a bug, and a tester who sees this does not.
    const apiKey = anthropicApiKey.value();
    if (!apiKey || apiKey.startsWith('placeholder')) {
      logger.info('Concierge called with no API key configured');
      return {
        reply:
          "The concierge isn't switched on yet — it's built and waiting on an API key. " +
          'Everything else in the app works; try Search or the Map to find a lounge.',
        loungeIds: [],
      };
    }

    const anthropic = new Anthropic({ apiKey });

    let message;
    try {
      message = await anthropic.messages.create({
        model: 'claude-opus-5',
        max_tokens: CONCIERGE_MAX_TOKENS,
        // Low effort: this is a latency-sensitive chat, not a reasoning
        // task, and Opus 5 is strong at low effort. Thinking stays on
        // (the default) — disabling it can leak <thinking> tags into the
        // visible reply, which is the one thing a chat UI can't tolerate.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: CONCIERGE_SCHEMA } },
        system: [{ type: 'text', text: CONCIERGE_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: history,
      });
    } catch (error) {
      logger.error('Concierge request failed', { error: String(error) });
      throw new HttpsError('internal', "The concierge couldn't answer just now.");
    }

    if (message.stop_reason === 'refusal') {
      return { reply: "I can't help with that one. Ask me about lounges, cigars or pairings.", loungeIds: [] };
    }

    const text = message.content.find(block => block.type === 'text');
    if (!text || text.type !== 'text') {
      throw new HttpsError('internal', "The concierge couldn't answer just now.");
    }

    let parsed: { reply?: string; loungeIds?: string[] };
    try {
      parsed = JSON.parse(text.text);
    } catch {
      logger.error('Concierge returned unparseable output');
      throw new HttpsError('internal', "The concierge couldn't answer just now.");
    }

    // Drop any id that isn't one we offered — belt and braces against a
    // recommendation the member could tap and land nowhere.
    const loungeIds = (parsed.loungeIds ?? []).filter(id => knownIds.has(id)).slice(0, 3);

    return { reply: parsed.reply ?? '', loungeIds };
  },
);
