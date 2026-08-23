/**
 * normalizeCityStats
 *
 * These tests exist because of a bug that type-checked, linted and unit-tested
 * perfectly clean while breaking the entire Search tab (BUG-003, 2026-08-23).
 *
 * `aggregates/cityStats` has two writers — scripts/buildCityStats.ts and the
 * admin portal's `adminRebuildCityStats` Cloud Function — and the app is a
 * third party that only reads it. Nothing in TypeScript connects the three:
 * the writers are in different tsconfig projects, and the reader casts an
 * untyped Firestore document. So when the Cloud Function wrote `{city, count,
 * image}` against a reader expecting `{id, name, count, imageUri}`, every city
 * in the app was rendered as the string "undefined" and no city had a photo,
 * with no error anywhere.
 *
 * A schema comment cannot fail a build. This can.
 */

import { normalizeCityStats } from '../loungeService';

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: jest.fn(),
  collectionGroup: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAt: jest.fn(),
  endAt: jest.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

describe('normalizeCityStats', () => {
  it('reads the canonical shape buildCityStats.ts writes', () => {
    const [city] = normalizeCityStats([
      { id: 'houston-tx', name: 'Houston, TX', count: 165, imageUri: 'https://x/p.jpg' },
    ]);

    expect(city).toEqual({
      id: 'houston-tx',
      name: 'Houston, TX',
      count: 165,
      imageUri: 'https://x/p.jpg',
    });
  });

  it('reads the legacy {city, image} shape the Cloud Function used to write', () => {
    const [city] = normalizeCityStats([
      { city: 'Berlin, Germany', count: 166, image: 'https://x/b.jpg' },
    ]);

    // The name is what the Search tab renders, and the photo is what decides
    // whether the city appears in Popular Destinations at all. Both had to
    // survive the rename, or a stale document silently empties the tab again.
    expect(city.name).toBe('Berlin, Germany');
    expect(city.imageUri).toBe('https://x/b.jpg');
    expect(city.count).toBe(166);
  });

  it('derives a slug when the entry carries no id', () => {
    const [city] = normalizeCityStats([{ city: 'Washington, D.C.', count: 12 }]);

    expect(city.id).toBe('washington-d-c-');
  });

  it('never renders the word "undefined" as a city name', () => {
    // The exact regression. An entry the reader cannot name is dropped; it is
    // not coerced with String(), which is what produced 2,017 cities all
    // called "undefined".
    const result = normalizeCityStats([
      { count: 40, image: 'https://x/a.jpg' },
      { name: '   ', count: 9 },
      { name: 'Austin, TX', count: 51 },
    ]);

    expect(result.map(city => city.name)).toEqual(['Austin, TX']);
    expect(result.every(city => city.name !== 'undefined')).toBe(true);
  });

  it('omits imageUri rather than storing null, so the photo filters work', () => {
    // Popular Destinations and the Featured Travel Guide both filter on
    // `!!imageUri`. A literal null passed straight through would be falsy and
    // so behave correctly, but the string "null" would not — this pins that
    // the field is absent, not stringified.
    const [city] = normalizeCityStats([{ name: 'Reno, NV', count: 4, imageUri: null }]);

    expect(city.imageUri).toBeUndefined();
    expect('imageUri' in city).toBe(false);
  });

  it('treats a non-numeric count as zero rather than NaN', () => {
    const [city] = normalizeCityStats([{ name: 'Tulsa, OK', count: 'lots' }]);

    expect(city.count).toBe(0);
  });
});
