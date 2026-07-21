/**
 * Mock data for SearchSuggestionsScreen — matches
 * design-reference/Live Search Suggestions Screen.pdf. Text-only, no
 * imagery: filtered locally by substring match against the typed query.
 *
 * Recently Visited, Cities, and Lounges are now real data (see
 * loungeService.getDistinctCities / getTopRatedLounges,
 * userActionsService.getRecentlyViewedLounges) — RecentlyVisited stays here
 * only as the shared shape type. Cigar Brands below is still curated/mock.
 */

export type RecentlyVisited = {
  id: string;
  name: string;
  subtitle: string;
};

export type CigarBrandSuggestion = {
  id: string;
  name: string;
  subtitle: string;
  subtitleVariant: 'gold' | 'muted';
  initials: string;
  showAvatar?: boolean;
};

export const cigarBrandSuggestions: CigarBrandSuggestion[] = [
  {
    id: 'davidoff',
    name: 'Davidoff',
    subtitle: 'Top Rated Brand',
    subtitleVariant: 'gold',
    initials: 'D',
    showAvatar: true,
  },
  {
    id: 'david-p-ehrlich',
    name: 'David P. Ehrlich',
    subtitle: 'Heritage Brand',
    subtitleVariant: 'muted',
    initials: 'D',
  },
];
