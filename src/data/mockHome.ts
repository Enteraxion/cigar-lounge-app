/**
 * Mock data for HomeScreen — matches design-reference/Home Screen.pdf.
 * Photography pulled from src/data/mockImages.ts (curated cigar-lounge
 * themed placeholders) so imagery stays consistent across the app.
 */

import {
  cigarDetails,
  cityNightscapes,
  loungeInteriors,
  memberPortrait,
  rooftopBars,
  whiskeyBars,
} from './mockImages';

export type LoungeSummary = {
  id: string;
  name: string;
  imageUri: string;
  tags?: string;
  location?: string;
  distance?: string;
  rating?: number;
};

export type MemberEvent = {
  id: string;
  month: string;
  day: string;
  title: string;
  venue: string;
  time: string;
};

export type CigarOfWeek = {
  brandLabel: string;
  name: string;
  wrapper: string;
  strength: string;
  burnTime: string;
  imageUri: string;
};

export const currentUser = {
  name: 'Alexander Rossi',
  avatarUri: memberPortrait,
};

export const featuredLounge: LoungeSummary = {
  id: 'heritage-oak-room',
  name: 'The Heritage Oak Room',
  imageUri: loungeInteriors[0],
  location: 'Mayfair, London',
  rating: 4.9,
};

export const nearbyLounges: LoungeSummary[] = [
  {
    id: 'smoke-velvet',
    name: 'Smoke & Velvet',
    imageUri: whiskeyBars[1],
    tags: 'Exclusive Spirits • Live Jazz',
    distance: '1.2 mi',
    rating: 4,
  },
  {
    id: 'cloud-nine',
    name: 'Cloud Nine',
    imageUri: rooftopBars[0],
    tags: 'Outdoor Terrace',
    distance: '2.0 mi',
    rating: 4,
  },
  {
    id: 'the-ember-room',
    name: 'The Ember Room',
    imageUri: cigarDetails[2],
    tags: 'Private Humidor',
    distance: '2.8 mi',
    rating: 5,
  },
  {
    id: 'gilded-leaf',
    name: 'Gilded Leaf',
    imageUri: whiskeyBars[0],
    tags: 'Rooftop • Whisky Bar',
    distance: '3.4 mi',
    rating: 4,
  },
];

export const cigarOfWeek: CigarOfWeek = {
  brandLabel: 'ARTISAN SELECT',
  name: 'Padrón 1926 Series',
  wrapper: 'Nicaraguan Habano',
  strength: 'Full Bodied',
  burnTime: '45 - 60 Mins',
  imageUri: cigarDetails[0],
};

export const trendingLounges: LoungeSummary[] = [
  {
    id: 'the-gatsby',
    name: 'The Gatsby',
    imageUri: loungeInteriors[1],
    location: 'Manhattan, NY',
  },
  {
    id: 'roma-reserve',
    name: 'Roma Reserve',
    imageUri: loungeInteriors[0],
    location: 'Rome, Italy',
  },
  {
    id: 'havana-heritage',
    name: 'Havana Heritage',
    imageUri: cityNightscapes[0],
    location: 'Miami, FL',
  },
];

export const memberEvents: MemberEvent[] = [
  {
    id: 'single-malt-habano',
    month: 'OCT',
    day: '24',
    title: 'Single Malt & Habano Night',
    venue: 'The Reserve',
    time: '19:00 PM',
  },
  {
    id: 'torcedor-masterclass',
    month: 'NOV',
    day: '02',
    title: 'Torcedor Masterclass',
    venue: 'Davidoff Lounge',
    time: '15:30 PM',
  },
];
