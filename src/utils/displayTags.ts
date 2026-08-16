/**
 * A lounge's `tags` array doubles as internal provenance metadata: both
 * scripts/importYelpLounges.ts and functions/src/index.ts's
 * refreshCityLounges stamp every lounge they write with an
 * `imported-from-yelp` / `imported-from-google` tag for our own
 * bookkeeping. Those were never meant to be user-facing, but every screen
 * that renders tags was printing them verbatim — so an imported lounge's
 * card literally read "imported-from-google" where a real descriptor
 * ("Whiskey • Historic") belongs.
 *
 * Stripping them here, at the display boundary, rather than dropping the
 * tag from the imports: the tag is genuinely useful for telling apart
 * Yelp-sourced vs Google-sourced vs hand-seeded lounges when debugging
 * data problems, and hand-seeded lounges do carry real display tags in
 * the same field.
 */
const INTERNAL_TAG_PREFIX = 'imported-from-';

/** Real, user-facing tags only — internal provenance tags removed. */
export function displayTags(tags: string[]): string[] {
  return tags.filter(tag => !tag.startsWith(INTERNAL_TAG_PREFIX));
}
