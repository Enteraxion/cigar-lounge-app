/**
 * Mock data for MapScreen — matches design-reference/Map Screen Discover.pdf
 * and Premium Map Alternative.pdf. Coordinates are hand-picked points
 * around a single mock region (Mayfair, London) — there's no real GPS/
 * geocoding wired up yet. Photography pulled from src/data/mockImages.ts
 * (see mockImages.ts for why there's no bundled assets/images/lounges/
 * set in this project).
 */

import { loungeInteriors, rooftopBars, whiskeyBars } from './mockImages';

export const defaultRegion = {
  latitude: 51.509,
  longitude: -0.147,
  latitudeDelta: 0.018,
  longitudeDelta: 0.018,
};

export type MapPinIcon = 'cigar' | 'cup' | 'martini' | 'leaf';

export type MapLounge = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  image: string;
  rating: number;
  distance: string;
  statusLabel: string;
  amenities: string[];
  pinIcon: MapPinIcon;
};

export const mapLounges: MapLounge[] = [
  {
    id: 'heritage-oak-room',
    name: 'The Heritage Oak Room',
    location: 'Mayfair, London',
    latitude: 51.509,
    longitude: -0.147,
    image: loungeInteriors[0],
    rating: 4.9,
    distance: '0.8 miles away',
    statusLabel: 'Open Now',
    amenities: ['Outdoor Terrace', 'Humidor Access', 'Full Bar'],
    pinIcon: 'cigar',
  },
  {
    id: 'montefortuna-lounge',
    name: 'Montefortuna Lounge',
    location: 'Mayfair, London',
    latitude: 51.5105,
    longitude: -0.1495,
    image: whiskeyBars[0],
    rating: 4.6,
    distance: '0.4 mi away',
    statusLabel: 'Open Now',
    amenities: ['Full Bar', 'Lockers'],
    pinIcon: 'cup',
  },
  {
    id: 'the-smoke',
    name: 'The Smoke',
    location: 'Soho, London',
    latitude: 51.5073,
    longitude: -0.1445,
    image: loungeInteriors[1],
    rating: 4.5,
    distance: '1.2 mi away',
    statusLabel: 'Closes 11PM',
    amenities: ['Humidor Access', 'Terrace'],
    pinIcon: 'cigar',
  },
  {
    id: 'humidor-suite',
    name: 'The Humidor Suite',
    location: 'Mayfair, London',
    latitude: 51.5098,
    longitude: -0.1438,
    image: whiskeyBars[1],
    rating: 4.9,
    distance: '1.0 mi away',
    statusLabel: 'Open Now',
    amenities: ['Whiskey', 'Private Rooms'],
    pinIcon: 'martini',
  },
  {
    id: 'summit',
    name: 'Summit',
    location: 'Manhattan, NY',
    latitude: 51.5065,
    longitude: -0.1505,
    image: rooftopBars[0],
    rating: 4.7,
    distance: '1.6 mi away',
    statusLabel: 'Open Now',
    amenities: ['Rooftop', 'Live Music'],
    pinIcon: 'leaf',
  },
];

export const mapFilterChips = [
  { id: 'all', label: 'All Places' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'open-now', label: 'Open Now' },
];

export const weatherWidget = {
  temperature: '72°',
  message: 'Perfect weather for patio smoking.',
};

export const conciergeSuggestion = {
  message: 'Looking for a mild Robusto nearby?',
};

export const voiceSearchSuggestions = [
  'Find lounges with Wi-Fi',
  'Show lounges with Padron',
  'Find lounges near me',
];

export const recentVoiceSearches = ['Rooftop lounges NY', 'Cohiba selection'];
