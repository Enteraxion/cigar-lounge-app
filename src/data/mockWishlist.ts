/**
 * Mock data for TravelWishlistScreen — matches design-reference/Travel
 * Wishlist Screen.pdf. Photography pulled from src/data/mockImages.ts
 * (there is no bundled assets/images/lounges/ set in this project — see
 * mockImages.ts for why). No backend/real trip planning wired up yet.
 */

import {
  cityNightscapes,
  loungeInteriors,
  rooftopBars,
  whiskeyBars,
} from './mockImages';

export const activePlan = {
  name: 'European Grand Tour',
  heroImage: loungeInteriors[1],
  destinationsCount: 4,
  savedLoungesCount: 12,
};

export type WishlistDestination = {
  id: string;
  city: string;
  country: string;
  loungesSaved: number;
  image: string;
};

export const destinations: WishlistDestination[] = [
  {
    id: 'new-york',
    city: 'New York',
    country: 'USA',
    loungesSaved: 3,
    image: cityNightscapes[1],
  },
  {
    id: 'rome',
    city: 'Rome',
    country: 'Italy',
    loungesSaved: 5,
    image: loungeInteriors[0],
  },
  {
    id: 'london',
    city: 'London',
    country: 'UK',
    loungesSaved: 4,
    image: whiskeyBars[1],
  },
];

export const nextStopHighlight = {
  label: 'Must Visit',
  loungeName: 'Smoke & Velvet',
  image: whiskeyBars[1],
  location: 'Mayfair, London',
  rating: 4.8,
  ratingLabel: 'Top Pick',
};

export type WishlistLounge = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  rating: number;
  image: string;
};

export const savedLounges: WishlistLounge[] = [
  {
    id: 'cloud-nine-skybar',
    name: 'Cloud Nine Skybar',
    location: 'New York, USA',
    tags: ['Outdoor Terrace', 'City View'],
    rating: 4.7,
    image: rooftopBars[0],
  },
  {
    id: 'the-heritage',
    name: 'The Heritage',
    location: 'Rome, Italy',
    tags: ['Oak Paneling', 'Rare Reserve'],
    rating: 4.6,
    image: loungeInteriors[0],
  },
  {
    id: 'the-gatsby',
    name: 'The Gatsby',
    location: 'London, UK',
    tags: ['Speakeasy Style', 'Rare Malts'],
    rating: 4.5,
    image: loungeInteriors[1],
  },
  {
    id: 'casa-de-montecristo',
    name: 'Casa de Montecristo',
    location: 'New York, USA',
    tags: ['Rooftop', 'Live Jazz'],
    rating: 4.8,
    image: whiskeyBars[0],
  },
];
