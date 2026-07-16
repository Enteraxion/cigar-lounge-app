/**
 * Mock data for SearchResultsScreen — matches
 * design-reference/Search Results Screen.pdf.
 *
 * NOTE: there is no bundled assets/images/lounges/ set in this project —
 * Home and Search both source lounge photography from src/data/mockImages.ts
 * (curated real Unsplash photos, see that file's header for why). To
 * "reuse the same set" without fetching anything new, these results pull
 * from those same exports rather than local require()'d files.
 */

import { loungeInteriors, rooftopBars, whiskeyBars } from './mockImages';

export type StatusBadge = 'premium' | 'open' | 'closed';
export type AmenityKey = 'coffee' | 'utensils' | 'wifi' | 'bell' | 'parking' | 'tv';

export type SearchResult = {
  id: string;
  name: string;
  imageUri: string;
  badges: StatusBadge[];
  rating: number;
  priceTier: string;
  distance: string;
  neighborhood: string;
  atmosphereScore: number;
  businessScore: number;
  amenities: AmenityKey[];
};

export const searchResultsQuery = 'Davidoff Lounges';
export const totalResultsCount = 28;

export const quickFilterChips = [
  { id: 'premium', label: 'Premium' },
  { id: 'open-now', label: 'Open Now' },
];

export const searchResults: SearchResult[] = [
  {
    id: 'davidoff-geneva-1911',
    name: 'Davidoff of Geneva Since 1911',
    imageUri: loungeInteriors[0],
    badges: ['premium', 'open'],
    rating: 4.9,
    priceTier: '$$$$',
    distance: '1.2 miles',
    neighborhood: 'Midtown Manhattan',
    atmosphereScore: 9.8,
    businessScore: 9.5,
    amenities: ['coffee', 'utensils', 'wifi', 'bell', 'parking', 'tv'],
  },
  {
    id: 'grand-reserve-lounge',
    name: 'The Grand Reserve Lounge',
    imageUri: whiskeyBars[1],
    badges: [],
    rating: 4.7,
    priceTier: '$$$',
    distance: '2.8 miles',
    neighborhood: 'Upper East Side',
    atmosphereScore: 8.9,
    businessScore: 9.1,
    amenities: ['coffee', 'wifi', 'tv'],
  },
  {
    id: 'heritage-cigar-social',
    name: 'Heritage Cigar & Social',
    imageUri: loungeInteriors[1],
    badges: ['closed'],
    rating: 4.5,
    priceTier: '$$',
    distance: '3.5 miles',
    neighborhood: 'Soho District',
    atmosphereScore: 8.5,
    businessScore: 8.2,
    amenities: ['coffee', 'utensils', 'wifi'],
  },
  {
    id: 'gilded-leaf-terrace',
    name: 'Gilded Leaf Terrace',
    imageUri: rooftopBars[0],
    badges: ['open'],
    rating: 4.6,
    priceTier: '$$$',
    distance: '4.1 miles',
    neighborhood: 'Financial District',
    atmosphereScore: 9.0,
    businessScore: 8.7,
    amenities: ['coffee', 'utensils', 'wifi', 'tv'],
  },
  {
    id: 'smoke-velvet-bar',
    name: 'Smoke & Velvet',
    imageUri: whiskeyBars[0],
    badges: ['premium'],
    rating: 4.8,
    priceTier: '$$$$',
    distance: '5.0 miles',
    neighborhood: 'Chelsea',
    atmosphereScore: 9.4,
    businessScore: 9.0,
    amenities: ['coffee', 'utensils', 'wifi', 'bell', 'parking', 'tv'],
  },
];
