/**
 * The smaller pure derivations: wishlist, cigar-of-the-week, image
 * fallbacks, tab-bar geometry, tag display and city lookup.
 *
 * Each of these replaced a block of hardcoded fiction, so the property that
 * matters most is the same across all of them: given no data, produce an
 * honest empty result — never a plausible-looking invented one.
 */

import { buildWishlist } from '../wishlist';
import { cigarOfTheWeek, CIGARS } from '../../data/cigars';
import { loungeImageUri } from '../loungeImage';
import { tabBarClearance, tabBarTop, TAB_BAR_HEIGHT } from '../tabBarLayout';
import { displayTags } from '../displayTags';
import { findCityCoordinates, isKnownUsCityName, searchUsCities } from '../cityAutocomplete';
import type { Lounge } from '../../services/loungeService';
import type { Visit } from '../passport';

function lounge(id: string, over: Partial<Lounge> = {}): Lounge {
  return {
    id,
    name: `Lounge ${id}`,
    address: `${id} Main St`,
    city: 'Austin, TX',
    coordinates: { lat: 30.2672, lng: -97.7431 },
    images: ['real-image'],
    tags: [],
    amenities: [],
    ratings: { overall: 4 },
    reviewCount: 5,
    ...over,
  } as unknown as Lounge;
}

describe('buildWishlist', () => {
  it('produces an honest empty state with nothing saved', () => {
    const w = buildWishlist([], []);
    expect(w.destinations).toEqual([]);
    expect(w.activePlan.destinationsCount).toBe(0);
    expect(w.activePlan.savedLoungesCount).toBe(0);
    expect(w.activePlan.heroImage).toBeNull();
    expect(w.nextStopHighlight).toBeNull();
  });

  it('groups saved lounges into destinations by city', () => {
    const w = buildWishlist([
      lounge('a', { city: 'Austin, TX' }),
      lounge('b', { city: 'Austin, TX' }),
      lounge('c', { city: 'Dallas, TX' }),
    ]);
    expect(w.destinations).toHaveLength(2);
    expect(w.destinations[0]).toMatchObject({ city: 'Austin', loungesSaved: 2 });
    expect(w.activePlan.savedLoungesCount).toBe(3);
  });

  it('ignores saved lounges with no city rather than making a blank card', () => {
    const w = buildWishlist([lounge('a', { city: undefined })]);
    expect(w.destinations).toEqual([]);
    expect(w.activePlan.savedLoungesCount).toBe(1);
  });

  it('names the plan after where the member is actually going', () => {
    expect(buildWishlist([lounge('a', { city: 'Austin, TX' })]).activePlan.name).toBe('Austin Trip');
    expect(
      buildWishlist([lounge('a', { city: 'Austin, TX' }), lounge('b', { city: 'Dallas, TX' })])
        .activePlan.name,
    ).toContain('&');
    expect(buildWishlist([]).activePlan.name).toBe('Your Wishlist');
  });

  it('suggests the best-rated saved lounge the member has not reviewed', () => {
    const visits = [{ loungeId: 'good' }] as unknown as Visit[];
    const w = buildWishlist(
      [
        lounge('good', { ratings: { overall: 5 } as never }),
        lounge('next', { ratings: { overall: 4 } as never }),
      ],
      visits,
    );
    expect(w.nextStopHighlight?.loungeId).toBe('next');
  });

  it('has no next stop once every save has been visited', () => {
    const visits = [{ loungeId: 'a' }] as unknown as Visit[];
    expect(buildWishlist([lounge('a')], visits).nextStopHighlight).toBeNull();
  });
});

describe('cigarOfTheWeek', () => {
  it('returns a real cigar with complete specifications', () => {
    const c = cigarOfTheWeek(new Date('2026-08-16T12:00:00Z'));
    expect(c.brand).toBeTruthy();
    expect(c.name).toBeTruthy();
    expect(c.wrapper).toBeTruthy();
    expect(c.burnTime).toMatch(/Mins/);
    expect(c.imageUri).toBeTruthy();
  });

  it('is stable within a week and changes across weeks', () => {
    const monday = new Date('2026-08-10T09:00:00Z');
    const friday = new Date('2026-08-14T23:00:00Z');
    const nextMonday = new Date('2026-08-17T09:00:00Z');
    expect(cigarOfTheWeek(monday).name).toBe(cigarOfTheWeek(friday).name);
    expect(cigarOfTheWeek(nextMonday).name).not.toBe(cigarOfTheWeek(monday).name);
  });

  it('cycles through the catalogue without ever going out of bounds', () => {
    const start = new Date('2026-01-05T00:00:00Z');
    for (let week = 0; week < CIGARS.length * 2; week += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + week * 7);
      expect(cigarOfTheWeek(d)).toBeDefined();
      expect(cigarOfTheWeek(d).name).toBeTruthy();
    }
  });
});

describe('loungeImageUri', () => {
  it('prefers the lounge’s own photo', () => {
    expect(loungeImageUri(lounge('a'))).toBe('real-image');
  });

  it('never returns undefined for a lounge with no photo', () => {
    // Returning undefined is what rendered a blank box for half the directory.
    const uri = loungeImageUri({ id: 'no-photo', images: [] });
    expect(typeof uri).toBe('string');
    expect(uri.length).toBeGreaterThan(0);
  });

  it('is stable for the same lounge across calls', () => {
    const a = loungeImageUri({ id: 'stable', images: [] });
    const b = loungeImageUri({ id: 'stable', images: [] });
    expect(a).toBe(b);
  });

  it('handles a missing images field entirely', () => {
    expect(() => loungeImageUri({ id: 'x' })).not.toThrow();
  });
});

describe('tabBarLayout', () => {
  it('sits above the home indicator when there is one', () => {
    expect(tabBarTop(34)).toBe(34 + TAB_BAR_HEIGHT);
  });

  it('falls back to a fixed gap on devices without one', () => {
    expect(tabBarTop(0)).toBe(24 + TAB_BAR_HEIGHT);
  });

  it('always leaves clearance above the bar itself', () => {
    expect(tabBarClearance(34)).toBeGreaterThan(tabBarTop(34));
    expect(tabBarClearance(0)).toBeGreaterThan(tabBarTop(0));
  });

  it('clears the bar on a home-indicator device, where a literal 96 did not', () => {
    // The regression this pins, three times over: floating buttons were
    // hardcoded to bottom:96 while the bar ends at 98 on any device with a
    // home indicator, so they rendered behind it.
    expect(tabBarClearance(34)).toBeGreaterThan(96);
  });
});

describe('displayTags', () => {
  it('strips internal import markers a member should never see', () => {
    expect(displayTags(['imported-from-yelp', 'Cigar Bar'])).toEqual(['Cigar Bar']);
    expect(displayTags(['imported-from-google'])).toEqual([]);
  });

  it('handles an empty or missing tag list', () => {
    expect(displayTags([])).toEqual([]);
  });
});

describe('cityAutocomplete', () => {
  it('resolves a real US city to coordinates', () => {
    const austin = findCityCoordinates('Austin, TX');
    expect(austin).not.toBeNull();
    expect(austin!.lat).toBeGreaterThan(30);
    expect(austin!.lat).toBeLessThan(31);
  });

  it('disambiguates same-named cities by state', () => {
    const or = findCityCoordinates('Portland, OR');
    const me = findCityCoordinates('Portland, ME');
    expect(or).not.toBeNull();
    expect(me).not.toBeNull();
    expect(or!.lng).toBeLessThan(me!.lng); // Oregon is far west of Maine
  });

  it('returns null for something that is not a place', () => {
    expect(findCityCoordinates('asdfghjkl')).toBeNull();
    expect(findCityCoordinates('')).toBeNull();
  });

  it('recognises real city names and rejects lounge names', () => {
    expect(isKnownUsCityName('Houston')).toBe(true);
    expect(isKnownUsCityName('Houston, TX')).toBe(true);
    expect(isKnownUsCityName('Casa de Montecristo')).toBe(false);
  });

  it('prioritises prefix matches in autocomplete', () => {
    const results = searchUsCities('new', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase().startsWith('new')).toBe(true);
  });
});

describe('findCityCoordinates — state fallback', () => {
  it('resolves a full state name a member might type as their home city', () => {
    // Real data: this app's owner has "New jersey" saved as their home city.
    // Before this existed it resolved to null, which made every Passport
    // distance "—" and sent Home's "nearby" origin to the fallback region.
    const nj = findCityCoordinates('New jersey');
    expect(nj).not.toBeNull();
    expect(nj!.lat).toBeGreaterThan(38.5);
    expect(nj!.lat).toBeLessThan(41.5);
    expect(nj!.lng).toBeGreaterThan(-76);
    expect(nj!.lng).toBeLessThan(-73.5);
  });

  it('is case-insensitive across state spellings', () => {
    expect(findCityCoordinates('NEW JERSEY')).toEqual(findCityCoordinates('new jersey'));
  });

  it('resolves a two-letter state code', () => {
    const tx = findCityCoordinates('TX');
    expect(tx).not.toBeNull();
    expect(tx!.lat).toBeGreaterThan(25);
    expect(tx!.lat).toBeLessThan(37);
  });

  it('still prefers a city when the name is both', () => {
    // "Washington" is a state and also a city in several states. A city match
    // is the more specific reading and must win.
    const washington = findCityCoordinates('Washington, DC');
    expect(washington).not.toBeNull();
    expect(washington!.lat).toBeGreaterThan(38);
    expect(washington!.lat).toBeLessThan(39.5);
  });

  it('lands inside the state, not in the ocean', () => {
    for (const [state, minLat, maxLat] of [
      ['Florida', 25, 31],
      ['California', 32, 42],
      ['Texas', 25, 37],
    ] as const) {
      const point = findCityCoordinates(state);
      expect(point).not.toBeNull();
      expect(point!.lat).toBeGreaterThan(minLat);
      expect(point!.lat).toBeLessThan(maxLat);
    }
  });

  it('returns null for something that is neither city nor state', () => {
    expect(findCityCoordinates('Freedonia')).toBeNull();
    expect(findCityCoordinates('ZZ')).toBeNull();
  });
});

describe('findCityCoordinates — state vs same-named town', () => {
  it('prefers the state when the same-named town is in a different state', () => {
    // "Florida" used to resolve to the town of Florida, New York — 1,100
    // miles from where anyone typing "Florida" is sitting.
    const florida = findCityCoordinates('Florida');
    expect(florida!.lat).toBeGreaterThan(25);
    expect(florida!.lat).toBeLessThan(31);
  });

  it('prefers the city when the town is the namesake of its own state', () => {
    // A town that shares its own state's name is a major city, so "New York"
    // means the city, not a point in the middle of upstate.
    const newYork = findCityCoordinates('New York');
    expect(newYork!.lat).toBeGreaterThan(40.4);
    expect(newYork!.lat).toBeLessThan(41);
    expect(newYork!.lng).toBeGreaterThan(-74.3);
    expect(newYork!.lng).toBeLessThan(-73.7);
  });

  it('an explicit state overrides the preference entirely', () => {
    // "Florida, NY" is unambiguous: the member means the town.
    const town = findCityCoordinates('Florida, NY');
    expect(town!.lat).toBeGreaterThan(40);
    expect(town!.lat).toBeLessThan(42);
  });

  it('handles the other state names that are also towns elsewhere', () => {
    for (const [state, minLat, maxLat] of [
      ['Wyoming', 41, 45],
      ['Nevada', 35, 42],
      ['Indiana', 37.5, 42],
      ['California', 32, 42],
    ] as const) {
      const point = findCityCoordinates(state);
      expect(point).not.toBeNull();
      expect(point!.lat).toBeGreaterThan(minLat);
      expect(point!.lat).toBeLessThan(maxLat);
    }
  });
});
