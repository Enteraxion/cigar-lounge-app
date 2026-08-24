/**
 * Lounge type classification.
 *
 * The property that matters: real Yelp categories must beat a name guess. A
 * venue called "Havana Cigar Lounge" that Yelp categorises as a hookah bar is a
 * hookah bar, and a filter that trusts the name would put it in the wrong bucket.
 */

import {
  classifyLounge,
  LOUNGE_TYPE_OPTIONS,
  loungeTypeOf,
  matchesLoungeType,
} from '../loungeType';

describe('classifyLounge — categories win', () => {
  it('trusts Yelp categories over the name', () => {
    // The name says cigar, Yelp says hookah bar. Yelp is authoritative.
    const result = classifyLounge({
      name: 'Havana Cigar Lounge',
      yelpCategories: ['hookah_bars'],
    });
    expect(result.type).toBe('hookah');
    expect(result.source).toBe('categories');
  });

  it('reports the source so callers can tell a fact from a guess', () => {
    expect(classifyLounge({ name: 'X', yelpCategories: ['cigarbars'] }).source).toBe('categories');
    expect(classifyLounge({ name: 'Joe’s Cigar Bar' }).source).toBe('name');
    expect(classifyLounge({ name: 'The Metropolitan Society' }).source).toBe('none');
  });

  it('ignores categories it does not recognise and falls through to the name', () => {
    const result = classifyLounge({ name: 'Smoke Shop Central', yelpCategories: ['bars', 'food'] });
    expect(result.type).toBe('tobacco');
    expect(result.source).toBe('name');
  });

  it('is case-insensitive about aliases', () => {
    expect(loungeTypeOf({ name: 'X', yelpCategories: ['CigarBars'] })).toBe('cigar');
  });
});

describe('classifyLounge — name fallback', () => {
  it('classifies each type from a realistic name', () => {
    expect(loungeTypeOf({ name: 'King Corona Cigars Bar And Cafe' })).toBe('cigar');
    expect(loungeTypeOf({ name: 'Sahara Sheesha Lounge' })).toBe('hookah');
    expect(loungeTypeOf({ name: 'Cloud 9 Vape Shop' })).toBe('vape');
    expect(loungeTypeOf({ name: 'Boston Smoke & More' })).toBe('tobacco');
  });

  it('files a cigar shop that mentions CBD or Kush as a CIGAR shop', () => {
    // The reason the cannabis type was dropped on 2026-08-24. All 34 lounges it
    // ever matched came from the venue's NAME — none from a Yelp cannabis
    // category — and the guesses were mostly wrong. These are real names from
    // the directory that used to be filed under cannabis and are now findable
    // by the filter that should always have found them.
    expect(loungeTypeOf({ name: 'Kush Cigar House, Vapes Southlake' })).toBe('cigar');
    expect(loungeTypeOf({ name: 'Smoke 4 less Cigar Vape & CBD' })).toBe('cigar');
    expect(loungeTypeOf({ name: 'Dr Kush Smoke Shop' })).toBe('tobacco');
  });

  it('has no cannabis type at all', () => {
    // Guideline 1.4.3 does not permit apps facilitating the sale of marijuana.
    // Nothing should reintroduce this without a fresh read of that rule.
    const ids = LOUNGE_TYPE_OPTIONS.map(option => String(option.id));
    expect(ids).not.toContain('cannabis');
    expect(JSON.stringify(LOUNGE_TYPE_OPTIONS).toLowerCase()).not.toContain('thc');
  });

  it('recovers venues the earlier name rules missed', () => {
    // These were in the measured 40.6% unknown before "smokers" was included.
    expect(loungeTypeOf({ name: 'Smokers Dynasty' })).toBe('tobacco');
    expect(loungeTypeOf({ name: 'Smokers Depot' })).toBe('tobacco');
    expect(loungeTypeOf({ name: 'Hyphy Smokers Club' })).toBe('tobacco');
  });

  it('uses word boundaries so unrelated names do not match', () => {
    // "Vapiano" contains "vap", "Escondido" contains "cond" — neither is a hit.
    expect(loungeTypeOf({ name: 'Vapiano Italian Kitchen' })).toBe('unknown');
    expect(loungeTypeOf({ name: 'Oakwood Square' })).toBe('unknown');
    expect(loungeTypeOf({ name: 'La Dolce Vita Wine Lounge' })).toBe('unknown');
  });

  it('returns unknown rather than guessing', () => {
    expect(loungeTypeOf({ name: 'The Metropolitan Society' })).toBe('unknown');
    expect(loungeTypeOf({})).toBe('unknown');
    expect(loungeTypeOf({ name: '' })).toBe('unknown');
  });
});

describe('matchesLoungeType', () => {
  it('matches everything when nothing is selected', () => {
    expect(matchesLoungeType({ name: 'anything' }, [])).toBe(true);
  });

  it('matches only the selected types', () => {
    const hookah = { name: 'Shisha Palace' };
    expect(matchesLoungeType(hookah, ['hookah'])).toBe(true);
    expect(matchesLoungeType(hookah, ['cigar'])).toBe(false);
    expect(matchesLoungeType(hookah, ['cigar', 'hookah'])).toBe(true);
  });

  it('lets "Other" reach the untypeable venues', () => {
    // Without this, 40.6% of lounges are unreachable through the filter.
    expect(matchesLoungeType({ name: 'The Metropolitan Society' }, ['unknown'])).toBe(true);
    expect(matchesLoungeType({ name: 'Joe’s Cigar Bar' }, ['unknown'])).toBe(false);
  });
});

describe('LOUNGE_TYPE_OPTIONS', () => {
  it('offers every type the classifier can return', () => {
    const ids = LOUNGE_TYPE_OPTIONS.map(o => o.id);
    for (const type of ['cigar', 'hookah', 'vape', 'tobacco', 'unknown'] as const) {
      expect(ids).toContain(type);
    }
  });

  it('calls the unknown bucket "Other" — honest without sounding broken', () => {
    expect(LOUNGE_TYPE_OPTIONS.find(o => o.id === 'unknown')?.label).toBe('Other');
  });
});
