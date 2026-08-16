/**
 * Cigar Passport — real, derived entirely from data the app already has.
 *
 * The passport used to be almost entirely mock: Lounges Visited, States
 * Explored, Miles Traveled, Check-ins and every "Exploration Stat" showed
 * a placeholder "Soon", the Journey Highlights were three hardcoded rows,
 * and the Travel Timeline was a fixed list of invented trips. All of it
 * was blocked on the same missing thing — a record of which lounges a
 * member had actually been to.
 *
 * The key realisation is that that record already exists. `ReviewDocument`
 * carries a `visitDate` the member picks themselves in WriteReviewScreen —
 * a first-hand, user-asserted statement of "I was at this lounge on this
 * day". Treating a review as a visit makes the whole passport real with no
 * new feature to build, no new collection, no new Firestore index, and
 * nothing extra for a member to learn.
 *
 * Reservations are a plausible second source (booking a table also implies
 * a visit) and `Visit.source` exists so they can be folded in later, but
 * they'd need a collectionGroup query plus its index, and reviews are both
 * the stronger signal and the richer one — they carry the photos, the
 * rating and the words that make a timeline worth reading.
 *
 * Everything here is pure: it takes data in and returns numbers out, so
 * the screens stay presentational and this stays straightforward to reason
 * about.
 */

import { haversineDistanceMiles } from './loungeSearch';
import type { Lounge } from '../services/loungeService';
import type { UserReviewEntry } from '../services/userActionsService';

export type LatLng = { lat: number; lng: number };

/** A single labelled figure in the passport's stat grids. */
export type StatCard = {
  label: string;
  value: string;
};

export type Visit = {
  loungeId: string;
  loungeName: string;
  /** "City, ST" where the lounge doc has one — Yelp/Google imports set it. */
  city?: string;
  address: string;
  visitedAt: Date;
  /** Miles from the member's home city; null when home city is unknown. */
  distanceFromHomeMiles: number | null;
  source: 'review';
  rating: number;
  reviewText: string;
  photos: string[];
};

export type PassportSummary = {
  /** One entry per visit, newest first. */
  visits: Visit[];
  loungesVisited: number;
  citiesExplored: number;
  statesExplored: number;
  /** Total miles between home and each distinct lounge visited. */
  milesTraveled: number;
  /** Longest single trip from home. */
  furthestTripMiles: number;
  /** Consecutive weeks, ending this week, containing at least one visit. */
  weekStreak: number;
  firstVisit: Visit | null;
  latestVisit: Visit | null;
  averageRating: number | null;
};

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Monday-based week index, so "this week" is stable regardless of weekday. */
function weekIndex(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  // Shift so the epoch lands on a Monday boundary (1970-01-01 was a Thursday).
  return Math.floor((utc + 3 * 24 * 60 * 60 * 1000) / MS_PER_WEEK);
}

/**
 * The state/region half of a "City, ST" label. Returns null for lounges
 * with no city (the hand-seeded demo lounges) or a single-part label, so
 * those simply don't count toward States Explored rather than inflating
 * it with a bogus value.
 */
function regionOf(city: string | undefined): string | null {
  if (!city) return null;
  const parts = city.split(',').map(part => part.trim());
  return parts.length >= 2 && parts[1] ? parts[1] : null;
}

/**
 * Builds the passport from a member's reviews and the lounges they belong
 * to. `homeCoordinates` is optional — without it every distance is null
 * and the mileage stats read as unknown rather than being computed from a
 * guessed origin, which would quietly invent travel the member never did.
 */
export function buildPassport(
  reviews: UserReviewEntry[],
  lounges: Lounge[],
  homeCoordinates: LatLng | null,
): PassportSummary {
  const loungeById = new Map(lounges.map(lounge => [lounge.id, lounge]));

  const visits: Visit[] = reviews
    .map((review): Visit | null => {
      const lounge = loungeById.get(review.loungeId);
      if (!lounge) return null;
      return {
        loungeId: lounge.id,
        loungeName: lounge.name,
        city: lounge.city,
        address: lounge.address,
        visitedAt: review.visitDate.toDate(),
        distanceFromHomeMiles: homeCoordinates
          ? haversineDistanceMiles(
              { latitude: homeCoordinates.lat, longitude: homeCoordinates.lng },
              lounge.coordinates,
            )
          : null,
        source: 'review' as const,
        rating: review.rating,
        reviewText: review.text,
        photos: review.photos,
      };
    })
    .filter((visit): visit is Visit => visit !== null)
    .sort((a, b) => b.visitedAt.getTime() - a.visitedAt.getTime());

  // Distinct lounges — a member reviewing the same lounge twice has
  // visited one lounge, not two, and has travelled that distance once for
  // the purposes of the headline mileage figure.
  const distinctLounges = new Map<string, Visit>();
  for (const visit of visits) {
    if (!distinctLounges.has(visit.loungeId)) {
      distinctLounges.set(visit.loungeId, visit);
    }
  }
  const uniqueVisits = Array.from(distinctLounges.values());

  const cities = new Set(uniqueVisits.map(v => v.city).filter(Boolean) as string[]);
  const regions = new Set(
    uniqueVisits.map(v => regionOf(v.city)).filter(Boolean) as string[],
  );

  const distances = uniqueVisits
    .map(v => v.distanceFromHomeMiles)
    .filter((miles): miles is number => miles !== null);

  // Streak: walk back from the current week while each successive week has
  // at least one visit. A member who visited today and last week has a
  // streak of 2; a gap ends it.
  const weeksWithVisits = new Set(visits.map(v => weekIndex(v.visitedAt)));
  const thisWeek = weekIndex(new Date());
  let weekStreak = 0;
  while (weeksWithVisits.has(thisWeek - weekStreak)) {
    weekStreak += 1;
  }

  return {
    visits,
    loungesVisited: uniqueVisits.length,
    citiesExplored: cities.size,
    statesExplored: regions.size,
    milesTraveled: Math.round(distances.reduce((sum, miles) => sum + miles, 0)),
    furthestTripMiles: distances.length ? Math.round(Math.max(...distances)) : 0,
    weekStreak,
    firstVisit: visits.length ? visits[visits.length - 1] : null,
    latestVisit: visits.length ? visits[0] : null,
    averageRating: visits.length
      ? Math.round((visits.reduce((sum, v) => sum + v.rating, 0) / visits.length) * 10) / 10
      : null,
  };
}

export type TimelineGroup = {
  id: string;
  label: string;
  visits: Visit[];
};

/**
 * Groups visits for the Travel Timeline the way a person thinks about
 * recency — Today / Yesterday / Earlier this Month, then by month name,
 * with the year appended once the visit is outside the current one.
 */
export function groupVisitsByRecency(visits: Visit[]): TimelineGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups = new Map<string, TimelineGroup>();
  const push = (id: string, label: string, visit: Visit) => {
    const existing = groups.get(id);
    if (existing) {
      existing.visits.push(visit);
    } else {
      groups.set(id, { id, label, visits: [visit] });
    }
  };

  for (const visit of visits) {
    const at = visit.visitedAt;
    if (at >= startOfToday) {
      push('today', 'Today', visit);
    } else if (at >= startOfYesterday) {
      push('yesterday', 'Yesterday', visit);
    } else if (at >= startOfMonth) {
      push('this-month', 'Earlier this Month', visit);
    } else {
      const sameYear = at.getFullYear() === now.getFullYear();
      const label = at.toLocaleDateString(undefined, {
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
      });
      push(`${at.getFullYear()}-${at.getMonth()}`, label, visit);
    }
  }

  return Array.from(groups.values());
}

/**
 * A real "next stop" recommendation: the highest-rated lounge the member
 * hasn't been to yet, preferring somewhere they've already explored so the
 * suggestion is plausibly reachable rather than across the country.
 * Returns null when there's nothing sensible to suggest.
 */
export function suggestNextLounge(
  allLounges: Lounge[],
  passport: PassportSummary,
): Lounge | null {
  const visitedIds = new Set(passport.visits.map(v => v.loungeId));
  const familiarCities = new Set(passport.visits.map(v => v.city).filter(Boolean));

  const unvisited = allLounges.filter(
    lounge => !visitedIds.has(lounge.id) && lounge.ratings.overall > 0,
  );
  if (unvisited.length === 0) {
    return null;
  }

  const nearby = unvisited.filter(lounge => lounge.city && familiarCities.has(lounge.city));
  const pool = nearby.length > 0 ? nearby : unvisited;
  return pool.reduce((best, lounge) =>
    lounge.ratings.overall > best.ratings.overall ? lounge : best,
  );
}
