/**
 * The Cigar Passport is derived entirely from reviews — every headline
 * number a member sees about their own travel comes out of buildPassport.
 * A silent arithmetic bug here shows a member a confident, wrong figure,
 * which is why this file tests the edges (no home city, duplicate visits,
 * missing lounges) and not just the happy path.
 */

import { buildPassport, groupVisitsByRecency, suggestNextLounge } from '../passport';
import type { Lounge } from '../../services/loungeService';
import type { UserReviewEntry } from '../../services/userActionsService';

type Ts = { toDate: () => Date };
const ts = (iso: string): Ts => ({ toDate: () => new Date(iso) });

function lounge(id: string, over: Partial<Lounge> = {}): Lounge {
  return {
    id,
    name: `Lounge ${id}`,
    description: '',
    address: `${id} Main St`,
    city: 'Austin, TX',
    coordinates: { lat: 30.2672, lng: -97.7431 },
    hours: '',
    status: 'open',
    images: ['img'],
    amenities: [],
    tags: [],
    priceRange: '$$',
    ratings: { overall: 4.5, atmosphere: 4, humidorVariety: 4, service: 4, comfort: 4 },
    reviewCount: 3,
    humidorItems: [],
    ...over,
  } as unknown as Lounge;
}

function review(loungeId: string, visitedAt: string, over: Partial<UserReviewEntry> = {}) {
  return {
    id: `r-${loungeId}-${visitedAt}`,
    loungeId,
    rating: 4,
    text: 'Good visit',
    photos: [],
    visitDate: ts(visitedAt),
    ...over,
  } as unknown as UserReviewEntry;
}

const AUSTIN = { lat: 30.2672, lng: -97.7431 };

describe('buildPassport', () => {
  it('returns an empty, non-throwing summary when the member has no reviews', () => {
    const p = buildPassport([], [], AUSTIN);
    expect(p.visits).toEqual([]);
    expect(p.loungesVisited).toBe(0);
    expect(p.milesTraveled).toBe(0);
    expect(p.averageRating).toBeNull();
    expect(p.firstVisit).toBeNull();
    expect(p.latestVisit).toBeNull();
  });

  it('drops reviews whose lounge no longer exists rather than throwing', () => {
    const p = buildPassport([review('gone', '2026-01-01')], [], AUSTIN);
    expect(p.visits).toHaveLength(0);
  });

  it('counts a lounge reviewed twice as one lounge visited', () => {
    const p = buildPassport(
      [review('a', '2026-01-01'), review('a', '2026-02-01')],
      [lounge('a')],
      AUSTIN,
    );
    expect(p.visits).toHaveLength(2);
    expect(p.loungesVisited).toBe(1);
  });

  it('orders visits newest first', () => {
    const p = buildPassport(
      [review('a', '2026-01-01'), review('b', '2026-03-01'), review('c', '2026-02-01')],
      [lounge('a'), lounge('b'), lounge('c')],
      AUSTIN,
    );
    expect(p.visits.map(v => v.loungeId)).toEqual(['b', 'c', 'a']);
    expect(p.latestVisit?.loungeId).toBe('b');
    expect(p.firstVisit?.loungeId).toBe('a');
  });

  it('reports every distance as unknown when the home city is not recognised', () => {
    // The alternative — computing from a guessed origin — would invent
    // travel the member never did, which is the bug this guards.
    const p = buildPassport([review('a', '2026-01-01')], [lounge('a')], null);
    expect(p.visits[0].distanceFromHomeMiles).toBeNull();
    expect(p.milesTraveled).toBe(0);
    expect(p.furthestTripMiles).toBe(0);
  });

  it('counts states from "City, ST" and ignores lounges with no city', () => {
    const p = buildPassport(
      [review('a', '2026-01-01'), review('b', '2026-01-02'), review('c', '2026-01-03')],
      [
        lounge('a', { city: 'Austin, TX' }),
        lounge('b', { city: 'Dallas, TX' }),
        lounge('c', { city: undefined }),
      ],
      AUSTIN,
    );
    expect(p.statesExplored).toBe(1);
    expect(p.citiesExplored).toBe(2);
  });

  it('computes a real distance when the home city is known', () => {
    // Austin -> Dallas is ~180 miles; assert a band, not a magic number.
    const p = buildPassport(
      [review('d', '2026-01-01')],
      [lounge('d', { coordinates: { lat: 32.7767, lng: -96.797 }, city: 'Dallas, TX' })],
      AUSTIN,
    );
    expect(p.milesTraveled).toBeGreaterThan(150);
    expect(p.milesTraveled).toBeLessThan(220);
  });

  it('averages ratings to one decimal place', () => {
    const p = buildPassport(
      [review('a', '2026-01-01', { rating: 5 }), review('b', '2026-01-02', { rating: 4 })],
      [lounge('a'), lounge('b')],
      AUSTIN,
    );
    expect(p.averageRating).toBe(4.5);
  });

  it('counts a streak of consecutive weeks and stops at a gap', () => {
    const now = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.toISOString();
    };
    // This week and last week, then a gap, then four weeks ago.
    const p = buildPassport(
      [review('a', daysAgo(0)), review('b', daysAgo(7)), review('c', daysAgo(28))],
      [lounge('a'), lounge('b'), lounge('c')],
      AUSTIN,
    );
    expect(p.weekStreak).toBeGreaterThanOrEqual(1);
    expect(p.weekStreak).toBeLessThanOrEqual(2);
  });
});

describe('groupVisitsByRecency', () => {
  it('returns no groups for no visits', () => {
    expect(groupVisitsByRecency([])).toEqual([]);
  });

  it('labels today and yesterday separately', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const p = buildPassport(
      [review('a', today.toISOString()), review('b', yesterday.toISOString())],
      [lounge('a'), lounge('b')],
      AUSTIN,
    );
    const labels = groupVisitsByRecency(p.visits).map(g => g.label);
    expect(labels).toContain('Today');
    expect(labels).toContain('Yesterday');
  });

  it('keeps every visit — grouping must never drop one', () => {
    const p = buildPassport(
      [review('a', '2026-01-01'), review('b', '2025-06-01'), review('c', '2024-03-01')],
      [lounge('a'), lounge('b'), lounge('c')],
      AUSTIN,
    );
    const grouped = groupVisitsByRecency(p.visits);
    const total = grouped.reduce((sum, g) => sum + g.visits.length, 0);
    expect(total).toBe(p.visits.length);
  });
});

describe('suggestNextLounge', () => {
  it('returns null when every lounge has been visited', () => {
    const p = buildPassport([review('a', '2026-01-01')], [lounge('a')], AUSTIN);
    expect(suggestNextLounge([lounge('a')], p)).toBeNull();
  });

  it('never suggests a lounge the member has already visited', () => {
    const p = buildPassport([review('a', '2026-01-01')], [lounge('a')], AUSTIN);
    const suggestion = suggestNextLounge([lounge('a'), lounge('b')], p);
    expect(suggestion?.id).toBe('b');
  });

  it('prefers a city the member already knows over a higher-rated stranger', () => {
    const p = buildPassport([review('a', '2026-01-01')], [lounge('a')], AUSTIN);
    const suggestion = suggestNextLounge(
      [
        lounge('a'),
        lounge('near', { city: 'Austin, TX', ratings: { overall: 4.0 } as never }),
        lounge('far', { city: 'Miami, FL', ratings: { overall: 5.0 } as never }),
      ],
      p,
    );
    expect(suggestion?.id).toBe('near');
  });

  it('ignores unrated lounges', () => {
    const p = buildPassport([review('a', '2026-01-01')], [lounge('a')], AUSTIN);
    const suggestion = suggestNextLounge(
      [lounge('a'), lounge('unrated', { ratings: { overall: 0 } as never })],
      p,
    );
    expect(suggestion).toBeNull();
  });
});
