/**
 * passportService
 *
 * Assembles everything the Cigar Passport needs into one call, so
 * PassportScreen and TravelTimelineScreen don't each have to orchestrate
 * the same three fetches. The actual derivation is pure and lives in
 * src/utils/passport.ts — this is only the data-gathering half.
 */

import { getLoungesByIds, getLoungesNear, type Lounge } from './loungeService';
import { getUserProfile, getUserReviews } from './userActionsService';
import { findCityCoordinates } from '../utils/cityAutocomplete';
import { buildPassport, suggestNextLounge, type PassportSummary } from '../utils/passport';

/**
 * How far out to look for the "where next" suggestion, and how many
 * candidates to hand the (pure) picker. Wider than Home's nearby radius
 * because a suggestion is aspirational — somewhere worth a drive — but still
 * bounded, so this can never become a full-collection scan again.
 */
const SUGGESTION_RADIUS_MILES = 100;
const SUGGESTION_CANDIDATES = 200;

export type PassportBundle = {
  passport: PassportSummary;
  /** The lounge docs behind `passport.visits`, already fetched here — so
   * JourneyMap can pin real visits without a second round trip. */
  visitedLounges: Lounge[];
  /** Highest-rated lounge the member hasn't visited; null when none fits. */
  suggestion: Lounge | null;
  /** False when the member's profile has no recognisable home city, which
   * is what makes every distance figure unknown rather than zero. */
  hasHomeCity: boolean;
};

export async function getPassport(userId: string): Promise<PassportBundle> {
  const [reviews, profile] = await Promise.all([getUserReviews(userId), getUserProfile(userId)]);

  const homeCoordinates = profile?.homeCity ? findCityCoordinates(profile.homeCity) : null;

  const visitedLoungeIds = Array.from(new Set(reviews.map(review => review.loungeId)));
  const lounges = await getLoungesByIds(visitedLoungeIds);
  const passport = buildPassport(reviews, lounges, homeCoordinates);

  // Only worth looking for a suggestion once the member actually has a
  // history to base one on.
  //
  // Candidates come from around a point rather than from the whole 8,294-doc
  // collection, which this used to download every time the Profile tab
  // opened. Anchoring on the most recent visit before the profile home city
  // is deliberate: suggestNextLounge already prefers cities the member knows,
  // so the place they last went is a better centre than where they live —
  // and it is the one anchor that exists for every member with a history,
  // including those whose home city we can't resolve.
  let suggestion: Lounge | null = null;
  if (passport.visits.length > 0) {
    try {
      const anchor = lounges[0]?.coordinates ?? homeCoordinates;
      if (anchor) {
        suggestion = suggestNextLounge(
          await getLoungesNear(anchor, SUGGESTION_RADIUS_MILES, SUGGESTION_CANDIDATES),
          passport,
        );
      }
    } catch {
      // A suggestion is a nice-to-have; never fail the passport over it.
    }
  }

  return { passport, visitedLounges: lounges, suggestion, hasHomeCity: homeCoordinates !== null };
}
