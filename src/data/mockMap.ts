/**
 * Mock data for MapScreen — matches design-reference/Map Screen Discover.pdf
 * and Premium Map Alternative.pdf. Coordinates are hand-picked points
 * around a single mock region (Mayfair, London) — there's no real GPS/
 * geocoding wired up yet. Photography pulled from src/data/mockImages.ts
 * (see mockImages.ts for why there's no bundled assets/images/lounges/
 * set in this project).
 */

import { loungeInteriors, rooftopBars, whiskeyBars } from './mockImages';

/**
 * Where the map starts, and what "nearby" is measured from, when the app has
 * nothing better — GPS denied or not yet resolved, and no usable home city on
 * the profile.
 *
 * This was central London (51.509, -0.147), carried over from the design
 * mock. Every one of the 8,294 lounges in Firestore is in the United States,
 * so that fallback was wrong in two ways at once: the map opened on a city
 * with no lounges in it, and Home ranked "Nearby Lounges" by distance from
 * London — which, as the comment in HomeScreen puts it, is not a neutral
 * fallback but a wrong answer delivered confidently.
 *
 * It also became the app's slowest path once proximity queries landed: a
 * latitude band around 51.5°N contains almost no US lounges, so the query
 * found nothing and fell through to scanning the whole collection.
 *
 * Now the geographic centre of the contiguous US, with a delta wide enough to
 * frame the country rather than pretend to a neighbourhood. A member seeing
 * this is a member the app cannot locate, and showing them the whole country
 * says exactly that. HomeScreen's `nearbyIsReal` still tells them in words.
 */
export const defaultRegion = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

/**
 * How far to zoom in when the app *does* know where the member is.
 *
 * Separate from defaultRegion's delta on purpose. Both MapScreen's
 * initialRegion and its recenter-on-GPS reused `defaultRegion.latitudeDelta`
 * as "the normal zoom level", which only worked while the fallback happened
 * to be a street-level region. Widening the fallback to frame the country
 * would otherwise have zoomed the map out to 30° for every member with a
 * working GPS fix — the two values look interchangeable and are not.
 */
export const LOCATED_ZOOM_DELTA = 0.08;

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
