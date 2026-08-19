/**
 * What kind of venue a lounge is — cigar, hookah, cannabis, vape, tobacco.
 *
 * Asked for by Dr. Brinkley (2026-08-19): a search filter letting members choose
 * lounge type, cannabis included.
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

export type LoungeType = 'cigar' | 'hookah' | 'cannabis' | 'vape' | 'tobacco' | 'unknown';

/** Yelp aliases mapped to our types. Aliases are stable; titles are not. */
const YELP_ALIAS_TO_TYPE: Record<string, LoungeType> = {
  cigarbars: 'cigar',
  tobaccoshops: 'tobacco',
  hookah_bars: 'hookah',
  hookahbars: 'hookah',
  cannabis_clinics: 'cannabis',
  cannabisdispensaries: 'cannabis',
  cannabis_dispensaries: 'cannabis',
  headshops: 'vape',
  vapeshops: 'vape',
};

/**
 * Name patterns, most specific first — first match wins.
 *
 * Cannabis leads because its vocabulary is unambiguous and a mislabelled
 * cannabis venue is the costliest error here: it is the one category whose
 * legality varies by state.
 *
 * Word boundaries throughout. Without them "vape" matches inside unrelated
 * words and "smokes" would catch any name containing it.
 */
const NAME_RULES: [LoungeType, RegExp][] = [
  ['cannabis', /\b(dispensar\w*|cannabis|marijuana|weed|thc|cbd|budtender|kush|ganja|hemp|pre-?rolls?)\b/i],
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
  { id: 'cannabis', label: 'THC / Cannabis' },
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
