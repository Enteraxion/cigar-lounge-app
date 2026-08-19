/**
 * Search and filtering. This is the logic that shipped two production bugs
 * in one week — chips that could never match anything, and a distance filter
 * that silently did nothing unless a toggle was on — so the tests here are
 * deliberately about *what a member observes*, not about internal shape.
 */

import type { LoungeType } from '../loungeType';
import {
  applySearchFilters,
  isPremiumLounge,
  sortLounges,
  viableFilterOptions,
} from '../loungeSearch';
import type { Lounge } from '../../services/loungeService';

const AUSTIN = { latitude: 30.2672, longitude: -97.7431 };

function lounge(id: string, over: Partial<Lounge> = {}): Lounge {
  return {
    id,
    name: `Lounge ${id}`,
    description: '',
    address: `${id} Main St, Austin, TX`,
    city: 'Austin, TX',
    coordinates: { lat: 30.2672, lng: -97.7431 },
    hours: 'Monday: 9:00 AM – 8:00 PM',
    status: 'open',
    images: ['img'],
    amenities: [],
    tags: [],
    priceRange: '$$',
    ratings: { overall: 4, atmosphere: 4, humidorVariety: 4, service: 4, comfort: 4 },
    reviewCount: 10,
    humidorItems: [],
    ...over,
  } as unknown as Lounge;
}

const NO_FILTERS = {
  distanceMiles: 25,
  nearCurrentLocation: false,
  cityQuery: '',
  availability: [] as string[],
  atmosphere: [] as string[],
  amenities: [] as string[],
  entertainment: [] as string[],
  loungeTypes: [] as LoungeType[],
};

describe('applySearchFilters', () => {
  it('returns everything when no filter is applied', () => {
    const all = [lounge('a'), lounge('b')];
    expect(applySearchFilters(all, NO_FILTERS, AUSTIN)).toHaveLength(2);
  });

  it('applies the distance radius only when nearCurrentLocation is on', () => {
    const far = lounge('far', { coordinates: { lat: 40.7128, lng: -74.006 } }); // NYC
    const near = lounge('near');

    // Off: distance is ignored entirely — this is the behaviour that made the
    // slider look broken, so it is pinned deliberately rather than assumed.
    expect(applySearchFilters([far, near], NO_FILTERS, AUSTIN)).toHaveLength(2);

    // On: the far lounge is excluded.
    const withRadius = { ...NO_FILTERS, nearCurrentLocation: true, distanceMiles: 25 };
    const result = applySearchFilters([far, near], withRadius, AUSTIN);
    expect(result.map(l => l.id)).toEqual(['near']);
  });

  it('honours a widened radius', () => {
    const midway = lounge('mid', { coordinates: { lat: 31.5493, lng: -97.1467 } }); // ~100mi
    const tight = { ...NO_FILTERS, nearCurrentLocation: true, distanceMiles: 25 };
    const wide = { ...NO_FILTERS, nearCurrentLocation: true, distanceMiles: 150 };
    expect(applySearchFilters([midway], tight, AUSTIN)).toHaveLength(0);
    expect(applySearchFilters([midway], wide, AUSTIN)).toHaveLength(1);
  });

  it('ANDs across sections and ORs within a section', () => {
    const quiet = lounge('quiet', { tags: ['Quiet'] });
    const social = lounge('social', { tags: ['Social'] });
    const both = lounge('both', { tags: ['Quiet', 'Full Bar'] });

    const orWithin = { ...NO_FILTERS, atmosphere: ['Quiet', 'Social'] };
    expect(applySearchFilters([quiet, social, both], orWithin, AUSTIN)).toHaveLength(3);

    const andAcross = { ...NO_FILTERS, atmosphere: ['Quiet'], amenities: ['Full Bar'] };
    expect(applySearchFilters([quiet, social, both], andAcross, AUSTIN).map(l => l.id)).toEqual([
      'both',
    ]);
  });

  it('matches open-now against real status', () => {
    const open = lounge('open', { status: 'open' });
    const closed = lounge('closed', { status: 'closed' });
    const filters = { ...NO_FILTERS, availability: ['open-now'] };
    expect(applySearchFilters([open, closed], filters, AUSTIN).map(l => l.id)).toEqual(['open']);
  });

  it('never mutates the input array', () => {
    const all = [lounge('a'), lounge('b')];
    const copy = [...all];
    applySearchFilters(all, { ...NO_FILTERS, nearCurrentLocation: true }, AUSTIN);
    expect(all).toEqual(copy);
  });
});

describe('viableFilterOptions', () => {
  // This function exists because the app was offering 20 chips that could
  // never return a result — the regression it guards is exactly that.
  const options = [{ label: 'Quiet' }, { label: 'Full Bar' }, { label: 'Live Music' }];

  it('hides every option when nothing in the dataset carries any attribute', () => {
    const bare = [lounge('a', { tags: ['imported-from-yelp'] })];
    expect(viableFilterOptions(bare, options)).toHaveLength(0);
  });

  it('keeps only the options something actually matches', () => {
    const some = [lounge('a', { tags: ['Quiet'] }), lounge('b', { amenities: ['Full Bar'] })];
    expect(viableFilterOptions(some, options).map(o => o.label)).toEqual(['Quiet', 'Full Bar']);
  });

  it('falls back to showing everything when there is no data to judge against', () => {
    // An empty result set says nothing about which attributes exist, so
    // hiding all filters there would be its own kind of wrong.
    expect(viableFilterOptions([], options)).toHaveLength(3);
  });
});

describe('sortLounges', () => {
  it('sorts by rating, highest first', () => {
    const low = lounge('low', { ratings: { overall: 3 } as never });
    const high = lounge('high', { ratings: { overall: 5 } as never });
    expect(sortLounges([low, high], 'highest-rated', AUSTIN).map(l => l.id)).toEqual([
      'high',
      'low',
    ]);
  });

  it('sorts by review count for most-reviewed', () => {
    const few = lounge('few', { reviewCount: 2 });
    const many = lounge('many', { reviewCount: 99 });
    expect(sortLounges([few, many], 'most-reviewed', AUSTIN).map(l => l.id)).toEqual([
      'many',
      'few',
    ]);
  });

  it('returns the list untouched for an unrecognised sort id', () => {
    // Pinned deliberately: an unknown id sorts nothing and raises nothing, so
    // a typo in a sort option would be invisible without this assertion.
    const all = [lounge('b'), lounge('a')];
    expect(sortLounges(all, 'not-a-real-sort', AUSTIN).map(l => l.id)).toEqual(['b', 'a']);
  });

  it('sorts by distance, nearest first', () => {
    const far = lounge('far', { coordinates: { lat: 40.7128, lng: -74.006 } });
    const near = lounge('near');
    expect(sortLounges([far, near], 'distance', AUSTIN).map(l => l.id)).toEqual(['near', 'far']);
  });

  it('does not mutate the input array', () => {
    const all = [lounge('b', { ratings: { overall: 3 } as never }), lounge('a')];
    const copy = [...all];
    sortLounges(all, 'highest-rated', AUSTIN);
    expect(all).toEqual(copy);
  });
});

describe('isPremiumLounge', () => {
  it('is driven by real rating and price signals, not a hardcoded list', () => {
    const premium = lounge('p', { ratings: { overall: 4.8 } as never, priceRange: '$$$$' });
    const ordinary = lounge('o', { ratings: { overall: 3.2 } as never, priceRange: '$' });
    expect(isPremiumLounge(premium)).toBe(true);
    expect(isPremiumLounge(ordinary)).toBe(false);
  });
});

describe('applySearchFilters — lounge type', () => {
  const cigarBar = lounge('c', { name: 'King Corona Cigars' });
  const hookahBar = lounge('h', { name: 'Sahara Shisha Lounge' });
  const unclear = lounge('u', { name: 'The Metropolitan Society' });
  const all = [cigarBar, hookahBar, unclear];

  it('returns everything when no type is selected', () => {
    expect(applySearchFilters(all, NO_FILTERS, AUSTIN)).toHaveLength(3);
  });

  it('narrows to the selected type', () => {
    const result = applySearchFilters(all, { ...NO_FILTERS, loungeTypes: ['hookah'] }, AUSTIN);
    expect(result.map(l => l.id)).toEqual(['h']);
  });

  it('ORs multiple selected types', () => {
    const result = applySearchFilters(
      all,
      { ...NO_FILTERS, loungeTypes: ['cigar', 'hookah'] },
      AUSTIN,
    );
    expect(result.map(l => l.id).sort()).toEqual(['c', 'h']);
  });

  it('reaches the untypeable venues through "Other"', () => {
    // 36.7% of the real collection lands here; without this option those
    // lounges become unreachable the moment any type is selected.
    const result = applySearchFilters(all, { ...NO_FILTERS, loungeTypes: ['unknown'] }, AUSTIN);
    expect(result.map(l => l.id)).toEqual(['u']);
  });

  it('respects real Yelp categories over the name', () => {
    const mislabelled = lounge('m', {
      name: 'Havana Cigar Lounge',
      yelpCategories: ['hookah_bars'],
    });
    expect(
      applySearchFilters([mislabelled], { ...NO_FILTERS, loungeTypes: ['cigar'] }, AUSTIN),
    ).toHaveLength(0);
    expect(
      applySearchFilters([mislabelled], { ...NO_FILTERS, loungeTypes: ['hookah'] }, AUSTIN),
    ).toHaveLength(1);
  });
});
