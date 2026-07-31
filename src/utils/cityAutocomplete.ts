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
 */

import usCities from '../data/usCities.json';

type CityRow = [name: string, state: string, lat: number, lng: number];

const CITIES = usCities as CityRow[];

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
