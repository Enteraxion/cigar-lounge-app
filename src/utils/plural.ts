/**
 * Counting things without saying "1 lounges".
 *
 * Six places in the app wrote `{count} Reviews` or `{count} Lounges` with the
 * plural baked in, so a single result read "1 LOUNGES FOUND" and a lounge with
 * one review read "1 REVIEWS". Small, but it is on the first screen of every
 * search, and it is the kind of thing that makes an app look unfinished for no
 * reason (found during the Android pass, 2026-09-15).
 *
 * Deliberately not a full pluralisation library. Everything this app counts —
 * lounges, reviews, results, photos, guests — takes a plain "s", and a
 * dependency for that would be sillier than the bug.
 */

/** "1 lounge", "3 lounges". Pass `plural` when adding an s is not enough. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
