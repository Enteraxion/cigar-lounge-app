/**
 * seedFirestore.ts — one-time Firestore seed for The Reserve.
 *
 * Reads the app's existing mock data (src/data/mock*.ts) and writes it
 * into Firestore using the schema defined in src/types/firestore.ts,
 * via the Firebase Admin SDK (this runs from Node, not the app, so it
 * uses admin credentials rather than a signed-in user's client session).
 *
 * ---------------------------------------------------------------------
 * SETUP — Firebase Admin service account (do this once):
 *
 *   1. Open https://console.firebase.google.com, select this project
 *      ("the-reserve-app-c44ed" — see ios/CigarLoungeApp/GoogleService-Info.plist).
 *   2. Gear icon (top-left, next to "Project Overview") -> Project Settings.
 *   3. Open the "Service Accounts" tab.
 *   4. Click "Generate new private key" under the Firebase Admin SDK
 *      section, confirm — this downloads a JSON file
 *      (named like the-reserve-app-c44ed-firebase-adminsdk-xxxxx.json).
 *   5. Move that file into the project root and rename it to
 *      `serviceAccountKey.json` (already gitignored — see .gitignore —
 *      so it will never be committed). Alternatively, keep it anywhere
 *      outside the repo and point FIREBASE_SERVICE_ACCOUNT_PATH at it:
 *        FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json npm run seed:firestore
 *
 *   This key grants full admin access to the Firebase project — never
 *   commit it, share it, or paste its contents anywhere.
 *
 * RUN:
 *   npm run seed:firestore
 *
 * This script is idempotent: every doc uses a deterministic id and
 * `.set()` (not `.add()`), so re-running it overwrites with the same
 * data instead of creating duplicates.
 *
 * ---------------------------------------------------------------------
 * DEDUPE NOTES — some lounges appear under different ids/names across
 * mock files (e.g. "Smoke & Velvet" is `smoke-velvet` in mockHome/
 * mockFavorites but `smoke-velvet-bar` in mockSearchResults; "Cloud
 * Nine" in mockHome is the same place as "Cloud Nine Skybar" in
 * mockFavorites/mockCollections). LOUNGE_ID_ALIASES below maps every
 * secondary id to one canonical id, and each canonical lounge is
 * hand-assembled from all the mock sources that mention it (see the
 * LOUNGES array) — deliberately not a generic fuzzy-matcher, since with
 * ~17 known lounges an auditable explicit mapping is safer than
 * name-similarity heuristics silently merging (or failing to merge) the
 * wrong places. Only mockHome, mockSearch, mockSearchResults,
 * mockLoungeDetail, mockFavorites, mockCollections, and mockMap are
 * mined for full lounge records; mockTripPlanner/mockWishlist mention a
 * few lounge names too, but only as free text (no ids), so they aren't
 * a dedupe source here.
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { featuredLounge, nearbyLounges, trendingLounges, currentUser } from '../src/data/mockHome';
import { recentlyViewedLounges } from '../src/data/mockSearch';
import { searchResults } from '../src/data/mockSearchResults';
import { loungeDetail } from '../src/data/mockLoungeDetail';
import { favoriteLounges } from '../src/data/mockFavorites';
import { collections as mockCollections } from '../src/data/mockCollections';
import { mapLounges } from '../src/data/mockMap';
import { reviews as mockReviews } from '../src/data/mockReviews';
import {
  specificCategories,
  foodAndDrinksQuality,
  statHighlightsRowOne,
  statHighlightsRowTwo,
} from '../src/data/mockRatingsBreakdown';
import { passportProfile } from '../src/data/mockPassport';

import type {
  LoungeDocument,
  LoungeRatings,
  HumidorItem,
  ReviewDocument,
  UserDocument,
  CollectionDocument,
} from '../src/types/firestore';

// ---------------------------------------------------------------------------
// Admin SDK init
// ---------------------------------------------------------------------------

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`\nNo service account key found at:\n  ${serviceAccountPath}\n`);
  console.error(
    'Generate one from Firebase Console -> Project Settings -> Service Accounts -> ' +
      'Generate new private key, save it as serviceAccountKey.json in the project root ' +
      '(or set FIREBASE_SERVICE_ACCOUNT_PATH). See the header comment in this file for details.\n',
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount & {
  project_id: string;
};

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// ---------------------------------------------------------------------------
// Small value-mapping helpers (mock data uses prose/10-point scales in
// places; Firestore schema wants plain 0-5 numeric scores throughout)
// ---------------------------------------------------------------------------

function tenScaleToFive(score: number): number {
  return Math.round((score / 2) * 10) / 10;
}

function qualitativeToScore(label: string): number {
  const table: Record<string, number> = {
    Excellent: 4.9,
    High: 4.5,
    Refined: 4.3,
    'Valet Only': 4.0,
  };
  return table[label] ?? 4.0;
}

function splitTags(text?: string): string[] {
  if (!text) return [];
  return text
    .split('•')
    .map(part => part.trim())
    .filter(Boolean);
}

function ratings(overall: number, overrides: Partial<LoungeRatings> = {}): LoungeRatings {
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
    ...overrides,
  };
}

function humidorItemsFromDetail(): HumidorItem[] {
  return loungeDetail.humidorItems.map(item => ({
    name: item.name,
    image: item.imageUri,
    strength: item.strength,
    origin: item.origin,
    price: item.price,
    stockStatus: item.stock,
  }));
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

// ---------------------------------------------------------------------------
// Canonical lounges — one entry per real-world place, hand-assembled from
// every mock source that mentions it. See "DEDUPE NOTES" above.
// ---------------------------------------------------------------------------

type LoungeSeed = Omit<LoungeDocument, 'createdAt' | 'updatedAt'> & { id: string };

const heritageRatingsBreakdown = Object.fromEntries(
  specificCategories.map(c => [c.label, c.score]),
) as Record<string, number>;

// reviewCount below is only modeled in mock data for heritage-oak-room
// (248, from mockLoungeDetail/mockRatingsBreakdown); every other lounge's
// reviewCount is a reasonable placeholder, not sourced from mock data.
const LOUNGES: LoungeSeed[] = [
  {
    id: 'heritage-oak-room',
    name: loungeDetail.name,
    description: loungeDetail.description,
    address: loungeDetail.address,
    coordinates: { lat: 51.509, lng: -0.147 }, // mockMap
    hours: loungeDetail.statusLabel,
    status: 'open',
    images: uniq([featuredLounge.imageUri, ...loungeDetail.galleryImages]),
    amenities: uniq([
      ...loungeDetail.amenities.map(a => a.label),
      'Outdoor Terrace',
      'Humidor Access',
      'Full Bar',
    ]),
    tags: ['Historic', 'Whiskey', 'Humidor'],
    priceRange: '$$$$',
    ratings: ratings(loungeDetail.rating, {
      atmosphere: heritageRatingsBreakdown.Atmosphere,
      humidorVariety: heritageRatingsBreakdown['Humidor Variety'],
      service: heritageRatingsBreakdown.Service,
      comfort: heritageRatingsBreakdown.Comfort,
      ventilation: heritageRatingsBreakdown.Ventilation,
      foodDrinksQuality: foodAndDrinksQuality.score,
      wifiSpeed: qualitativeToScore(statHighlightsRowOne[0].value),
      businessFriendly: qualitativeToScore(statHighlightsRowOne[1].value),
      socialScene: qualitativeToScore(statHighlightsRowTwo[0].value),
      parking: qualitativeToScore(statHighlightsRowTwo[1].value),
    }),
    reviewCount: loungeDetail.reviewCount,
    humidorItems: humidorItemsFromDetail(),
  },
  {
    id: 'smoke-velvet',
    name: 'Smoke & Velvet',
    description: 'Exclusive spirits and live jazz in an intimate downtown setting.',
    address: 'Chelsea, New York, NY',
    coordinates: { lat: 40.7465, lng: -74.0014 },
    hours: 'Open until 01:00 AM',
    status: 'open',
    images: uniq([nearbyLounges[0].imageUri, favoriteLounges[0].imageUri]),
    amenities: ['coffee', 'utensils', 'wifi', 'bell', 'parking', 'tv'],
    tags: uniq([...splitTags(nearbyLounges[0].tags), ...splitTags(favoriteLounges[0].tags)]),
    priceRange: '$$$$',
    // searchResults[4] is "Smoke & Velvet" under its mockSearchResults id
    // (smoke-velvet-bar) — same lounge, richer rating breakdown.
    ratings: ratings(searchResults[4].rating, {
      atmosphere: tenScaleToFive(searchResults[4].atmosphereScore),
      businessFriendly: tenScaleToFive(searchResults[4].businessScore),
    }),
    reviewCount: 96, // no mock source models a review count for this lounge; reasonable placeholder
    humidorItems: [],
  },
  {
    id: 'cloud-nine-skybar',
    name: 'Cloud Nine Skybar',
    description: 'A rooftop terrace lounge with panoramic city views.',
    address: 'City Center',
    coordinates: { lat: 25.7617, lng: -80.1918 },
    hours: 'Open until midnight',
    status: 'open',
    images: uniq([nearbyLounges[1].imageUri, favoriteLounges[1].imageUri]),
    amenities: ['Outdoor Terrace', 'Full Bar'],
    tags: uniq([...splitTags(nearbyLounges[1].tags), ...splitTags(favoriteLounges[1].tags)]),
    priceRange: '$$$',
    ratings: ratings(5),
    reviewCount: 152,
    humidorItems: [],
  },
  {
    id: 'the-ember-room',
    name: 'The Ember Room',
    description: 'A private humidor room favored by regulars.',
    address: 'Near You',
    coordinates: { lat: 0, lng: 0 },
    hours: 'Open until 11:00 PM',
    status: 'open',
    images: [nearbyLounges[2].imageUri],
    amenities: ['Private Humidor'],
    tags: splitTags(nearbyLounges[2].tags),
    priceRange: '$$$',
    ratings: ratings(5),
    reviewCount: 61,
    humidorItems: [],
  },
  {
    id: 'gilded-leaf-terrace',
    name: 'Gilded Leaf Terrace',
    description: 'Rooftop whisky bar with skyline views over the Financial District.',
    address: 'Financial District, New York, NY',
    coordinates: { lat: 40.7075, lng: -74.0113 },
    hours: 'Open now',
    status: 'open',
    images: [nearbyLounges[3].imageUri],
    amenities: ['coffee', 'utensils', 'wifi', 'tv'],
    tags: uniq(splitTags(nearbyLounges[3].tags)),
    priceRange: '$$$',
    // searchResults[3] is "Gilded Leaf Terrace" — same lounge as
    // nearbyLounges[3]'s "Gilded Leaf", richer rating breakdown.
    ratings: ratings(searchResults[3].rating, {
      atmosphere: tenScaleToFive(searchResults[3].atmosphereScore),
      businessFriendly: tenScaleToFive(searchResults[3].businessScore),
    }),
    reviewCount: 74, // no mock source models a review count for this lounge; reasonable placeholder
    humidorItems: [],
  },
  {
    id: 'the-gatsby',
    name: 'The Gatsby',
    description: 'A speakeasy-style lounge with a deep rare-malt selection.',
    address: 'Manhattan, NY',
    coordinates: { lat: 40.7831, lng: -73.9712 },
    hours: 'Open until 02:00 AM',
    status: 'open',
    images: [trendingLounges[0].imageUri, favoriteLounges[2].imageUri],
    amenities: ['Speakeasy Style', 'Rare Malts'],
    tags: splitTags(favoriteLounges[2].tags),
    priceRange: '$$$',
    ratings: ratings(4),
    reviewCount: 58,
    humidorItems: [],
  },
  {
    id: 'roma-reserve',
    name: 'Roma Reserve',
    description: 'Old-world Italian lounge with terrace seating.',
    address: 'Rome, Italy',
    coordinates: { lat: 41.9028, lng: 12.4964 },
    hours: 'Open until 01:00 AM',
    status: 'open',
    images: [trendingLounges[1].imageUri, favoriteLounges[3].imageUri],
    amenities: ['Authentic Italian', 'Terrace'],
    tags: splitTags(favoriteLounges[3].tags),
    priceRange: '$$$',
    ratings: ratings(5),
    reviewCount: 89,
    humidorItems: [],
  },
  {
    id: 'havana-heritage',
    name: 'Havana Heritage',
    description: 'A Miami favorite steeped in Cuban cigar heritage.',
    address: 'Miami, FL',
    coordinates: { lat: 25.7617, lng: -80.1918 },
    hours: 'Open until 01:00 AM',
    status: 'open',
    images: [trendingLounges[2].imageUri],
    amenities: [],
    tags: ['Cuban Heritage'],
    priceRange: '$$$',
    ratings: ratings(4.5),
    reviewCount: 40,
    humidorItems: [],
  },
  {
    id: 'davidoff-geneva-1911',
    name: 'Davidoff of Geneva Since 1911',
    description: 'A flagship premium lounge with a world-class humidor.',
    address: 'Midtown Manhattan, New York, NY',
    coordinates: { lat: 40.7549, lng: -73.984 },
    hours: 'Open now',
    status: 'open',
    images: [searchResults[0].imageUri],
    amenities: searchResults[0].amenities,
    tags: ['Premium Lounge', '4 Locations'],
    priceRange: searchResults[0].priceTier,
    ratings: ratings(searchResults[0].rating, {
      atmosphere: tenScaleToFive(searchResults[0].atmosphereScore),
      businessFriendly: tenScaleToFive(searchResults[0].businessScore),
    }),
    reviewCount: 210,
    humidorItems: [],
  },
  {
    id: 'grand-reserve-lounge',
    name: 'The Grand Reserve Lounge',
    description: 'A reliable Upper East Side spot for closing deals over a smoke.',
    address: 'Upper East Side, New York, NY',
    coordinates: { lat: 40.7736, lng: -73.9566 },
    hours: 'Open now',
    status: 'open',
    images: [searchResults[1].imageUri],
    amenities: searchResults[1].amenities,
    tags: [],
    priceRange: searchResults[1].priceTier,
    ratings: ratings(searchResults[1].rating, {
      atmosphere: tenScaleToFive(searchResults[1].atmosphereScore),
      businessFriendly: tenScaleToFive(searchResults[1].businessScore),
    }),
    reviewCount: 88,
    humidorItems: [],
  },
  {
    id: 'heritage-cigar-social',
    name: 'Heritage Cigar & Social',
    description: 'A Soho social club for cigar enthusiasts.',
    address: 'Soho District, New York, NY',
    coordinates: { lat: 40.7233, lng: -74.003 },
    hours: 'Currently closed',
    status: 'closed',
    images: [searchResults[2].imageUri],
    amenities: searchResults[2].amenities,
    tags: [],
    priceRange: searchResults[2].priceTier,
    ratings: ratings(searchResults[2].rating, {
      atmosphere: tenScaleToFive(searchResults[2].atmosphereScore),
      businessFriendly: tenScaleToFive(searchResults[2].businessScore),
    }),
    reviewCount: 45,
    humidorItems: [],
  },
  {
    id: 'humidor-suite',
    name: 'The Humidor Suite',
    description: 'A Mayfair whisky-and-humidor suite with private rooms.',
    address: 'Mayfair, London',
    coordinates: { lat: 51.5098, lng: -0.1438 },
    hours: 'Open now',
    status: 'open',
    images: [recentlyViewedLounges[0].imageUri],
    amenities: ['Whiskey', 'Private Rooms'],
    tags: recentlyViewedLounges[0].tags,
    priceRange: '$$$$',
    ratings: ratings(recentlyViewedLounges[0].rating),
    reviewCount: 67,
    humidorItems: [],
  },
  {
    id: 'summit',
    name: 'Summit',
    description: 'A Manhattan rooftop lounge known for live music nights.',
    address: 'Manhattan, NY',
    coordinates: { lat: 51.5065, lng: -0.1505 },
    hours: 'Open now',
    status: 'open',
    images: [recentlyViewedLounges[1].imageUri],
    amenities: ['Rooftop', 'Live Music'],
    tags: recentlyViewedLounges[1].tags,
    priceRange: '$$$',
    ratings: ratings(recentlyViewedLounges[1].rating),
    reviewCount: 52,
    humidorItems: [],
  },
  {
    id: 'ember-den',
    name: 'The Ember Den',
    description: 'A Chicago humidor bar with a loyal local following.',
    address: 'Chicago, IL',
    coordinates: { lat: 41.8781, lng: -87.6298 },
    hours: 'Open now',
    status: 'open',
    images: [recentlyViewedLounges[2].imageUri],
    amenities: ['Humidor', 'Bar'],
    tags: recentlyViewedLounges[2].tags,
    priceRange: '$$',
    ratings: ratings(recentlyViewedLounges[2].rating),
    reviewCount: 33,
    humidorItems: [],
  },
  {
    id: 'montefortuna-lounge',
    name: 'Montefortuna Lounge',
    description: 'A Mayfair full-bar lounge with locker storage for members.',
    address: 'Mayfair, London',
    coordinates: { lat: 51.5105, lng: -0.1495 },
    hours: 'Open now',
    status: 'open',
    images: [mapLounges[1].image],
    amenities: mapLounges[1].amenities,
    tags: [],
    priceRange: '$$$',
    ratings: ratings(mapLounges[1].rating),
    reviewCount: 29,
    humidorItems: [],
  },
  {
    id: 'the-smoke',
    name: 'The Smoke',
    description: 'A Soho humidor lounge with a compact outdoor terrace.',
    address: 'Soho, London',
    coordinates: { lat: 51.5073, lng: -0.1445 },
    hours: 'Closes 11PM',
    status: 'open',
    images: [mapLounges[2].image],
    amenities: mapLounges[2].amenities,
    tags: [],
    priceRange: '$$$',
    ratings: ratings(mapLounges[2].rating),
    reviewCount: 37,
    humidorItems: [],
  },
  {
    id: 'velvet-ash',
    name: 'The Velvet Ash',
    description: 'A Marylebone hideaway favored for its quiet, exclusive service.',
    address: 'Marylebone, London',
    coordinates: { lat: 51.5183, lng: -0.1553 },
    hours: 'Open now',
    status: 'open',
    images: [mockCollections[0].lounges[1].imageUri],
    amenities: [],
    tags: [],
    priceRange: '$$$$',
    ratings: ratings(mockCollections[0].lounges[1].rating),
    reviewCount: 22,
    humidorItems: [],
  },
];

// Secondary mock ids that refer to a lounge already listed above under a
// different, canonical id (LOUNGES above is already deduped by hand).
// mockCollections' lounge references all happen to already use canonical
// ids, so this map is a no-op today — kept as a safety net for
// collection.lounges[].id below in case that changes, and as a reference
// for later phases that read raw mock ids.
const LOUNGE_ID_ALIASES: Record<string, string> = {
  'smoke-velvet-bar': 'smoke-velvet',
  'cloud-nine': 'cloud-nine-skybar',
  'gilded-leaf': 'gilded-leaf-terrace',
  'davidoff-geneva-since-1911': 'davidoff-geneva-1911',
};
// ---------------------------------------------------------------------------
// Reviews — all of mockReviews.ts's reviews are for the Heritage Oak Room
// (the only lounge with a full Reviews screen in the mock data).
// ---------------------------------------------------------------------------

function timeAgoToDate(text: string): Date {
  const now = new Date();
  const match = text.match(/(\d+)\s+(day|week)s?\s+ago/i);
  if (text === 'Yesterday') {
    now.setDate(now.getDate() - 1);
    return now;
  }
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    now.setDate(now.getDate() - amount * (unit === 'week' ? 7 : 1));
    return now;
  }
  return now;
}

const CATEGORY_KEY_MAP: Record<string, keyof ReviewDocument['categoryRatings']> = {
  Atmosphere: 'atmosphere',
  Humidor: 'humidorVariety',
  Ventilation: 'ventilation',
  Service: 'service',
  Comfort: 'comfort',
  'Staff Knowledge': 'staffKnowledge',
};

type ReviewSeed = ReviewDocument & { id: string };

const HERITAGE_REVIEWS: ReviewSeed[] = mockReviews.map(review => {
  const categoryRatings: ReviewDocument['categoryRatings'] = {};
  for (const cat of review.categoryRatings) {
    const key = CATEGORY_KEY_MAP[cat.label];
    if (key) categoryRatings[key] = cat.score;
  }

  return {
    id: review.id,
    userId: `mock-${review.id}`,
    userName: review.authorName,
    userAvatar: review.avatarUri,
    memberTier: review.memberTier,
    rating: review.rating,
    visitDate: Timestamp.fromDate(timeAgoToDate(review.timeAgo)),
    wouldReturn: review.rating >= 4,
    recommend: review.rating >= 4,
    text: review.text,
    photos: review.photoUris,
    categoryRatings,
    helpfulCount: review.likeCount,
    createdAt: Timestamp.fromDate(timeAgoToDate(review.timeAgo)),
    ...(review.ownerResponse
      ? {
          ownerResponse: {
            text: review.ownerResponse.text,
            respondedAt: Timestamp.fromDate(timeAgoToDate(review.timeAgo)),
          },
        }
      : {}),
  };
});

// ---------------------------------------------------------------------------
// Demo user — no real signed-up account is tied to this profile yet (the
// Firebase Auth flow wired up in an earlier phase creates its own users);
// this is a stable, clearly-named seed id so favorites/collections have
// somewhere to live until a later phase links a real auth uid here.
// ---------------------------------------------------------------------------

const DEMO_USER_ID = 'demo-alexander-rossi';

const demoUser: UserDocument = {
  name: currentUser.name,
  email: 'alexander.rossi@example.com',
  avatarUrl: currentUser.avatarUri,
  memberTier: passportProfile.memberTier,
  homeCity: passportProfile.homeCity,
  favoriteBrand: passportProfile.favBrand,
  favoriteLounge: passportProfile.favLounge,
  memberSince: Timestamp.fromDate(new Date('2018-05-01')),
  stats: {
    loungesVisited: 0,
    statesExplored: 0,
    reviewsWritten: 0,
    photosUploaded: 0,
    favoritesSaved: 0,
    checkIns: 0,
    milesTraveled: 0,
  },
};

// favoriteLounges ids already match canonical LOUNGES ids directly
// (smoke-velvet, cloud-nine-skybar, the-gatsby, roma-reserve) — no
// alias resolution needed here.
const demoFavoriteLoungeIds = favoriteLounges.map(f => f.id);

const demoCollections: (CollectionDocument & { id: string })[] = mockCollections.map(collection => ({
  id: collection.id,
  name: collection.name,
  description: collection.description,
  coverImage: collection.coverImage,
  category: collection.name, // mock data has no per-collection category field; name doubles as one
  isPrivate: collection.privacy === 'private',
  loungeIds: collection.lounges.map(l => LOUNGE_ID_ALIASES[l.id] ?? l.id),
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}));

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function seed() {
  console.log(`\nSeeding Firestore project: ${serviceAccount.project_id}\n`);

  const now = Timestamp.now();

  console.log(`Writing ${LOUNGES.length} lounges...`);
  for (const lounge of LOUNGES) {
    const { id, ...data } = lounge;
    await db
      .collection('lounges')
      .doc(id)
      .set({ ...data, createdAt: now, updatedAt: now });
  }

  console.log(`Writing ${HERITAGE_REVIEWS.length} reviews for heritage-oak-room...`);
  for (const review of HERITAGE_REVIEWS) {
    const { id, ...data } = review;
    await db.collection('lounges').doc('heritage-oak-room').collection('reviews').doc(id).set(data);
  }

  console.log(`Writing demo user (${DEMO_USER_ID})...`);
  await db.collection('users').doc(DEMO_USER_ID).set(demoUser);

  console.log(`Writing ${demoFavoriteLoungeIds.length} favorites...`);
  for (const loungeId of demoFavoriteLoungeIds) {
    await db
      .collection('users')
      .doc(DEMO_USER_ID)
      .collection('favorites')
      .doc(loungeId)
      .set({ addedAt: now });
  }

  console.log(`Writing ${demoCollections.length} collections...`);
  for (const collection of demoCollections) {
    const { id, ...data } = collection;
    await db.collection('users').doc(DEMO_USER_ID).collection('collections').doc(id).set(data);
  }

  console.log('\n✅ Seed complete:');
  console.log(`   ${LOUNGES.length} lounges`);
  console.log(`   ${HERITAGE_REVIEWS.length} reviews`);
  console.log(`   1 user (${DEMO_USER_ID})`);
  console.log(`   ${demoFavoriteLoungeIds.length} favorites`);
  console.log(`   ${demoCollections.length} collections\n`);
}

seed()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\nSeed failed:', error);
    process.exit(1);
  });
