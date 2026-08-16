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
  query,
  orderBy,
} from '@react-native-firebase/firestore';
import type { LoungeDocument, ReviewDocument } from '../types/firestore';
import { loungeImageUri } from '../utils/loungeImage';
import { findCityCoordinates } from '../utils/cityAutocomplete';
import { haversineDistanceMiles } from '../utils/loungeSearch';

const db = getFirestore();

export type Lounge = LoungeDocument & { id: string };
export type Review = ReviewDocument & { id: string };

/** Fetches every document in the `lounges` collection. */
export async function getAllLounges(): Promise<Lounge[]> {
  const snapshot = await getDocs(collection(db, 'lounges'));
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as LoungeDocument) }));
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
 * Basic client-side substring search across name, address, and tags.
 * Firestore has no native case-insensitive substring query, and at this
 * app's current scale (a few dozen lounges) fetching everything and
 * filtering in JS is simpler and cheaper than maintaining keyword-array
 * indexes for prefix queries. Revisit with a real search index (e.g.
 * Algolia/Typesense) if the lounge count grows large enough for this to
 * matter.
 *
 * A blank query means "browse all" (e.g. "View All" links and the Map
 * screen's List toggle land here with no query) rather than "match
 * nothing", so it returns every lounge unfiltered.
 */
/**
 * How far around a searched town counts as "near it" when the town itself
 * has no lounges. Wide enough to reach the next real city — which is the
 * whole point in rural areas — without returning results from three states
 * away.
 */
const NEARBY_SEARCH_RADIUS_MILES = 60;

export async function searchLounges(searchQuery: string): Promise<Lounge[]> {
  const needle = searchQuery.trim().toLowerCase();
  const lounges = await getAllLounges();
  if (!needle) {
    return lounges;
  }

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
 */
async function getCityHighlights(): Promise<CityHighlight[]> {
  const lounges = await getAllLounges();
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
 */
export async function getTopRatedLounges(limitCount = 10): Promise<Lounge[]> {
  const lounges = await getAllLounges();
  return lounges.sort((a, b) => b.ratings.overall - a.ratings.overall).slice(0, limitCount);
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
