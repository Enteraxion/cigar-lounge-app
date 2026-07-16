/**
 * Mock data for LoungeDetailScreen — matches
 * design-reference/Lounge Detail Screen.pdf.
 *
 * NOTE: there is no bundled assets/images/lounges/ set in this project —
 * see src/data/mockImages.ts for why. Gallery and humidor photography
 * here reuse those same curated Unsplash exports.
 */

import { cigarDetails, loungeInteriors, memberPortrait, whiskeyBars } from './mockImages';

export type AmenityIconKey = 'martini' | 'umbrella' | 'lock' | 'wifi';

export type AmenityItem = {
  id: string;
  label: string;
  icon: AmenityIconKey;
};

export type HumidorItem = {
  id: string;
  name: string;
  imageUri: string;
  strength: string;
  origin: string;
  stock: 'in-stock' | 'low-stock';
  price: string;
};

export type VerdictScore = {
  id: string;
  label: string;
  score: number;
};

export type Review = {
  id: string;
  authorName: string;
  memberTier: string;
  avatarUri: string;
  rating: number;
  text: string;
  timeAgo: string;
  likeCount: number;
  commentCount: number;
  photoUris: string[];
};

export type LoungeDetail = {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  galleryImages: string[];
  description: string;
  statusLabel: string;
  amenities: AmenityItem[];
  humidorItems: HumidorItem[];
  verdictScores: VerdictScore[];
  review: Review;
};

export const loungeDetail: LoungeDetail = {
  id: 'heritage-oak-room',
  name: 'The Heritage Oak Room',
  address: '42 Mount St, Mayfair, London W1K 2RX',
  rating: 4.9,
  reviewCount: 248,
  galleryImages: [loungeInteriors[0], cigarDetails[1], whiskeyBars[1]],
  description:
    'An sanctuary of old-world charm in the heart of Mayfair. Featuring a walk-in humidor with over 400 varieties, a curated selection of rare single malts, and bespoke leather seating.',
  statusLabel: 'Open until 02:00 AM',
  amenities: [
    { id: 'premium-bar', label: 'Premium Bar', icon: 'martini' },
    { id: 'terrace', label: 'Terrace', icon: 'umbrella' },
    { id: 'lockers', label: 'Lockers', icon: 'lock' },
    { id: 'fast-wifi', label: 'Fast Wi-Fi', icon: 'wifi' },
  ],
  humidorItems: [
    {
      id: 'cohiba-behike-52',
      name: 'Cohiba Behike 52',
      imageUri: cigarDetails[0],
      strength: 'Med-Full',
      origin: 'Cuba',
      stock: 'in-stock',
      price: '£120.00',
    },
    {
      id: 'davidoff-royal',
      name: 'Davidoff Royal',
      imageUri: cigarDetails[1],
      strength: 'Mild',
      origin: 'Dom. Rep.',
      stock: 'low-stock',
      price: '£85.00',
    },
    {
      id: 'padron-1926',
      name: 'Padrón 1926 Series',
      imageUri: cigarDetails[2],
      strength: 'Full Bodied',
      origin: 'Nicaragua',
      stock: 'in-stock',
      price: '£95.00',
    },
  ],
  verdictScores: [
    { id: 'atmosphere', label: 'Atmosphere', score: 5.0 },
    { id: 'humidor-variety', label: 'Humidor Variety', score: 4.8 },
    { id: 'service', label: 'Service', score: 4.9 },
    { id: 'comfort', label: 'Comfort', score: 4.7 },
  ],
  review: {
    id: 'julian-thorne-review',
    authorName: 'Julian Thorne',
    memberTier: 'Executive Member',
    avatarUri: memberPortrait,
    rating: 5,
    text: 'Impeccable service and an incredible selection. The ventilation system here is world-class, keeping the air fresh even during peak hours.',
    timeAgo: 'Yesterday',
    likeCount: 24,
    commentCount: 3,
    photoUris: [whiskeyBars[0], cigarDetails[0]],
  },
};
