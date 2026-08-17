/**
 * Turning "lounges near here" into something Firestore can actually answer.
 *
 * Firestore has no geo query and no compound range across two fields, so a
 * radius search cannot be expressed directly. What it *can* do is a range on
 * one field, which is enough for the useful half of the work: narrow to a
 * band of latitude on the server, then finish the circle in JS.
 *
 * That split is why the Map and Home tabs stopped downloading the whole
 * 8,294-document collection. Measured band selectivity against the real
 * data at a 60-mile radius:
 *
 *   Austin      623 docs   7.5% of collection
 *   Greenville  961 docs  11.6%
 *   New York   1380 docs  16.6%
 *
 * A longitude band would be the obvious second filter, but Firestore will
 * not range two fields in one query, and the JS pass has to run anyway to
 * turn the band into a circle — so longitude is simply part of that pass.
 */

import type { Lounge } from '../services/loungeService';
import { haversineDistanceMiles } from './loungeSearch';

/**
 * Miles per degree of latitude. Constant everywhere, unlike longitude —
 * which is why latitude is the axis we push to the server.
 */
const MILES_PER_LATITUDE_DEGREE = 69.0;

export type LatitudeBand = { minLat: number; maxLat: number };

/**
 * The latitude range that could contain anything within `radiusMiles`.
 *
 * Clamped to real latitudes so a large radius near a pole can't produce a
 * range Firestore would reject or that would silently match nothing.
 */
export function latitudeBand(lat: number, radiusMiles: number): LatitudeBand {
  const delta = Math.abs(radiusMiles) / MILES_PER_LATITUDE_DEGREE;
  return {
    minLat: Math.max(-90, lat - delta),
    maxLat: Math.min(90, lat + delta),
  };
}

/**
 * Keeps only the lounges genuinely inside the circle, nearest first.
 *
 * Sorting here rather than at the call sites is deliberate: "nearest first"
 * is the only ordering a proximity query has any business returning, and
 * every caller previously re-sorted the full collection itself.
 */
export function withinRadius<T extends Pick<Lounge, 'coordinates'>>(
  lounges: T[],
  center: { lat: number; lng: number },
  radiusMiles: number,
): T[] {
  const from = { latitude: center.lat, longitude: center.lng };
  return lounges
    .map(lounge => ({ lounge, distance: haversineDistanceMiles(from, lounge.coordinates) }))
    .filter(entry => entry.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance)
    .map(entry => entry.lounge);
}

/**
 * Coarsens a centre point into a cache key.
 *
 * Without this, GPS jitter and every frame of a map pan would each look like
 * a brand-new query. Rounding to ~0.25° (roughly 17 miles) means small
 * movement reuses the previous result, while a real change of city does not.
 * The quantum is well under the radius it's used with, so a reused band
 * always still covers the caller's actual circle.
 */
const KEY_PRECISION_DEGREES = 0.25;

export function nearbyCacheKey(
  center: { lat: number; lng: number },
  radiusMiles: number,
): string {
  const quantize = (value: number) =>
    Math.round(value / KEY_PRECISION_DEGREES) * KEY_PRECISION_DEGREES;
  return JSON.stringify({
    lat: quantize(center.lat),
    lng: quantize(center.lng),
    radiusMiles: Math.round(radiusMiles),
  });
}

/**
 * How wide a radius to load for a map showing `latitudeDelta` degrees.
 *
 * Tied to the viewport so zooming out fetches more rather than showing a
 * suspiciously empty map, with a floor that keeps a fully zoomed-in map from
 * querying a radius so small it finds nothing, and a ceiling that stops a
 * zoomed-out-to-the-whole-country gesture from turning back into a
 * full-collection scan.
 *
 * Snapped to a ladder rather than returned continuously, because this value
 * is part of the query cache key: an unsnapped radius would make every
 * pinch of a few pixels a brand-new key and defeat the cache entirely.
 */
const RADIUS_LADDER_MILES = [25, 50, 100, 200, 300];

export function radiusForViewport(latitudeDelta: number): number {
  const visibleMiles = Math.abs(latitudeDelta) * MILES_PER_LATITUDE_DEGREE;
  return (
    RADIUS_LADDER_MILES.find(rung => visibleMiles <= rung) ??
    RADIUS_LADDER_MILES[RADIUS_LADDER_MILES.length - 1]
  );
}
