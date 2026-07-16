/**
 * Mock data for the Collections flow — matches design-reference/
 * Collections Grid Screen.pdf, Collection Detail Screen.pdf, Create
 * Collection Screen.pdf, and Add to Collection Screen.pdf. Photography
 * pulled from src/data/mockImages.ts so imagery stays consistent with
 * the rest of the app. No backend wired up yet.
 */

import { cigarDetails, loungeInteriors, rooftopBars, whiskeyBars } from './mockImages';

export type Privacy = 'private' | 'public';

export type CollectionLounge = {
  id: string;
  name: string;
  location: string;
  imageUri: string;
  rating: number;
};

export type Collection = {
  id: string;
  name: string;
  privacy: Privacy;
  coverImage: string;
  galleryImages: string[];
  itemCount: number;
  lastUpdated: string;
  description: string;
  lounges: CollectionLounge[];
};

export const collectionCategories = ['Speakeasy', 'Rooftop', 'Exclusive', 'Private'];

export const collections: Collection[] = [
  {
    id: 'london-speakeasy',
    name: 'London Speakeasy',
    privacy: 'private',
    coverImage: loungeInteriors[0],
    galleryImages: [loungeInteriors[0], loungeInteriors[1], whiskeyBars[1]],
    itemCount: 8,
    lastUpdated: 'yesterday',
    description:
      'A curated selection of the most exclusive, hidden, and high-end cigar lounges across Mayfair and Marylebone. This folder includes spots with rare vintage collections and exceptional service.',
    lounges: [
      {
        id: 'heritage-oak-room',
        name: 'The Heritage Oak Room',
        location: 'Mayfair, London',
        imageUri: loungeInteriors[0],
        rating: 4.9,
      },
      {
        id: 'velvet-ash',
        name: 'The Velvet Ash',
        location: 'Marylebone, London',
        imageUri: cigarDetails[1],
        rating: 4.7,
      },
    ],
  },
  {
    id: 'business-trip-ny',
    name: 'Business Trip NY',
    privacy: 'public',
    coverImage: whiskeyBars[0],
    galleryImages: [whiskeyBars[0], loungeInteriors[1]],
    itemCount: 3,
    lastUpdated: '3 days ago',
    description:
      'Reliable spots near Midtown for closing deals over a good smoke — quick service, private booths, and a serious whiskey list.',
    lounges: [
      {
        id: 'davidoff-geneva-1911',
        name: 'Davidoff of Geneva Since 1911',
        location: 'Midtown Manhattan',
        imageUri: loungeInteriors[0],
        rating: 4.9,
      },
      {
        id: 'grand-reserve-lounge',
        name: 'The Grand Reserve Lounge',
        location: 'Upper East Side',
        imageUri: whiskeyBars[1],
        rating: 4.7,
      },
    ],
  },
  {
    id: 'rare-malt-pairing',
    name: 'Rare Malt Pairing',
    privacy: 'private',
    coverImage: whiskeyBars[1],
    galleryImages: [whiskeyBars[1], whiskeyBars[0]],
    itemCount: 12,
    lastUpdated: '1 week ago',
    description:
      'Lounges with the deepest single malt cellars, paired by staff who actually know their cigars. Bring patience and an open tab.',
    lounges: [
      {
        id: 'smoke-velvet',
        name: 'Smoke & Velvet',
        location: 'Downtown',
        imageUri: whiskeyBars[1],
        rating: 4,
      },
    ],
  },
  {
    id: 'rooftop-views',
    name: 'Rooftop Views',
    privacy: 'private',
    coverImage: rooftopBars[1],
    galleryImages: [rooftopBars[1], rooftopBars[0]],
    itemCount: 5,
    lastUpdated: '2 weeks ago',
    description:
      'Open-air terraces and skyline views for warm nights — best enjoyed with a light Connecticut wrapper and a cold drink.',
    lounges: [
      {
        id: 'cloud-nine-skybar',
        name: 'Cloud Nine Skybar',
        location: 'City Center',
        imageUri: rooftopBars[0],
        rating: 5,
      },
      {
        id: 'summit',
        name: 'Summit',
        location: 'Manhattan, NY',
        imageUri: rooftopBars[1],
        rating: 4.7,
      },
    ],
  },
  {
    id: 'italy-2024',
    name: 'Italy 2024',
    privacy: 'public',
    coverImage: cigarDetails[2],
    galleryImages: [cigarDetails[2], loungeInteriors[1]],
    itemCount: 9,
    lastUpdated: '1 month ago',
    description:
      'A running list from the Italy trip — old-world lounges, terrace seating, and a few spots worth a repeat visit.',
    lounges: [
      {
        id: 'roma-reserve',
        name: 'Roma Reserve',
        location: 'Rome, Italy',
        imageUri: loungeInteriors[1],
        rating: 5,
      },
    ],
  },
];

export const totalFolders = collections.length;
