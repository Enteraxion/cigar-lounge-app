/**
 * loungeSearch
 *
 * Real (non-mock) sort/filter logic for SearchResultsScreen's Sort and
 * Filter bottom sheets, shared here so FilterBottomSheet can compute a
 * live "Show N Results" count using the exact same rules the screen
 * applies. Everything here operates on the already-fetched `Lounge[]`
 * (see src/services/loungeService.ts) and the real fields on
 * `LoungeDocument` (src/types/firestore.ts) — no new schema.
 *
 * One known approximation, called out again at its call site:
 *  - `tags`/`amenities`/`description` are free-text, not a structured
 *    taxonomy matching the Filter sheet's UI option ids, so
 *    Atmosphere/Amenities/Entertainment matching is a best-effort
 *    keyword substring match (same approach as src/utils/amenityIcon.ts).
 *
 * "Current location" (used by the Filter sheet's "Near Current Location"
 * radius and the Sort sheet's "Distance" option) comes from the caller —
 * see src/hooks/useCurrentLocation.ts — falling back to
 * src/data/mockMap.ts's `defaultRegion` (a static London coordinate) if
 * real GPS isn't available (permission denied, no fix yet, etc.).
 */

import type { Lounge } from '../services/loungeService';
import { defaultRegion } from '../data/mockMap';

export type LatLng = { latitude: number; longitude: number };

export type SearchFilters = {
  distanceMiles: number;
  nearCurrentLocation: boolean;
  cityQuery: string;
  availability: string[];
  atmosphere: string[];
  amenities: string[];
  entertainment: string[];
};

/**
 * Great-circle distance between two lat/lng points, in miles. Used both
 * for the Sort sheet's "Distance" option and the Filter sheet's
 * "Near Current Location" radius.
 */
export function haversineDistanceMiles(
  from: { latitude: number; longitude: number },
  to: { lat: number; lng: number },
): number {
  const EARTH_RADIUS_MILES = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.latitude);
  const dLng = toRad(to.lng - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/** Keyword to look for in free-text lounge fields for a given chip label. */
function keywordForLabel(label: string): string {
  const overrides: Record<string, string> = {
    'Wi-Fi': 'wifi',
    'Business Friendly': 'business',
    'Beginner Friendly': 'beginner',
    'Power Outlets': 'outlet',
    'Outdoor Patio': 'patio',
    'Private Lounge': 'private',
    'Locker Storage': 'locker',
    'Full Bar': 'bar',
    'Valet Parking': 'valet',
    'Live Music': 'live music',
    'Poker Night': 'poker',
    'Sports Viewing': 'sports',
    'Whiskey Tastings': 'whiskey',
    'Cigar Events': 'cigar event',
  };
  return (overrides[label] ?? label).toLowerCase();
}

/** `tags` + `amenities` + `description`, lowercased, as one search haystack. */
function loungeKeywordHaystack(lounge: Lounge): string {
  return [...lounge.tags, ...lounge.amenities, lounge.description].join(' ').toLowerCase();
}

/** A lounge matches a chip category (OR within the category) if none are
 * selected (category not applied) or it matches at least one selected label. */
function matchesKeywordCategory(lounge: Lounge, selectedLabels: string[]): boolean {
  if (selectedLabels.length === 0) {
    return true;
  }
  const haystack = loungeKeywordHaystack(lounge);
  return selectedLabels.some(label => haystack.includes(keywordForLabel(label)));
}

/**
 * Which of a chip category's options could actually match something in the
 * current dataset.
 *
 * This exists because the filter sheet was offering twenty chips that
 * could never return a result. The Atmosphere / Amenities / Entertainment
 * chips match against `tags + amenities + description`, and every imported
 * lounge has an empty `amenities`, an empty `description`, and only an
 * `imported-from-*` tag — so selecting any of them returned zero lounges.
 * A filter that always returns nothing is worse than a missing filter: the
 * member assumes there are no quiet lounges near them, rather than
 * realising the app doesn't know which lounges are quiet.
 *
 * Rather than deleting the chips (they become real the moment the import
 * starts populating amenities), the sheet now only shows options that match
 * at least one lounge it can see. Sections empty themselves out, and refill
 * on their own as the data improves.
 */
export function viableFilterOptions<T extends { label: string }>(
  lounges: Lounge[],
  options: T[],
): T[] {
  if (lounges.length === 0) {
    return options;
  }
  const haystacks = lounges.map(loungeKeywordHaystack);
  return options.filter(option => {
    const keyword = keywordForLabel(option.label);
    return haystacks.some(haystack => haystack.includes(keyword));
  });
}

/** Best-effort, case-insensitive check of the free-text `hours` field for
 * "open late" / "open 24 hours" style availability chips — `hours` isn't
 * parsed open/close data, so this is inherently approximate. */
function matchesHoursKeyword(lounge: Lounge, availabilityId: string): boolean {
  const hours = lounge.hours.toLowerCase();
  if (availabilityId === 'open-24h') {
    return hours.includes('24');
  }
  if (availabilityId === 'open-late') {
    const lateTokens = ['late', 'midnight', '1am', '2am', '3am', '12am', '1 am', '2 am'];
    return lateTokens.some(token => hours.includes(token));
  }
  return false;
}

function matchesAvailability(lounge: Lounge, selectedIds: string[]): boolean {
  if (selectedIds.length === 0) {
    return true;
  }
  // OR across selected availability chips, matching the quick filter chips'
  // behavior elsewhere on this screen.
  return selectedIds.some(id => {
    if (id === 'open-now') {
      return lounge.status === 'open';
    }
    return matchesHoursKeyword(lounge, id);
  });
}

function matchesLocation(lounge: Lounge, filters: SearchFilters, currentLocation: LatLng): boolean {
  if (filters.nearCurrentLocation) {
    const distance = haversineDistanceMiles(currentLocation, lounge.coordinates);
    return distance <= filters.distanceMiles;
  }
  if (filters.cityQuery.trim()) {
    return lounge.address.toLowerCase().includes(filters.cityQuery.trim().toLowerCase());
  }
  return true;
}

/** Applies the full Filter sheet's rules (AND across sections, OR within
 * each section's chips) to a list of lounges. `currentLocation` defaults
 * to the mock `defaultRegion` for callers that haven't wired up
 * useCurrentLocation (or got a null back from it, e.g. permission denied). */
export function applySearchFilters(
  lounges: Lounge[],
  filters: SearchFilters,
  currentLocation: LatLng = defaultRegion,
): Lounge[] {
  return lounges.filter(
    lounge =>
      matchesLocation(lounge, filters, currentLocation) &&
      matchesAvailability(lounge, filters.availability) &&
      matchesKeywordCategory(lounge, filters.atmosphere) &&
      matchesKeywordCategory(lounge, filters.amenities) &&
      matchesKeywordCategory(lounge, filters.entertainment),
  );
}

/** '$$$$' -> 4. Used by the "Premium Experience" sort and the quick
 * "Premium" filter chip. */
function dollarSignCount(priceRange: string): number {
  return (priceRange.match(/\$/g) ?? []).length;
}

export function isPremiumLounge(lounge: Lounge): boolean {
  return (
    dollarSignCount(lounge.priceRange) >= 4 ||
    [...lounge.tags, lounge.description].join(' ').toLowerCase().includes('premium')
  );
}

/**
 * Sorts a copy of `lounges` per the Sort sheet's selected option. Returns
 * the same array (no reordering) for 'best-match', matching whatever order
 * searchLounges() returned.
 */
export function sortLounges(
  lounges: Lounge[],
  sortId: string,
  currentLocation: LatLng = defaultRegion,
): Lounge[] {
  const list = [...lounges];
  switch (sortId) {
    case 'distance':
      return list.sort(
        (a, b) =>
          haversineDistanceMiles(currentLocation, a.coordinates) -
          haversineDistanceMiles(currentLocation, b.coordinates),
      );
    case 'highest-rated':
      return list.sort((a, b) => b.ratings.overall - a.ratings.overall);
    case 'most-reviewed':
      return list.sort((a, b) => b.reviewCount - a.reviewCount);
    case 'recently-added':
      return list.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    case 'open-now': {
      // Stable partition: open lounges first, preserving relative order
      // within each group.
      const open = list.filter(lounge => lounge.status === 'open');
      const rest = list.filter(lounge => lounge.status !== 'open');
      return [...open, ...rest];
    }
    case 'premium-experience':
      return list.sort((a, b) => dollarSignCount(b.priceRange) - dollarSignCount(a.priceRange));
    case 'traveler-favorites':
      // Heuristic composite score combining rating and review volume — not
      // a real "traveler favorite" designation from any dataset.
      return list.sort((a, b) => {
        const scoreA = a.ratings.overall * Math.log(a.reviewCount + 1);
        const scoreB = b.ratings.overall * Math.log(b.reviewCount + 1);
        return scoreB - scoreA;
      });
    case 'best-match':
    default:
      return list;
  }
}
