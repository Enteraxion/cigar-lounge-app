/**
 * cityAutocomplete
 *
 * Real city-name autocomplete for SearchSuggestionsScreen's "Cities"
 * section — previously that list only ever showed cities that already
 * had lounges in Firestore (capped at 10), so typing "New" wouldn't
 * surface "New Orleans" unless it happened to already be one of our
 * top 10 most-covered cities. src/data/usCities.json is a bundled,
 * public-domain dataset (US Census Bureau 2025 Gazetteer, incorporated
 * places only — Census-designated places excluded) of ~19,800 real US
 * cities/towns, so this works offline with no API key or billing,
 * unlike Google Places Autocomplete.
 *
 * INTERNATIONAL_CITIES below adds the same major international cities
 * scripts/backfillCityHours.ts seeds real lounge data for (Julian
 * Brinkley's TestFlight feedback, 2026-08-13) so they're recognized here
 * too — both for this file's own autocomplete and for
 * isKnownUsCityName's live-refresh gate, which some of these already
 * coincidentally passed anyway (see that function's comment).
 */

import usCities from '../data/usCities.json';

type CityRow = [name: string, state: string, lat: number, lng: number];

const INTERNATIONAL_CITIES: CityRow[] = [
  ['Munich', 'Germany', 48.1351, 11.582],
  ['Berlin', 'Germany', 52.52, 13.405],
  ['Madrid', 'Spain', 40.4168, -3.7038],
  ['London', 'UK', 51.5074, -0.1278],
  ['Paris', 'France', 48.8566, 2.3522],
  ['Rome', 'Italy', 41.9028, 12.4964],
  ['Barcelona', 'Spain', 41.3874, 2.1686],
  ['Amsterdam', 'Netherlands', 52.3676, 4.9041],
];

const CITIES = [...(usCities as CityRow[]), ...INTERNATIONAL_CITIES];

const CITY_NAME_SET = new Set(CITIES.map(([name]) => name.toLowerCase()));

/**
 * Exact (case-insensitive) match against a real US city/town name —
 * accepts "City" or "City, ST" (the state part is only stripped, not
 * validated). Used to decide whether a search query is worth triggering
 * a live per-city Yelp refresh (see refreshCityLounges) for: doing that
 * for every search term, including lounge/brand names that clearly
 * aren't cities, wastes a paid Yelp API call and needlessly delays
 * results loading for searches that were never going to be a city
 * refresh in the first place.
 */
export function isKnownUsCityName(query: string): boolean {
  const cityPart = query.trim().toLowerCase().split(',')[0].trim();
  return cityPart.length > 0 && CITY_NAME_SET.has(cityPart);
}

export type CityMatch = { id: string; name: string; state: string; lat: number; lng: number };

/**
 * Coordinates for a free-text city label like "New York, NY" or "Munich,
 * Germany" — used to anchor the Cigar Passport's distance maths to the
 * member's own home city (see src/utils/passport.ts). Matches on the city
 * name, preferring a row whose state/country also matches when one is
 * given, so "Portland, OR" doesn't resolve to Portland, ME. Returns null
 * for anything not in the dataset; callers should treat distance as
 * unknown rather than guessing a fallback origin.
 */
export function findCityCoordinates(label: string): { lat: number; lng: number } | null {
  const trimmed = label.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const [namePart, regionPart] = trimmed.split(',').map(part => part.trim());
  const matches = CITIES.filter(([name]) => name.toLowerCase() === namePart);

  if (matches.length > 0) {
    // An explicit region disambiguates outright: "Florida, NY" is the town.
    const exact = regionPart
      ? matches.find(([, state]) => state.toLowerCase() === regionPart)
      : undefined;
    if (exact) {
      const [, , lat, lng] = exact;
      return { lat, lng };
    }
    if (!regionPart && shouldPreferState(namePart, matches)) {
      const state = findStateCoordinates(namePart);
      if (state) {
        return state;
      }
    }
    const [, , lat, lng] = matches[0];
    return { lat, lng };
  }

  // Not a city at all — try it as a state name or state code.
  return findStateCoordinates(trimmed);
}

/**
 * For a bare name that is both a state and a town, decides which was meant.
 *
 * Plenty of state names are also small towns somewhere else, and the town was
 * winning purely because it lives in the city table: "Florida" resolved to
 * Florida, New York — population in the low thousands, and 1,100 miles from
 * the state a member typing "Florida" is sitting in.
 *
 * The rule that separates the two cases is whether the same-named town is
 * *inside* the state it shares a name with:
 *
 *   "New York"  town of New York is in NY  -> the city was meant (NYC)
 *   "Florida"   town of Florida is in NY   -> the state was meant
 *   "Wyoming"   town of Wyoming is in MI   -> the state was meant
 *
 * A town that is the namesake of its own state is a major city; a town that
 * borrowed another state's name is not the thing anyone means.
 */
function shouldPreferState(namePart: string, matches: CityRow[]): boolean {
  const stateCode = STATE_CODE_BY_NAME[namePart];
  if (!stateCode) {
    return false;
  }
  return !matches.some(([, state]) => state === stateCode);
}

/**
 * Full US state names to the two-letter codes usCities.json is keyed by.
 * DC included because people write it as a place and it behaves like one.
 */
const STATE_CODE_BY_NAME: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC',
};

/**
 * Resolves a whole state to a point at the centre of its towns.
 *
 * A member filling in "Home City" writes what they'd say out loud, and for
 * plenty of people that is the state — this app's own owner has "New jersey"
 * saved. That used to resolve to nothing, which had consequences well beyond
 * a blank field: every Passport distance rendered "—", and the Home screen
 * fell through to its static fallback region and measured "Nearby Lounges"
 * from there.
 *
 * The mean of the state's incorporated places, rather than a named city,
 * because picking one city would be inventing a claim the member didn't make
 * — and because the dataset carries no population to justify the choice. A
 * state-sized answer is imprecise by nature, which is honest: it is being
 * used to seed a 60-mile search, not to report how far someone travelled.
 */
function findStateCoordinates(query: string): { lat: number; lng: number } | null {
  const code = STATE_CODE_BY_NAME[query] ?? (query.length === 2 ? query.toUpperCase() : null);
  if (!code) {
    return null;
  }
  let latTotal = 0;
  let lngTotal = 0;
  let count = 0;
  for (const [, state, lat, lng] of CITIES) {
    if (state === code) {
      latTotal += lat;
      lngTotal += lng;
      count += 1;
    }
  }
  return count > 0 ? { lat: latTotal / count, lng: lngTotal / count } : null;
}

/**
 * Matches on the city name only (not "City, ST"), so "new" finds "New
 * York", "New Orleans", "Newark", etc. Results prioritize names that
 * *start with* the query over ones that merely contain it, then sort
 * alphabetically — there's no population data in this dataset to rank
 * by relevance instead.
 */
export function searchUsCities(query: string, limit = 8): CityMatch[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const startsWith: CityRow[] = [];
  const contains: CityRow[] = [];
  for (const row of CITIES) {
    const lowerName = row[0].toLowerCase();
    if (lowerName.startsWith(trimmed)) {
      startsWith.push(row);
    } else if (lowerName.includes(trimmed)) {
      contains.push(row);
    }
  }

  const sortByName = (a: CityRow, b: CityRow) =>
    a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]);
  startsWith.sort(sortByName);
  contains.sort(sortByName);

  return [...startsWith, ...contains].slice(0, limit).map(([name, state, lat, lng]) => ({
    id: `${name}-${state}`,
    name: `${name}, ${state}`,
    state,
    lat,
    lng,
  }));
}
