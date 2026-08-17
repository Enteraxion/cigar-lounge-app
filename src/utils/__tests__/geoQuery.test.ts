/**
 * The proximity query shape that replaced "download the whole collection".
 *
 * The band is what Firestore actually runs, so the property that matters most
 * is that it never excludes something inside the radius — a band that is too
 * tight silently hides real lounges, which is worse than the slow version it
 * replaced.
 */

import { latitudeBand, nearbyCacheKey, radiusForViewport, withinRadius } from '../geoQuery';
import { haversineDistanceMiles } from '../loungeSearch';

const AUSTIN = { lat: 30.2672, lng: -97.7431 };

function at(lat: number, lng: number, id = `${lat},${lng}`) {
  return { id, coordinates: { lat, lng } };
}

describe('latitudeBand', () => {
  it('spans the radius in both directions', () => {
    const band = latitudeBand(30, 69);
    expect(band.minLat).toBeCloseTo(29, 1);
    expect(band.maxLat).toBeCloseTo(31, 1);
  });

  it('never excludes a point that is inside the radius', () => {
    // The band is the server-side half of the query, so anything it drops is
    // invisible to the JS pass that follows. Checked against real distances
    // rather than the same arithmetic the implementation uses.
    const radius = 60;
    const band = latitudeBand(AUSTIN.lat, radius);
    for (let offset = -1.5; offset <= 1.5; offset += 0.05) {
      const candidate = { lat: AUSTIN.lat + offset, lng: AUSTIN.lng };
      const distance = haversineDistanceMiles(
        { latitude: AUSTIN.lat, longitude: AUSTIN.lng },
        candidate,
      );
      if (distance <= radius) {
        expect(candidate.lat).toBeGreaterThanOrEqual(band.minLat);
        expect(candidate.lat).toBeLessThanOrEqual(band.maxLat);
      }
    }
  });

  it('clamps to real latitudes near the poles', () => {
    const band = latitudeBand(89, 600);
    expect(band.maxLat).toBeLessThanOrEqual(90);
    expect(latitudeBand(-89, 600).minLat).toBeGreaterThanOrEqual(-90);
  });

  it('treats a negative radius as a distance, not a reversed range', () => {
    const band = latitudeBand(30, -60);
    expect(band.minLat).toBeLessThan(band.maxLat);
  });
});

describe('withinRadius', () => {
  it('drops the corners of the band that fall outside the circle', () => {
    // The whole reason the JS pass exists: a latitude band is a rectangle and
    // the query asked for a circle.
    const near = at(30.3, -97.75, 'near');
    const sameLatFarEast = at(30.2672, -80.0, 'far-east');
    const result = withinRadius([near, sameLatFarEast], AUSTIN, 60);
    expect(result.map(r => r.id)).toEqual(['near']);
  });

  it('returns nearest first', () => {
    const result = withinRadius(
      [at(31.0, -97.7431, 'far'), at(30.3, -97.7431, 'close'), at(30.6, -97.7431, 'mid')],
      AUSTIN,
      100,
    );
    expect(result.map(r => r.id)).toEqual(['close', 'mid', 'far']);
  });

  it('includes a point exactly on the boundary', () => {
    const onEdge = at(AUSTIN.lat + 60 / 69, AUSTIN.lng, 'edge');
    const distance = haversineDistanceMiles(
      { latitude: AUSTIN.lat, longitude: AUSTIN.lng },
      onEdge.coordinates,
    );
    expect(withinRadius([onEdge], AUSTIN, distance)).toHaveLength(1);
  });

  it('returns everything when the radius is unbounded', () => {
    // The far-from-anywhere fallback path relies on this.
    const all = [at(30, -97), at(60, 10), at(-33, 151)];
    expect(withinRadius(all, AUSTIN, Number.POSITIVE_INFINITY)).toHaveLength(3);
  });

  it('handles an empty input', () => {
    expect(withinRadius([], AUSTIN, 60)).toEqual([]);
  });
});

describe('nearbyCacheKey', () => {
  it('is stable under GPS jitter', () => {
    // Without coarsening, every fix and every frame of a pan looked like a
    // brand-new query and the cache never hit.
    const a = nearbyCacheKey({ lat: 30.2672, lng: -97.7431 }, 60);
    const b = nearbyCacheKey({ lat: 30.2701, lng: -97.7455 }, 60);
    expect(a).toBe(b);
  });

  it('changes for a genuinely different place', () => {
    const austin = nearbyCacheKey(AUSTIN, 60);
    const dallas = nearbyCacheKey({ lat: 32.7767, lng: -96.797 }, 60);
    expect(austin).not.toBe(dallas);
  });

  it('changes when the radius changes', () => {
    expect(nearbyCacheKey(AUSTIN, 60)).not.toBe(nearbyCacheKey(AUSTIN, 100));
  });

  it('coarsens by less than the radius it is used with', () => {
    // If the quantum exceeded the radius, a reused cache entry could be
    // centred outside the circle the caller actually asked about.
    const smallestRadius = radiusForViewport(0);
    const quantumMiles = 0.25 * 69;
    expect(quantumMiles).toBeLessThan(smallestRadius);
  });
});

describe('radiusForViewport', () => {
  it('has a floor so a fully zoomed-in map still finds something', () => {
    expect(radiusForViewport(0)).toBeGreaterThanOrEqual(25);
    expect(radiusForViewport(0.001)).toBeGreaterThanOrEqual(25);
  });

  it('has a ceiling so zooming out does not become a full scan', () => {
    expect(radiusForViewport(180)).toBeLessThanOrEqual(300);
  });

  it('grows with the viewport', () => {
    expect(radiusForViewport(2)).toBeLessThanOrEqual(radiusForViewport(4));
    expect(radiusForViewport(0.1)).toBeLessThan(radiusForViewport(10));
  });

  it('snaps to a ladder so small pinches do not bust the cache', () => {
    // The value is part of the cache key; a continuous result would mean a
    // fresh query for every few pixels of zoom.
    expect(radiusForViewport(0.5)).toBe(radiusForViewport(0.52));
    expect(new Set([0.3, 0.31, 0.32].map(radiusForViewport)).size).toBe(1);
  });

  it('covers at least the visible area it was asked about', () => {
    for (const delta of [0.1, 0.5, 1, 2, 3]) {
      expect(radiusForViewport(delta)).toBeGreaterThanOrEqual(delta * 69);
    }
  });
});
