/**
 * Travel Wishlist — derived from the member's own saved lounges.
 *
 * The Saved tab's wishlist header used to be three blocks of fiction: an
 * "European Grand Tour" with 4 destinations and 12 saved lounges that bore
 * no relation to what the member had actually saved, a rail of New York /
 * Rome / London with invented counts, and a "Must Visit" highlight for a
 * lounge in Mayfair that exists nowhere in the database. Every member saw
 * the same trip.
 *
 * There is no trip-planning backend in this app and building one is a
 * product decision, not a data-wiring fix. But the member's favorites
 * already *are* a wishlist — the places they've marked as wanting to go —
 * so the whole section can be real by reading them properly:
 *
 *   - destinations = the distinct cities they've saved lounges in
 *   - the plan summary = how many cities, how many lounges
 *   - next stop = the best-rated saved lounge they haven't reviewed yet
 *
 * Pure, so the screen stays presentational.
 */

import type { Lounge } from '../services/loungeService';
import type { Visit } from './passport';

export type WishlistDestination = {
  id: string;
  city: string;
  country: string;
  loungesSaved: number;
  image: string;
};

export type WishlistHighlight = {
  label: string;
  loungeId: string;
  loungeName: string;
  image: string;
  location: string;
  rating: number;
  ratingLabel: string;
};

export type Wishlist = {
  activePlan: {
    name: string;
    heroImage: string | null;
    destinationsCount: number;
    savedLoungesCount: number;
  };
  destinations: WishlistDestination[];
  /** Null when there's nothing left to suggest — every save reviewed. */
  nextStopHighlight: WishlistHighlight | null;
};

/**
 * Splits a "City, ST" label. Lounges seeded by hand have no city at all,
 * so those simply don't contribute a destination rather than producing a
 * blank card.
 */
function splitCity(city: string | undefined): { city: string; region: string } | null {
  if (!city) return null;
  const [name, region] = city.split(',').map(part => part.trim());
  return name ? { city: name, region: region ?? '' } : null;
}

/**
 * `visits` is used only to decide what to suggest next — a lounge the
 * member has already reviewed isn't a "next stop", it's somewhere they've
 * been.
 */
export function buildWishlist(saved: Lounge[], visits: Visit[] = []): Wishlist {
  const byCity = new Map<string, WishlistDestination>();
  for (const lounge of saved) {
    const parts = splitCity(lounge.city);
    if (!parts) continue;
    const existing = byCity.get(lounge.city!);
    if (existing) {
      existing.loungesSaved += 1;
    } else {
      byCity.set(lounge.city!, {
        id: lounge.city!,
        city: parts.city,
        country: parts.region,
        loungesSaved: 1,
        image: lounge.images[0],
      });
    }
  }

  const destinations = Array.from(byCity.values()).sort(
    (a, b) => b.loungesSaved - a.loungesSaved,
  );

  const visitedIds = new Set(visits.map(visit => visit.loungeId));
  const unvisited = saved
    .filter(lounge => !visitedIds.has(lounge.id))
    .sort((a, b) => b.ratings.overall - a.ratings.overall);
  const next = unvisited[0] ?? null;

  return {
    activePlan: {
      // Named after where they're actually going rather than a fixed
      // "European Grand Tour" — one city is a trip, several is a tour.
      name:
        destinations.length === 0
          ? 'Your Wishlist'
          : destinations.length === 1
            ? `${destinations[0].city} Trip`
            : `${destinations[0].city} & ${destinations.length - 1} more`,
      heroImage: saved[0]?.images[0] ?? null,
      destinationsCount: destinations.length,
      savedLoungesCount: saved.length,
    },
    destinations,
    nextStopHighlight: next
      ? {
          label: 'Next Stop',
          loungeId: next.id,
          loungeName: next.name,
          image: next.images[0],
          location: next.city ?? next.address,
          rating: next.ratings.overall,
          ratingLabel: next.reviewCount > 0 ? `${next.reviewCount} reviews` : 'New',
        }
      : null,
  };
}
