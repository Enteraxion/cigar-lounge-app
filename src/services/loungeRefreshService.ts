/**
 * loungeRefreshService
 *
 * Client-side call to the `refreshCityLounges` Cloud Function (see
 * functions/src/index.ts), which live-queries Yelp for a searched city
 * and upserts results into the same `lounges` collection
 * scripts/importYelpLounges.ts populates — this is what makes "any US
 * city" work instead of only the hand-picked list in that script.
 *
 * IMPORTANT: that Cloud Function is not deployed yet — it needs the
 * Firebase project on the Blaze plan (pending Julian Brinkley's
 * approval, see the blaze_plan_decision memory). Until it's deployed,
 * calling it fails with a `functions/not-found` (or similar) error,
 * which this wraps and swallows so callers can call it unconditionally
 * without special-casing "is the function live yet". Once deployed, it
 * starts actually working with no client-side change needed.
 */

import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

const functions = getFunctions();

type RefreshCityLoungesResult = {
  refreshed: boolean;
  city: string;
  count?: number;
  reason?: string;
};

/**
 * Fire-and-forget: triggers a live Yelp refresh for `city`. Resolves
 * `false` (never rejects) if the function isn't deployed yet, the user
 * is signed out, or the call otherwise fails — callers should treat this
 * as "best-effort background refresh", not something search results wait
 * on (Firestore data for the city may already exist from the seed
 * script, or a previous refresh).
 */
export async function refreshCityLounges(city: string): Promise<boolean> {
  if (!city.trim()) {
    return false;
  }
  try {
    const callable = httpsCallable<{ city: string }, RefreshCityLoungesResult>(
      functions,
      'refreshCityLounges',
    );
    const result = await callable({ city });
    return result.data.refreshed;
  } catch {
    return false;
  }
}
