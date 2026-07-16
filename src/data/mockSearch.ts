/**
 * Mock data for SearchScreen — matches design-reference/Search Home Screen.pdf.
 * Photography pulled from src/data/mockImages.ts (curated cigar-lounge
 * themed placeholders) so imagery stays consistent across the app.
 */

import { cityNightscapes, loungeInteriors, rooftopBars, whiskeyBars } from './mockImages';

export type FilterChipOption = {
  id: string;
  label: string;
};

export type RecentSearch = {
  id: string;
  term: string;
  subtitle: string;
};

export type PopularDestination = {
  id: string;
  city: string;
  imageUri: string;
};

export type TrendingCity = {
  id: string;
  rank: string;
  name: string;
};

export type RecentlyViewedLounge = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  rating: number;
  imageUri: string;
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

export const recentSearches: RecentSearch[] = [
  {
    id: 'davidoff-geneva',
    term: 'Davidoff of Geneva Since 1911',
    subtitle: 'New York City, NY',
  },
  {
    id: 'arturo-fuente',
    term: 'Arturo Fuente Hemingway',
    subtitle: 'Available nearby',
  },
];

export const popularDestinations: PopularDestination[] = [
  { id: 'miami', city: 'Miami', imageUri: cityNightscapes[0] },
  { id: 'chicago', city: 'Chicago', imageUri: cityNightscapes[1] },
  { id: 'los-angeles', city: 'Los Angeles', imageUri: cityNightscapes[2] },
  { id: 'las-vegas-dest', city: 'Las Vegas', imageUri: cityNightscapes[3] },
];

export const trendingCities: TrendingCity[] = [
  { id: 'las-vegas', rank: '01', name: 'Las Vegas' },
  { id: 'houston', rank: '02', name: 'Houston' },
  { id: 'atlanta', rank: '03', name: 'Atlanta' },
  { id: 'tampa', rank: '04', name: 'Tampa' },
];

export const recentlyViewedLounges: RecentlyViewedLounge[] = [
  {
    id: 'humidor-suite',
    name: 'The Humidor Suite',
    location: 'Mayfair, London',
    tags: ['Whiskey', 'Private'],
    rating: 4.9,
    imageUri: whiskeyBars[1],
  },
  {
    id: 'summit',
    name: 'Summit',
    location: 'Manhattan, NY',
    tags: ['Rooftop', 'Live Music'],
    rating: 4.7,
    imageUri: rooftopBars[0],
  },
  {
    id: 'ember-den',
    name: 'The Ember Den',
    location: 'Chicago, IL',
    tags: ['Humidor', 'Bar'],
    rating: 4.5,
    imageUri: loungeInteriors[1],
  },
];

export const featuredTravelGuide: FeaturedTravelGuide = {
  label: 'Featured Travel Guide',
  headline: 'Traveling to Nashville?',
  description:
    'Explore the highest-rated lounges in the Music City, from hidden speakeasies to luxury rooftops.',
  ctaLabel: 'Explore Nashville',
  imageUri: cityNightscapes[4],
};
