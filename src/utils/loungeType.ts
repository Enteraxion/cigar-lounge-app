/**
 * What kind of venue a lounge is — cigar, hookah, vape, tobacco.
 *
 * Asked for by Dr. Brinkley (2026-08-19): a search filter letting members choose
 * lounge type. That request included cannabis; the type was removed on
 * 2026-08-24, with his agreement that the call was ours to make. Two reasons,
 * and the second is the one that decided it:
 *
 *  1. Apple guideline 1.4.3 does not permit apps facilitating the sale of
 *     marijuana. This is a directory rather than a storefront, which is how
 *     Leafly and Weedmaps stay listed, but it was the single largest rejection
 *     risk in a submission that is otherwise straightforward.
 *  2. **It was not a real category.** Measured across all 8,496 lounges, 34 were
 *     classified cannabis — 0.4% — and NOT ONE came from a Yelp cannabis
 *     category. Every one was a guess from the venue's name, and the guesses
 *     were mostly wrong: "Kush Cigar House", "Smoke 4 less Cigar Vape & CBD",
 *     "Two Leafs Smoke Shop — Cigarettes, Fine Cigars, Hookah". Cigar and hookah
 *     shops, filed under cannabis because their name mentions CBD or Kush, and
 *     therefore missing from the cigar filter that should have found them.
 *
 * Dropping the type reclassifies 26 of those 34 as what they actually are —
 * 11 cigar, 10 hookah, 4 tobacco, 1 vape — leaving 8 as `unknown`. So this
 * removes a rejection risk and fixes a classification bug in the same change.
 *
 * If a genuine dispensary listing is ever wanted, it needs a real category from
 * the import rather than a name guess, and a fresh read of 1.4.3 — not this
 * regex.
 *
 * Type is not a field either import ever captured, so it has to be derived, and
 * the two sources of truth are very different in quality:
 *
 *  1. **`yelpCategories`** — Yelp's own aliases (`cigarbars`, `hookah_bars`).
 *     Authoritative. Captured by scripts/backfillPhones.ts and at import time.
 *  2. **The venue name** — a guess. Measured across all 8,496 lounges it
 *     classifies 59.4% and leaves 40.6% unknown, and the misses are real venues:
 *     "Smokers Dynasty", "Boston Smoke & More", "Smokers Depot". Used only where
 *     there are no categories.
 *
 * That ordering matters. A filter running on names alone would silently hide
 * 3,452 lounges, so `unknown` is a real, surfaced answer here rather than a
 * quiet exclusion — see `LOUNGE_TYPE_OPTIONS`, which includes it as "Other" so
 * a member filtering can still reach those venues instead of them vanishing.
 */

export type LoungeType = 'cigar' | 'hookah' | 'vape' | 'tobacco' | 'unknown';

/** Yelp aliases mapped to our types. Aliases are stable; titles are not. */
const YELP_ALIAS_TO_TYPE: Record<string, LoungeType> = {
  cigarbars: 'cigar',
  tobaccoshops: 'tobacco',
  hookah_bars: 'hookah',
  hookahbars: 'hookah',
  headshops: 'vape',
  vapeshops: 'vape',
};

/**
 * Name patterns, most specific first — first match wins.
 *
 * There is deliberately no cannabis rule — see the header. Names mentioning
 * CBD, hemp or Kush now fall through to the rule that matches the rest of the
 * name, which for these venues is cigar, hookah or tobacco.
 *
 * Word boundaries throughout. Without them "vape" matches inside unrelated
 * words and "smokes" would catch any name containing it.
 */
const NAME_RULES: [LoungeType, RegExp][] = [
  ['hookah', /\b(hookahs?|hookas?|shisha|shesha|sheesha|narghile|nargile|argila)\b/i],
  ['cigar', /\b(cigars?|tobacconist|humidors?|stogies?|puros?|habanos?|churchill)\b/i],
  ['vape', /\b(vapes?|vapor|vaper|e-?cigs?|ejuice|e-?liquid)\b/i],
  // Bare "smoke" is included, and it is safe here specifically because this
  // corpus is already filtered: every lounge came from Yelp's cigar/tobacco/
  // hookah categories or Google's cigar-relevance check, so "Boston Smoke &
  // More" is a tobacconist rather than a barbecue joint. The word boundary
  // still excludes "Smokehouse" and "Smokey", which are the names that would
  // otherwise drag restaurants in.
  ['tobacco', /\b(tobacco|smoke|smokes|smoke ?shops?|smokeshops?|smokers?|snuff|pipes?)\b/i],
];

type Classifiable = {
  name?: string;
  yelpCategories?: string[];
};

/**
 * The venue's type, and where the answer came from.
 *
 * `source` is returned because the two are not equally trustworthy and callers
 * that want to show a member "categorised by name" rather than assert a fact
 * need to be able to tell.
 */
export function classifyLounge(lounge: Classifiable): {
  type: LoungeType;
  source: 'categories' | 'name' | 'none';
} {
  for (const alias of lounge.yelpCategories ?? []) {
    const mapped = YELP_ALIAS_TO_TYPE[alias.toLowerCase()];
    if (mapped) {
      return { type: mapped, source: 'categories' };
    }
  }

  const name = lounge.name ?? '';
  for (const [type, pattern] of NAME_RULES) {
    if (pattern.test(name)) {
      return { type, source: 'name' };
    }
  }

  return { type: 'unknown', source: 'none' };
}

/** Just the type, for the common case. */
export function loungeTypeOf(lounge: Classifiable): LoungeType {
  return classifyLounge(lounge).type;
}

/**
 * The filter chips, in the order they appear.
 *
 * "Other" is deliberately one of them. 40.6% of lounges cannot be typed, and
 * offering only the five known types would make those unreachable through the
 * filter — a member who ticks nothing sees everything, but a member who ticks
 * "Cigar" would never discover "Smokers Dynasty". Naming it "Other" rather than
 * "Unknown" is honest without sounding broken.
 */
export const LOUNGE_TYPE_OPTIONS: { id: LoungeType; label: string }[] = [
  { id: 'cigar', label: 'Cigar' },
  { id: 'hookah', label: 'Hookah' },
  { id: 'vape', label: 'Vape' },
  { id: 'tobacco', label: 'Tobacco' },
  { id: 'unknown', label: 'Other' },
];

/**
 * Whether a lounge passes the selected types.
 *
 * An empty selection means "no preference" and matches everything, consistent
 * with every other filter section in the sheet.
 */
export function matchesLoungeType(lounge: Classifiable, selected: LoungeType[]): boolean {
  if (selected.length === 0) {
    return true;
  }
  return selected.includes(loungeTypeOf(lounge));
}
