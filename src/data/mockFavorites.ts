/**
 * Mock data for FavoritesScreen — matches design-reference/Favorites Home
 * Screen.pdf. Photography pulled from src/data/mockImages.ts so imagery
 * stays consistent with Home's lounge photos. No backend wired up yet.
 */

import { cityNightscapes, loungeInteriors, rooftopBars, whiskeyBars } from './mockImages';

export type FavoriteLounge = {
  id: string;
  name: string;
  imageUri: string;
  tags: string;
  distance: string;
  rating: number;
};

export const favoritesStats = {
  favoriteLounges: 12,
  visited: 48,
  collections: 5,
  statesVisited: 8,
};

// Set to false to preview the empty state instead of the populated list.
export const hasFavorites = true;

export const favoriteLounges: FavoriteLounge[] = [
  {
    id: 'smoke-velvet',
    name: 'Smoke & Velvet',
    imageUri: whiskeyBars[1],
    tags: 'Exclusive Spirits • Live Jazz',
    distance: '1.2 mi',
    rating: 4,
  },
  {
    id: 'cloud-nine-skybar',
    name: 'Cloud Nine Skybar',
    imageUri: rooftopBars[0],
    tags: 'Outdoor Terrace • City View',
    distance: '2.8 mi',
    rating: 5,
  },
  {
    id: 'the-gatsby',
    name: 'The Gatsby',
    imageUri: loungeInteriors[1],
    tags: 'Speakeasy Style • Rare Malts',
    distance: '4.1 mi',
    rating: 4,
  },
  {
    id: 'roma-reserve',
    name: 'Roma Reserve',
    imageUri: cityNightscapes[2],
    tags: 'Authentic Italian • Terrace',
    distance: '8.5 mi',
    rating: 5,
  },
];
