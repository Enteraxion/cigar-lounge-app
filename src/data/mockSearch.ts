/**
 * Mock data for SearchScreen — matches design-reference/Search Home Screen.pdf.
 * Photography pulled from src/data/mockImages.ts (curated cigar-lounge
 * themed placeholders) so imagery stays consistent across the app.
 *
 * Recent Searches, Popular Destinations, Trending Cities, Recently
 * Viewed and the Featured Travel Guide are all real data now (see
 * loungeService/userActionsService) — the guide picks the city this app
 * actually covers best rather than a fixed "Traveling to Nashville?".
 * Only the filter chip vocabulary remains curated here, and each chip
 * runs a real query (see SearchScreen's pressFilterChip).
 */

export type FilterChipOption = {
  id: string;
  label: string;
};

export const filterChips: FilterChipOption[] = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'open-now', label: 'Open Now' },
  { id: 'premium', label: 'Premium' },
  { id: 'whiskey', label: 'Whiskey' },
];
