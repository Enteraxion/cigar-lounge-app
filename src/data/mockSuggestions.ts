/**
 * Mock data for SearchSuggestionsScreen — matches
 * design-reference/Live Search Suggestions Screen.pdf. Text-only, no
 * imagery: filtered locally by substring match against the typed query.
 */

export type RecentlyVisited = {
  id: string;
  name: string;
  subtitle: string;
};

export type CitySuggestion = {
  id: string;
  name: string;
};

export type LoungeSuggestion = {
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

// Name matches the seeded Firestore lounge's real name exactly (see
// scripts/seedFirestore.ts's 'davidoff-geneva-1911' entry) — this feeds
// into a substring search against that lounge's real name/address/tags,
// so it needs to actually match, not just resemble, the real record.
export const recentlyVisited: RecentlyVisited[] = [
  {
    id: 'davidoff-geneva-nyc',
    name: 'Davidoff of Geneva Since 1911',
    subtitle: 'Lounge • Midtown Manhattan, NY',
  },
];

export const citySuggestions: CitySuggestion[] = [
  { id: 'davie-fl', name: 'Davie, FL' },
  { id: 'davenport-ia', name: 'Davenport, IA' },
];

export const loungeSuggestions: LoungeSuggestion[] = [
  {
    id: 'davidoff-geneva-since-1911',
    name: 'Davidoff of Geneva Since 1911',
    subtitle: 'Premium Lounge • 4 Locations',
  },
  {
    id: 'davidoff-lounge',
    name: 'Davidoff Lounge',
    subtitle: 'Luxury Experience • Las Vegas',
  },
];

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
