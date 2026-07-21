/**
 * Mock data for SearchScreen — matches design-reference/Search Home Screen.pdf.
 * Photography pulled from src/data/mockImages.ts (curated cigar-lounge
 * themed placeholders) so imagery stays consistent across the app.
 *
 * Recent Searches, Popular Destinations, Trending Cities, and Recently
 * Viewed are now real data (see loungeService/userActionsService) —
 * only the filter chips and the featured travel guide banner (no backing
 * content model exists for either) are still mock/curated here.
 */

import { cityNightscapes } from './mockImages';

export type FilterChipOption = {
  id: string;
  label: string;
};

export type FeaturedTravelGuide = {
  label: string;
  headline: string;
  description: string;
  ctaLabel: string;
  imageUri: string;
};

export const filterChips: FilterChipOption[] = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'open-now', label: 'Open Now' },
  { id: 'premium', label: 'Premium' },
  { id: 'whiskey', label: 'Whiskey' },
];

export const featuredTravelGuide: FeaturedTravelGuide = {
  label: 'Featured Travel Guide',
  headline: 'Traveling to Nashville?',
  description:
    'Explore the highest-rated lounges in the Music City, from hidden speakeasies to luxury rooftops.',
  ctaLabel: 'Explore Nashville',
  imageUri: cityNightscapes[4],
};
