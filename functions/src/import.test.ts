/**
 * Import relevance filters.
 *
 * These decide what ends up in the members' directory. The failure this
 * guards against is documented and real: the directory acquired a sandwich
 * shop, three Dollar Generals and several coffee chains, while the naive fix
 * — filtering on the business name — would have deleted Casa de Montecristo,
 * Carnegie Club, Cortez Room and Tinder Box, all real cigar venues with no
 * "cigar" in their name. Both halves of that are pinned below.
 */

import {
  amenitiesFromGoogle,
  isRelevantGooglePlace,
  isRelevantYelpBusiness,
  normalizeName,
  type GooglePlace,
  type YelpBusiness,
} from './relevance';

function yelp(categories?: { alias: string; title: string }[]): YelpBusiness {
  return {
    id: 'y1',
    name: 'Somewhere',
    is_closed: false,
    coordinates: { latitude: 0, longitude: 0 },
    location: { display_address: [] },
    categories,
  } as YelpBusiness;
}

function google(name: string, primaryType?: string, extra: Partial<GooglePlace> = {}): GooglePlace {
  return { id: 'g1', displayName: { text: name }, primaryType, ...extra } as GooglePlace;
}

describe('isRelevantYelpBusiness', () => {
  it('keeps a cigar bar', () => {
    expect(isRelevantYelpBusiness(yelp([{ alias: 'cigarbars', title: 'Cigar Bars' }]))).toBe(true);
  });

  it('keeps a hookah bar — deliberately in scope', () => {
    expect(isRelevantYelpBusiness(yelp([{ alias: 'hookah_bars', title: 'Hookah' }]))).toBe(true);
  });

  it('drops a sandwich shop that surfaced on a cigar search', () => {
    expect(isRelevantYelpBusiness(yelp([{ alias: 'sandwiches', title: 'Sandwiches' }]))).toBe(false);
  });

  it('keeps a business with no categories — absent data is not evidence against', () => {
    expect(isRelevantYelpBusiness(yelp(undefined))).toBe(true);
    expect(isRelevantYelpBusiness(yelp([]))).toBe(true);
  });

  it('keeps a business if any one of several categories qualifies', () => {
    const mixed = yelp([
      { alias: 'restaurants', title: 'Restaurants' },
      { alias: 'cigarbars', title: 'Cigar Bars' },
    ]);
    expect(isRelevantYelpBusiness(mixed)).toBe(true);
  });
});

describe('isRelevantGooglePlace', () => {
  it('drops an unambiguous non-lounge', () => {
    expect(isRelevantGooglePlace(google('Dollar General', 'discount_store'))).toBe(false);
    expect(isRelevantGooglePlace(google('7 Brew Coffee', 'coffee_shop'))).toBe(false);
  });

  it('rescues a real cigar venue whose primary type looks wrong', () => {
    // Both signals must agree before anything is rejected — this is the
    // half that protects genuine venues.
    expect(isRelevantGooglePlace(google('High End Cigars & Cafe', 'cafe'))).toBe(true);
    expect(isRelevantGooglePlace(google('King Corona Cigars Bar And Cafe', 'cafe'))).toBe(true);
  });

  it('never rejects a bar, night club or liquor store', () => {
    // Plenty of real cigar lounges are primarily bars.
    expect(isRelevantGooglePlace(google('The Cortez Room', 'bar'))).toBe(true);
    expect(isRelevantGooglePlace(google('Carnegie Club', 'night_club'))).toBe(true);
    expect(isRelevantGooglePlace(google('Casa de Montecristo', 'liquor_store'))).toBe(true);
  });

  it('keeps anything with no primary type at all', () => {
    expect(isRelevantGooglePlace(google('Unknown Place', undefined))).toBe(true);
  });

  it('recognises hookah and tobacco naming, not just the word cigar', () => {
    expect(isRelevantGooglePlace(google("Mr Shesha's Coffee House", 'coffee_shop'))).toBe(true);
    expect(isRelevantGooglePlace(google('Tobacco Road Cafe', 'cafe'))).toBe(true);
  });
});

describe('amenitiesFromGoogle', () => {
  it('returns nothing when Google supplied no attributes', () => {
    expect(amenitiesFromGoogle(google('x'))).toEqual([]);
  });

  it('maps attributes onto the exact labels the app’s filter chips look for', () => {
    // If these strings drift from src/data/mockFilters.ts the filters go
    // silently dead again, which is the whole reason this test exists.
    const rich = google('x', 'bar', {
      outdoorSeating: true,
      servesCocktails: true,
      liveMusic: true,
      goodForWatchingSports: true,
    });
    const amenities = amenitiesFromGoogle(rich);
    expect(amenities).toContain('Outdoor Patio');
    expect(amenities).toContain('Full Bar');
    expect(amenities).toContain('Live Music');
    expect(amenities).toContain('Sports Viewing');
  });

  it('collapses the parking variants into one label', () => {
    const free = google('x', 'bar', { parkingOptions: { freeParkingLot: true } });
    const valet = google('x', 'bar', { parkingOptions: { valetParking: true } });
    expect(amenitiesFromGoogle(free)).toContain('Parking');
    expect(amenitiesFromGoogle(valet)).toContain('Valet Parking');
  });

  it('treats false and absent identically', () => {
    expect(amenitiesFromGoogle(google('x', 'bar', { outdoorSeating: false }))).toEqual([]);
  });
});

describe('normalizeName', () => {
  it('makes cross-source name matching punctuation- and case-insensitive', () => {
    expect(normalizeName("Joe's Cigar Bar")).toBe(normalizeName('JOES CIGAR BAR'));
    expect(normalizeName('The Reserve — Lounge')).toBe(normalizeName('The Reserve Lounge'));
  });
});
