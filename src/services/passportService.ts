/**
 * passportService
 *
 * Assembles everything the Cigar Passport needs into one call, so
 * PassportScreen and TravelTimelineScreen don't each have to orchestrate
 * the same three fetches. The actual derivation is pure and lives in
 * src/utils/passport.ts — this is only the data-gathering half.
 */

import { getLoungesByIds, getAllLounges, type Lounge } from './loungeService';
import { getUserProfile, getUserReviews } from './userActionsService';
import { findCityCoordinates } from '../utils/cityAutocomplete';
import { buildPassport, suggestNextLounge, type PassportSummary } from '../utils/passport';

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

  // Only worth scanning the full collection for a suggestion once the
  // member actually has a history to base one on.
  let suggestion: Lounge | null = null;
  if (passport.visits.length > 0) {
    try {
      suggestion = suggestNextLounge(await getAllLounges(), passport);
    } catch {
      // A suggestion is a nice-to-have; never fail the passport over it.
    }
  }

  return { passport, visitedLounges: lounges, suggestion, hasHomeCity: homeCoordinates !== null };
}
