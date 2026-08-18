/**
 * Import relevance filtering — pure, and deliberately in its own module.
 *
 * These functions decide which businesses become lounges in the members'
 * directory, so they are the highest-value logic in the backend to have
 * under test. Keeping them here rather than in index.ts means a test can
 * import them without dragging in firebase-admin, firebase-functions and
 * the Anthropic SDK — none of which a pure-logic test should need, and all
 * of which broke the test runner when it tried.
 *
 * No I/O, no SDK imports, no side effects.
 */

export type YelpBusiness = {
  /** Locale-formatted by Yelp; free on the search endpoint. */
  display_phone?: string;
  /** E.164 fallback. */
  phone?: string;
  id: string;
  name: string;
  is_closed: boolean;
  rating?: number;
  review_count?: number;
  price?: string;
  coordinates: { latitude: number; longitude: number };
  location: { display_address: string[]; city?: string; state?: string };
  image_url?: string;
  categories?: { alias: string; title: string }[];
};

export type GooglePlace = {
  /** Locale-formatted, e.g. "(305) 555-0134". Requested in the field mask. */
  nationalPhoneNumber?: string;
  /** E.164-ish fallback, used for non-US listings. */
  internationalPhoneNumber?: string;
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name: string }[];
  primaryType?: string;
  /** Google's own rating and review count — the only source once Yelp goes. */
  rating?: number;
  userRatingCount?: number;
  // Structured attributes — these are what make the app's Amenities and
  // Entertainment filters work. Without them every lounge stored an empty
  // `amenities` array, so selecting any of those chips returned zero
  // results (see src/utils/loungeSearch.ts's viableFilterOptions).
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  servesCocktails?: boolean;
  servesCoffee?: boolean;
  goodForWatchingSports?: boolean;
  goodForGroups?: boolean;
  reservable?: boolean;
  restroom?: boolean;
  parkingOptions?: {
    freeParkingLot?: boolean;
    paidParkingLot?: boolean;
    valetParking?: boolean;
    freeStreetParking?: boolean;
  };
};

// ---------------------------------------------------------------------------
// Relevance filtering
//
// A survey of the 8,285 imported lounges (2026-08-16) found ~1% that
// aren't cigar venues at all — a sandwich shop, a Dollar General, a few
// coffee chains. Small, but they're the first thing a member notices.
//
// The filters below deliberately use each API's own structured category
// data, never the business name. Name matching looks tempting and is a
// trap: the imported set includes Casa de Montecristo, Carnegie Club,
// Cortez Room and Tinder Box — all real, well-known cigar venues with no
// "cigar" anywhere in the name. Any regex broad enough to catch "Dollar
// General" also deletes those.
// ---------------------------------------------------------------------------

/** Yelp category aliases that indicate a genuine tobacco/cigar venue. */
const YELP_ALLOWED_CATEGORIES = new Set([
  'cigarbars',
  'hookah_bars',
  'tobaccoshops',
  'smokeshop',
  'smokeshops',
  'vapeshops',
  'lounges',
]);

/**
 * Yelp's category filter is an OR over the searched aliases, but results
 * still come back carrying their real categories — a business Yelp lists
 * primarily as `sandwiches` can surface on a `cigarbars` search. Checking
 * what Yelp actually calls the business drops those.
 *
 * Businesses with no categories at all are kept: absent data is not
 * evidence against, and Yelp only reached our results via a cigar/hookah
 * category search in the first place.
 */
export function isRelevantYelpBusiness(business: YelpBusiness): boolean {
  if (!business.categories || business.categories.length === 0) {
    return true;
  }
  return business.categories.some(category => YELP_ALLOWED_CATEGORIES.has(category.alias));
}

/**
 * Google primary types that are unambiguously a different kind of
 * business. Deliberately excludes `bar`, `night_club` and `liquor_store`
 * — plenty of real cigar lounges are primarily bars, and rejecting those
 * would lose more than it saves.
 */
const GOOGLE_REJECTED_TYPES = new Set([
  'restaurant', 'sandwich_shop', 'pizza_restaurant', 'fast_food_restaurant',
  'hamburger_restaurant', 'mexican_restaurant', 'chinese_restaurant',
  'coffee_shop', 'cafe', 'bakery', 'ice_cream_shop', 'meal_takeaway', 'meal_delivery',
  'barber_shop', 'beauty_salon', 'hair_salon', 'nail_salon', 'spa',
  'grocery_store', 'supermarket', 'convenience_store', 'department_store', 'discount_store',
  'gas_station', 'car_repair', 'car_wash', 'car_dealer',
  'hotel', 'motel', 'lodging', 'casino',
  'gym', 'fitness_center', 'bank', 'atm',
  'pharmacy', 'drugstore', 'dentist', 'doctor', 'hospital',
  'church', 'school', 'university',
]);

/** Name signal used ONLY to rescue a venue the type filter would reject. */
// Spelling variants matter here: "shisha" is also written shesha and
// sheesha, and a venue like "Mr Shesha's Coffee House" is a hookah lounge
// whose Google primary type is coffee_shop. Missing the variant is the
// difference between keeping it and silently dropping it.
const CIGAR_NAME_SIGNAL =
  /cigar|tobacco|tobacconist|humidor|hookah|shisha|shesha|sheesha|narghile|stogie|smoke|puff|vape/i;

/**
 * Rejects a Google result only when both signals agree it's unrelated —
 * an unambiguous non-lounge primary type AND nothing cigar-ish in the
 * name. Requiring both is what keeps real venues like "High End Cigars &
 * Cafe" (primary type `cafe`) and "King Corona Cigars Bar And Cafe" in,
 * while still dropping "7 Brew Coffee" and "Dollar General".
 */
export function isRelevantGooglePlace(place: GooglePlace): boolean {
  if (!place.primaryType || !GOOGLE_REJECTED_TYPES.has(place.primaryType)) {
    return true;
  }
  return CIGAR_NAME_SIGNAL.test(place.displayName?.text ?? '');
}

/**
 * Google's boolean attributes mapped onto the exact amenity labels the
 * app's filter chips look for (src/data/mockFilters.ts). The labels have
 * to match those chips or the filter still finds nothing — this is the
 * join between the two, and the reason it's a literal list rather than
 * something clever.
 */
export function amenitiesFromGoogle(place: GooglePlace): string[] {
  const amenities: string[] = [];
  if (place.outdoorSeating) amenities.push('Outdoor Patio');
  if (place.servesCocktails) amenities.push('Full Bar');
  if (place.servesCoffee) amenities.push('Coffee');
  if (place.liveMusic) amenities.push('Live Music');
  if (place.goodForWatchingSports) amenities.push('Sports Viewing');
  if (place.goodForGroups) amenities.push('Social');
  if (place.reservable) amenities.push('Reservations');
  if (place.parkingOptions?.valetParking) amenities.push('Valet Parking');
  if (
    place.parkingOptions?.freeParkingLot ||
    place.parkingOptions?.paidParkingLot ||
    place.parkingOptions?.freeStreetParking
  ) {
    amenities.push('Parking');
  }
  return amenities;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}
