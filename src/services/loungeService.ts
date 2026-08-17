/**
 * loungeService
 *
 * Firestore-backed data access for lounges + reviews, using
 * @react-native-firebase/firestore's modular API (same convention as
 * src/services/firebaseAuth.ts). Screens should go through these
 * functions rather than importing '@react-native-firebase/firestore'
 * directly, so query shape/collection names stay in one place.
 *
 * See src/types/firestore.ts for the document shapes and
 * scripts/seedFirestore.ts for how the `lounges` collection was
 * populated from the old mock data.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  query,
  orderBy,
  where,
} from '@react-native-firebase/firestore';
import type { LoungeDocument, ReviewDocument } from '../types/firestore';
import { loungeImageUri } from '../utils/loungeImage';
import { findCityCoordinates, isKnownUsCityName } from '../utils/cityAutocomplete';
import { haversineDistanceMiles } from '../utils/loungeSearch';
import {
  createAsyncCache,
  createKeyedAsyncCache,
  memoizeOnIdentity,
} from '../utils/asyncCache';
import { latitudeBand, nearbyCacheKey, withinRadius } from '../utils/geoQuery';

const db = getFirestore();

export type Lounge = LoungeDocument & { id: string };
export type Review = ReviewDocument & { id: string };

/**
 * How long a fetched collection stays usable before we go back to the
 * network. Long enough that moving between tabs never refetches, short
 * enough that a newly imported or edited lounge shows up without a restart.
 */
const LOUNGE_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchAllLounges(): Promise<Lounge[]> {
  const snapshot = await getDocs(collection(db, 'lounges'));
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as LoungeDocument) }));
}

const allLoungesCache = createAsyncCache(fetchAllLounges, LOUNGE_CACHE_TTL_MS);

/**
 * Fetches every document in the `lounges` collection.
 *
 * **Prefer `getLoungesNear` for anything location-shaped.** This collection
 * is 8,294 documents / ~6.8 MB and takes over 7 seconds to transfer on a
 * wired connection, so this is only the right call when a feature genuinely
 * needs national breadth (city rankings, corridor planning, concierge
 * candidates) — not to display four nearby lounges.
 *
 * Cached with in-flight de-duplication, so concurrent callers share one
 * request and tab switches cost nothing. Returns a shallow copy: callers
 * that sort in place (which several did) would otherwise reorder the array
 * every other screen is holding.
 */
export async function getAllLounges(): Promise<Lounge[]> {
  const lounges = await allLoungesCache.get();
  return lounges.slice();
}

/**
 * Forces the next read to go back to Firestore. For pull-to-refresh and for
 * after a write that changes what a list should show.
 */
export function invalidateLoungeCaches(): void {
  allLoungesCache.invalidate();
  nearbyCache.invalidate();
}

/**
 * Lounges within `radiusMiles` of a point, nearest first.
 *
 * Firestore has no geo query, but it does support a range on a single field,
 * so this narrows server-side to a latitude band and finishes the circle in
 * JS. Measured selectivity on the real collection: a 60-mile band is 7.5% of
 * documents around Austin, 11.6% around Greenville, 16.6% around New York —
 * a 6–13x reduction against fetching everything, which is the difference
 * between a tab that opens and one that hangs.
 *
 * Every document in the collection has numeric coordinates (verified — 0 of
 * 8,294 missing), so the band is safe to rely on. The one case it cannot
 * serve is a member nowhere near any lounge at all, where the band is empty
 * and we fall back to the full collection so "nothing nearby" is a real
 * answer rather than an artifact of the query shape.
 */
const nearbyCache = createKeyedAsyncCache(async (key: string) => {
  const { lat, lng, radiusMiles } = JSON.parse(key) as {
    lat: number;
    lng: number;
    radiusMiles: number;
  };
  const band = latitudeBand(lat, radiusMiles);
  const snapshot = await getDocs(
    query(
      collection(db, 'lounges'),
      where('coordinates.lat', '>=', band.minLat),
      where('coordinates.lat', '<=', band.maxLat),
    ),
  );
  const inBand = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as LoungeDocument) }));
  return withinRadius(inBand, { lat, lng }, radiusMiles);
}, LOUNGE_CACHE_TTL_MS);

export async function getLoungesNear(
  center: { lat: number; lng: number },
  radiusMiles: number,
  max = 150,
): Promise<Lounge[]> {
  const nearby = await nearbyCache.get(nearbyCacheKey(center, radiusMiles));
  if (nearby.length > 0) {
    return nearby.slice(0, max);
  }
  // Nothing in the band. Rather than claim there are no lounges, answer from
  // the whole collection sorted by distance — expensive, but this is the
  // "member is far from anywhere we cover" path, not the common one.
  const all = await allLoungesCache.get();
  return withinRadius(all, center, Number.POSITIVE_INFINITY).slice(0, max);
}

/** Fetches a single lounge by id, or null if it doesn't exist. */
export async function getLoungeById(id: string): Promise<Lounge | null> {
  const snapshot = await getDoc(doc(db, 'lounges', id));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as LoungeDocument) };
}

/**
 * Batch-fetches lounges by id (for favorites/collections screens, where
 * a user doc holds a list of lounge ids). Missing ids are silently
 * dropped rather than throwing, since a favorited/collected lounge could
 * have been removed since the reference was saved.
 *
 * Implemented as parallel getDoc calls rather than a single `where(
 * documentId(), 'in', ids)` query — simpler and has no 30-item cap,
 * which matters once collections/favorites grow past that.
 */
export async function getLoungesByIds(ids: string[]): Promise<Lounge[]> {
  const results = await Promise.all(ids.map(id => getLoungeById(id)));
  return results.filter((lounge): lounge is Lounge => lounge !== null);
}

/**
 * How far around a searched town counts as "near it". Wide enough to reach
 * the next real city — which is the whole point in rural areas — without
 * returning results from three states away.
 */
const NEARBY_SEARCH_RADIUS_MILES = 60;

/**
 * Search by place or by text, in that order.
 *
 * This function's previous comment claimed that "at this app's current scale
 * (a few dozen lounges) fetching everything and filtering in JS is simpler
 * and cheaper", and said to revisit "if the lounge count grows large enough
 * for this to matter." The Yelp + Google Places import then took the
 * collection to 8,294 documents and nobody revisited — which is how every
 * tab in the app ended up waiting on a 6.8 MB download. The lesson worth
 * keeping is that a comment recording an assumption is not the same as
 * anything enforcing it.
 *
 * So: a query that names a real US city is answered by a bounded proximity
 * query. Only free text with no place in it still needs the whole
 * collection, because Firestore has no case-insensitive substring index and
 * there is no server-side equivalent to fall back on. That remaining case is
 * the one that wants a real search index (Algolia/Typesense) — it is now the
 * *only* full-collection read a member can trigger by typing.
 *
 * A blank query means "browse all" (e.g. "View All" links and the Map
 * screen's List toggle land here with no query) rather than "match nothing",
 * so it returns every lounge unfiltered.
 */

export async function searchLounges(searchQuery: string): Promise<Lounge[]> {
  const needle = searchQuery.trim().toLowerCase();
  if (!needle) {
    return getAllLounges();
  }

  // Place searches take the bounded path, before anything downloads the whole
  // collection. "Houston", "Austin, TX" and the like are the most common
  // thing typed into this box, and a city resolves to a coordinate, which is
  // a query Firestore can narrow server-side — 961 documents instead of
  // 8,294 in a real metro.
  //
  // This also changes what a city name means: searching "Houston" now returns
  // lounges *around Houston* rather than lounges with "Houston" in their name.
  // For a place name that is the answer the member wanted.
  if (isKnownUsCityName(searchQuery)) {
    const cityCoordinates = findCityCoordinates(searchQuery);
    if (cityCoordinates) {
      const near = await getLoungesNear(cityCoordinates, NEARBY_SEARCH_RADIUS_MILES, 200);
      if (near.length > 0) {
        return near;
      }
    }
  }

  // Not a place, or a place we cover nothing near: fall back to substring
  // matching, which has no server-side equivalent and so needs everything.
  const lounges = await getAllLounges();

  const textMatches = lounges.filter(lounge => {
    const haystack = [lounge.name, lounge.address, ...lounge.tags].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
  if (textMatches.length > 0) {
    return textMatches;
  }

  // Nothing matched the text. If the query is a real place, fall back to
  // searching *around* it rather than *for* it.
  //
  // Searching "Atalissa, IA" used to return nothing at all, because no
  // lounge has "Atalissa" in its name or address — while a real lounge sat
  // 18 miles away in Iowa City. Someone searching a small town wants the
  // lounges they could drive to, not only the ones inside the town
  // boundary, and small towns are exactly the case where the difference
  // decides between "no lounges" and a usable answer.
  const coordinates = findCityCoordinates(searchQuery);
  if (!coordinates) {
    return [];
  }
  const origin = { latitude: coordinates.lat, longitude: coordinates.lng };
  return lounges
    .filter(lounge => lounge.coordinates)
    .map(lounge => ({
      lounge,
      distance: haversineDistanceMiles(origin, lounge.coordinates),
    }))
    .filter(entry => entry.distance <= NEARBY_SEARCH_RADIUS_MILES)
    .sort((a, b) => a.distance - b.distance)
    .map(entry => entry.lounge);
}

export type CitySuggestion = { id: string; name: string };

type CityHighlight = { id: string; name: string; count: number; imageUri?: string };

/**
 * Distinct `city` values across all lounges (only populated on
 * Yelp-imported lounges — see LoungeDocument.city), ranked by how many
 * lounges are in each city (most-covered first) and paired with a real
 * lounge photo from that city where one exists. Shared source for
 * getDistinctCities/getPopularDestinations/getTrendingCities below so
 * they all rank cities the same way instead of three separate counts.
 *
 * Memoized on the identity of the cached lounge array, because SearchScreen
 * asks for this through four different loaders on every focus and each one
 * would otherwise walk all 8,294 documents again. Reads the cache directly
 * rather than through getAllLounges() so the array reference stays stable
 * (getAllLounges hands out copies to protect callers that sort in place).
 */
const deriveCityHighlights = memoizeOnIdentity((lounges: Lounge[]): CityHighlight[] => {
  const byCity = new Map<string, { count: number; imageUri?: string }>();
  for (const lounge of lounges) {
    if (!lounge.city) {
      continue;
    }
    const existing = byCity.get(lounge.city);
    byCity.set(lounge.city, {
      count: (existing?.count ?? 0) + 1,
      imageUri: existing?.imageUri ?? loungeImageUri(lounge),
    });
  }

  return Array.from(byCity.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([city, data]) => ({
      id: city.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: city,
      count: data.count,
      imageUri: data.imageUri,
    }));
});

/**
 * Reads the ranking from the single pre-computed `aggregates/cityStats`
 * document (built by scripts/buildCityStats.ts), falling back to deriving it
 * from the full collection.
 *
 * The fallback is the original implementation and stays deliberately: if the
 * aggregate has never been built, or the read fails, Search must still show
 * real cities — slowly — rather than none. Cached so the four SearchScreen
 * loaders that ask for this share one read.
 */
const cityStatsCache = createAsyncCache(async (): Promise<CityHighlight[] | null> => {
  try {
    const snapshot = await getDoc(doc(db, 'aggregates', 'cityStats'));
    if (!snapshot.exists()) {
      return null;
    }
    const cities = (snapshot.data() as { cities?: unknown }).cities;
    if (!Array.isArray(cities) || cities.length === 0) {
      return null;
    }
    return cities.map(city => ({
      id: String(city.id),
      name: String(city.name),
      count: Number(city.count) || 0,
      // Stored as null when the city has no lounge photo; the rails that
      // need one filter on this being present.
      imageUri: city.imageUri ?? undefined,
    }));
  } catch {
    return null;
  }
}, LOUNGE_CACHE_TTL_MS);

async function getCityHighlights(): Promise<CityHighlight[]> {
  const precomputed = await cityStatsCache.get();
  if (precomputed) {
    return precomputed;
  }
  return deriveCityHighlights(await allLoungesCache.get());
}

/**
 * For SearchSuggestionsScreen's Cities list. Caps at 10 since that's a
 * suggestions dropdown, not a full directory.
 */
export async function getDistinctCities(): Promise<CitySuggestion[]> {
  const highlights = await getCityHighlights();
  return highlights.slice(0, 10).map(({ id, name }) => ({ id, name }));
}

export type PopularDestination = { id: string; city: string; imageUri: string };

/**
 * For SearchScreen's Popular Destinations rail — only cities that have at
 * least one real lounge photo to show, since this section is image-led.
 */
export async function getPopularDestinations(limitCount = 4): Promise<PopularDestination[]> {
  const highlights = await getCityHighlights();
  return highlights
    .filter((highlight): highlight is CityHighlight & { imageUri: string } => !!highlight.imageUri)
    .slice(0, limitCount)
    .map(highlight => ({ id: highlight.id, city: highlight.name, imageUri: highlight.imageUri }));
}

export type FeaturedCityGuide = {
  city: string;
  loungeCount: number;
  imageUri: string;
};

/**
 * SearchScreen's "Featured Travel Guide" card. Was a fixed "Traveling to
 * Nashville?" headline with an invented description and a Coming Soon
 * button, shown to every member whether or not the app had a single
 * lounge in Nashville.
 *
 * A guide we can actually honour is one for a city we actually cover, so
 * this is simply the best-covered city with a photo — the same city
 * ranking every other section on the screen uses. The card's button then
 * runs a real search for it. Returns null when no city qualifies rather
 * than inventing one.
 */
export async function getFeaturedCityGuide(): Promise<FeaturedCityGuide | null> {
  const highlights = await getCityHighlights();
  const featured = highlights.find(highlight => !!highlight.imageUri);
  if (!featured || !featured.imageUri) {
    return null;
  }
  return { city: featured.name, loungeCount: featured.count, imageUri: featured.imageUri };
}

export type TrendingCity = { id: string; rank: string; name: string };

/**
 * For SearchScreen's Trending Cities list — the next-most-covered cities
 * after whichever ones Popular Destinations already surfaced, so the two
 * sections don't just repeat each other.
 */
export async function getTrendingCities(limitCount = 4): Promise<TrendingCity[]> {
  const highlights = await getCityHighlights();
  const popularIds = new Set((await getPopularDestinations()).map(destination => destination.id));
  return highlights
    .filter(highlight => !popularIds.has(highlight.id))
    .slice(0, limitCount)
    .map((highlight, index) => ({
      id: highlight.id,
      rank: String(index + 1).padStart(2, '0'),
      name: highlight.name,
    }));
}

/**
 * Top-rated lounges by `ratings.overall`, for SearchSuggestionsScreen's
 * Lounges list — there's no separate "featured lounges" concept yet, so
 * highest-rated is the stand-in for "what to suggest."
 *
 * Ordered and limited by Firestore rather than in JS: this used to download
 * all 8,294 documents and sort them to return ten. `ratings.overall` is a
 * single field, so Firestore's automatic single-field index serves this with
 * no composite index to deploy.
 */
export async function getTopRatedLounges(limitCount = 10): Promise<Lounge[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'lounges'),
      orderBy('ratings.overall', 'desc'),
      fsLimit(limitCount),
    ),
  );
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as LoungeDocument) }));
}

/** Fetches the `reviews` subcollection for a lounge, newest first. */
export async function getReviewsForLounge(loungeId: string): Promise<Review[]> {
  const reviewsQuery = query(
    collection(db, 'lounges', loungeId, 'reviews'),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(reviewsQuery);
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as ReviewDocument) }));
}
