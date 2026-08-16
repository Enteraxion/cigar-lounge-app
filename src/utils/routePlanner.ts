/**
 * Trip Planner route logic — real stops, from the app's real lounges.
 *
 * The Trip Planner used to be entirely invented: a fixed London → Edinburgh
 * route with three hardcoded stopovers and lounges ("Smoke & Velvet",
 * "Cambridge Centre") that exist nowhere in the database. Every member saw
 * the same trip regardless of where they were going, and "Generate
 * Itinerary" showed a Coming Soon alert.
 *
 * What makes it real without a routing API: a lounge is a stop on your trip
 * if it sits close to the straight line between where you start and where
 * you're going. That is a *deliberate approximation* — it's a great-circle
 * corridor, not a driving route, so a lounge on the far side of a bay can
 * look closer than it drives. The UI says "near your route" rather than
 * quoting drive times, so the copy doesn't promise more precision than the
 * maths delivers. Real turn-by-turn routing would need a paid directions
 * API and a decision from Julian; this needs neither and is honest about
 * what it is.
 *
 * Everything here is pure so the screen stays presentational.
 */

import type { Lounge } from '../services/loungeService';

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Projects a point onto the start→end segment in a local flat-earth frame
 * (longitude scaled by cos(latitude)). Over the few hundred miles a road
 * trip covers the curvature error is far below the corridor width we're
 * testing against, so the extra complexity of a true great-circle
 * cross-track calculation would buy nothing here.
 *
 * Returns how far off the route the point is, and how far along the route
 * its closest approach falls — which is what orders the stops.
 */
function projectOntoRoute(
  point: LatLng,
  start: LatLng,
  end: LatLng,
): { detourMiles: number; progress: number } {
  const scale = Math.cos(toRad((start.lat + end.lat) / 2));
  const ax = (end.lng - start.lng) * scale;
  const ay = end.lat - start.lat;
  const bx = (point.lng - start.lng) * scale;
  const by = point.lat - start.lat;

  const lengthSquared = ax * ax + ay * ay;
  // Start and destination are the same place — every candidate is measured
  // from that single point rather than dividing by zero.
  const progress =
    lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (bx * ax + by * ay) / lengthSquared));

  const closest: LatLng = {
    lat: start.lat + ay * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
  };
  return { detourMiles: haversineMiles(point, closest), progress };
}

export type RouteStop = {
  lounge: Lounge;
  /** Straight-line miles from the start point to this lounge. */
  milesFromStart: number;
  /** How far the lounge sits off the direct line. */
  detourMiles: number;
};

export type RoutePlan = {
  totalMiles: number;
  stops: RouteStop[];
};

/**
 * Lounges worth stopping at between two points, in the order you'd reach
 * them.
 *
 * `corridorMiles` is how far off the direct line still counts as "on the
 * way" — it widens with the length of the trip, because a 15-mile detour is
 * a lot on a 40-mile hop and nothing on a 600-mile drive.
 *
 * `maxStops` keeps the itinerary readable; on a long route through dense
 * cities the corridor can contain hundreds of lounges, and a list that long
 * isn't a plan. The screen says how many were found so the cap never
 * silently hides the rest.
 */
export function planRoute(
  start: LatLng,
  end: LatLng,
  lounges: Lounge[],
  maxStops = 8,
): RoutePlan {
  const totalMiles = haversineMiles(start, end);
  const corridorMiles = Math.max(15, Math.min(60, totalMiles * 0.12));

  const candidates: RouteStop[] = [];
  for (const lounge of lounges) {
    if (!lounge.coordinates) continue;
    const { detourMiles, progress } = projectOntoRoute(lounge.coordinates, start, end);
    if (detourMiles > corridorMiles) continue;
    candidates.push({
      lounge,
      milesFromStart: Math.round(totalMiles * progress),
      detourMiles: Math.round(detourMiles),
    });
  }

  candidates.sort((a, b) => a.milesFromStart - b.milesFromStart);

  // Thin the list by spacing rather than by taking the first N, so an
  // itinerary covers the whole journey instead of stopping eight times in
  // whichever city happens to be nearest the start.
  const spacing = candidates.length > maxStops ? totalMiles / maxStops : 0;
  const stops: RouteStop[] = [];
  let lastMile = -Infinity;
  for (const candidate of candidates) {
    if (stops.length >= maxStops) break;
    if (candidate.milesFromStart - lastMile < spacing) continue;
    stops.push(candidate);
    lastMile = candidate.milesFromStart;
  }

  return { totalMiles: Math.round(totalMiles), stops };
}

/**
 * Ranks a lounge's fit against the member's chosen preferences (the
 * "Padrón", "Quiet Atmosphere" chips) by matching them against the tags and
 * amenities the lounge actually carries. Returns null when the member
 * picked no preferences, so the screen shows nothing rather than a
 * meaningless 0%.
 */
export function preferenceMatch(lounge: Lounge, preferences: string[]): number | null {
  if (preferences.length === 0) return null;
  const haystack = [...(lounge.tags ?? []), ...(lounge.amenities ?? [])]
    .join(' ')
    .toLowerCase();
  const hits = preferences.filter(pref => haystack.includes(pref.toLowerCase())).length;
  return Math.round((hits / preferences.length) * 100);
}
