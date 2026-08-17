/**
 * The Trip Planner decides which lounges a member is told are "on the way".
 * The corridor maths is an approximation by design (see routePlanner.ts), so
 * these tests pin the properties that must hold regardless: nothing outside
 * the corridor, ordered along the journey, and no crash on degenerate input.
 */

import { planRoute, preferenceMatch } from '../routePlanner';
import type { Lounge } from '../../services/loungeService';

const AUSTIN = { lat: 30.2672, lng: -97.7431 };
const DALLAS = { lat: 32.7767, lng: -96.797 };
const WACO = { lat: 31.5493, lng: -97.1467 }; // roughly halfway
const MIAMI = { lat: 25.7617, lng: -80.1918 }; // far off route

function lounge(id: string, coordinates: { lat: number; lng: number }, over: Partial<Lounge> = {}) {
  return {
    id,
    name: `Lounge ${id}`,
    coordinates,
    tags: [],
    amenities: [],
    images: ['img'],
    ratings: { overall: 4 },
    ...over,
  } as unknown as Lounge;
}

describe('planRoute', () => {
  it('includes a lounge sitting on the route', () => {
    const plan = planRoute(AUSTIN, DALLAS, [lounge('waco', WACO)]);
    expect(plan.stops.map(s => s.lounge.id)).toContain('waco');
  });

  it('excludes a lounge far off the route', () => {
    const plan = planRoute(AUSTIN, DALLAS, [lounge('miami', MIAMI)]);
    expect(plan.stops).toHaveLength(0);
  });

  it('reports a plausible total distance for Austin to Dallas', () => {
    const plan = planRoute(AUSTIN, DALLAS, []);
    expect(plan.totalMiles).toBeGreaterThan(150);
    expect(plan.totalMiles).toBeLessThan(220);
  });

  it('orders stops by progress along the route, not by input order', () => {
    const nearDallas = { lat: 32.5, lng: -96.9 };
    const nearAustin = { lat: 30.5, lng: -97.6 };
    const plan = planRoute(AUSTIN, DALLAS, [
      lounge('late', nearDallas),
      lounge('early', nearAustin),
      lounge('mid', WACO),
    ]);
    expect(plan.stops.map(s => s.lounge.id)).toEqual(['early', 'mid', 'late']);
  });

  it('never returns more than maxStops', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      lounge(`l${i}`, { lat: 30.3 + i * 0.06, lng: -97.7 + i * 0.02 }),
    );
    expect(planRoute(AUSTIN, DALLAS, many, 5).stops.length).toBeLessThanOrEqual(5);
  });

  it('spreads stops across the journey rather than clustering at the start', () => {
    // 30 lounges packed into the first fifth of the route plus one at the end.
    const clustered = Array.from({ length: 30 }, (_, i) =>
      lounge(`c${i}`, { lat: 30.3 + i * 0.005, lng: -97.72 + i * 0.002 }),
    );
    clustered.push(lounge('end', { lat: 32.7, lng: -96.85 }));
    const plan = planRoute(AUSTIN, DALLAS, clustered, 5);
    const last = plan.stops[plan.stops.length - 1];
    // Without spacing, all 5 stops would come from the cluster near the start.
    expect(last.milesFromStart).toBeGreaterThan(plan.totalMiles / 2);
  });

  it('does not divide by zero when start and destination are the same point', () => {
    expect(() => planRoute(AUSTIN, AUSTIN, [lounge('a', AUSTIN)])).not.toThrow();
    const plan = planRoute(AUSTIN, AUSTIN, [lounge('a', AUSTIN)]);
    expect(plan.totalMiles).toBe(0);
    expect(plan.stops[0].milesFromStart).toBe(0);
  });

  it('skips lounges with no coordinates instead of throwing', () => {
    const broken = { id: 'x', name: 'x', coordinates: undefined } as unknown as Lounge;
    expect(() => planRoute(AUSTIN, DALLAS, [broken])).not.toThrow();
    expect(planRoute(AUSTIN, DALLAS, [broken]).stops).toHaveLength(0);
  });

  it('widens the corridor for longer trips', () => {
    // This point is 18 mi off the Austin->Dallas line (corridor 21.9 mi, so
    // included) and 24 mi off the short Austin->30.4N line (corridor is the
    // 15 mi floor, so excluded). Same lounge, same detour, different verdict
    // — which is the scaling behaviour under test.
    const offRoute = { lat: 30.6, lng: -97.94 };
    const shortHop = planRoute(AUSTIN, { lat: 30.4, lng: -97.6 }, [lounge('o', offRoute)]);
    const longHaul = planRoute(AUSTIN, DALLAS, [lounge('o', offRoute)]);
    expect(shortHop.stops).toHaveLength(0);
    expect(longHaul.stops).toHaveLength(1);
  });
});

describe('preferenceMatch', () => {
  it('returns null when the member selected no preferences', () => {
    expect(preferenceMatch(lounge('a', AUSTIN), [])).toBeNull();
  });

  it('scores against tags and amenities, case-insensitively', () => {
    const l = lounge('a', AUSTIN, { tags: ['Cigar Bar'], amenities: ['Full Bar'] });
    expect(preferenceMatch(l, ['cigar'])).toBe(100);
    expect(preferenceMatch(l, ['Cigar', 'Whiskey'])).toBe(50);
    expect(preferenceMatch(l, ['Whiskey'])).toBe(0);
  });
});
