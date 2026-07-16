/**
 * Mock data for the Cigar Passport flow — matches design-reference/
 * Passport Home & Journey Map.pdf and Travel Timeline & Achievements.pdf.
 * Photography pulled from src/data/mockImages.ts (there is no bundled
 * assets/images/lounges/ set in this project — see mockImages.ts for
 * why) so imagery stays consistent with the rest of the app. No backend
 * wired up yet.
 */

import {
  cigarDetails,
  loungeInteriors,
  memberPortrait,
  rooftopBars,
  whiskeyBars,
} from './mockImages';

export const passportProfile = {
  name: 'Alexander Rossi',
  avatarUri: memberPortrait,
  memberTier: 'Platinum Member',
  memberSince: 'May 2018',
  homeCity: 'New York, NY',
  favBrand: 'Padrón',
  favLounge: 'The Oak Room',
};

// PassportScreen now builds its own StatCard[] arrays — Reviews
// Written/Photos Uploaded/Favorites Saved/Collections are real
// (userActionsService.ts's getUserStats()), the rest are an honest
// "Soon" placeholder since there's no check-in/travel-history feature
// yet. See that screen's header comment for the full rationale.
export type StatCard = {
  label: string;
  value: string;
};

export type JourneyHighlight = {
  id: string;
  icon: 'flame' | 'mapPin' | 'compass';
  title: string;
  subtitle: string;
};

export const journeyHighlights: JourneyHighlight[] = [
  {
    id: 'streak',
    icon: 'flame',
    title: '5 Week Streak',
    subtitle: 'Consistent lounge discovery',
  },
  {
    id: 'newest',
    icon: 'mapPin',
    title: 'Newest: Roma Reserve',
    subtitle: 'Rome, Italy • Oct 2023',
  },
  {
    id: 'suggestion',
    icon: 'compass',
    title: 'Next Suggestion',
    subtitle: 'The Gatsby • Manhattan, NY',
  },
];

// Scattered dot markers over the stylized US map area — purely decorative,
// positioned as percentages of the map container's width/height.
export type JourneyMapPoint = {
  x: number;
  y: number;
  visited: boolean;
};

export const journeyMapPoints: JourneyMapPoint[] = [
  { x: 12, y: 22, visited: false },
  { x: 26, y: 45, visited: true },
  { x: 38, y: 52, visited: true },
  { x: 22, y: 20, visited: true },
  { x: 45, y: 18, visited: false },
  { x: 52, y: 35, visited: true },
  { x: 58, y: 48, visited: true },
  { x: 63, y: 30, visited: true },
  { x: 48, y: 62, visited: true },
  { x: 70, y: 55, visited: false },
];

export type TimelineEntry = {
  id: string;
  loungeName: string;
  location: string;
  favorite?: boolean;
  distance?: string;
  temperature?: string;
  visitType?: string;
  quote?: string;
  photos?: string[];
  overflowCount?: number;
  compact?: boolean;
  compactMeta?: string;
};

export type TimelineGroup = {
  id: string;
  label: string;
  entries: TimelineEntry[];
};

export const timelineGroups: TimelineGroup[] = [
  {
    id: 'today',
    label: 'Today — Oct 24, 2023',
    entries: [
      {
        id: 'heritage-oak-room-visit',
        loungeName: 'The Heritage Oak Room',
        location: 'Mayfair, London, UK',
        favorite: true,
        distance: '3,450 mi',
        temperature: '14°C',
        visitType: 'Member Night',
        quote:
          '"Phenomenal draw on the 1926 Anniversary tonight. The service remains second to none."',
        photos: [loungeInteriors[0], cigarDetails[0]],
        overflowCount: 1,
      },
    ],
  },
  {
    id: 'yesterday',
    label: 'Yesterday — Oct 23, 2023',
    entries: [
      {
        id: 'roma-reserve-visit',
        loungeName: 'Roma Reserve',
        location: 'Rome, Italy',
        distance: '420 mi',
        temperature: '22°C',
        photos: [loungeInteriors[1]],
      },
    ],
  },
  {
    id: 'earlier',
    label: 'Earlier this Month',
    entries: [
      {
        id: 'the-gatsby-visit',
        loungeName: 'The Gatsby',
        location: 'Manhattan, NY',
        compact: true,
        compactMeta: 'Oct 12 • Social Visit',
        photos: [loungeInteriors[1]],
      },
      {
        id: 'smoke-velvet-visit',
        loungeName: 'Smoke & Velvet',
        location: 'Downtown',
        compact: true,
        compactMeta: 'Oct 5 • Business Trip',
        photos: [whiskeyBars[1]],
      },
      {
        id: 'cloud-nine-visit',
        loungeName: 'Cloud Nine Skybar',
        location: 'City Center',
        compact: true,
        compactMeta: 'Oct 2 • Vacation Visit',
        photos: [rooftopBars[0]],
      },
    ],
  },
];

export type Badge = {
  id: string;
  label: string;
  icon: 'compass' | 'map' | 'globe' | 'users' | 'messageCircle' | 'crown' | 'plane' | 'car' | 'ship' | 'mountain' | 'send' | 'award' | 'box';
  unlocked: boolean;
};

export type AchievementCategory = {
  id: string;
  name: string;
  unlockedCount: number;
  totalCount: number;
  badges: Badge[];
};

export const achievementsPercent = 33;

export const nextRecommendation = {
  text: 'Review 3 more cigars to unlock "Connoisseur"',
};

export const achievementCategories: AchievementCategory[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    unlockedCount: 2,
    totalCount: 4,
    badges: [
      { id: 'pathfinder', label: 'Pathfinder', icon: 'compass', unlocked: true },
      { id: 'wayfarer', label: 'Wayfarer', icon: 'map', unlocked: true },
      { id: 'globetrotter', label: 'Globetrotter', icon: 'globe', unlocked: false },
      { id: 'trailblazer', label: 'Trailblazer', icon: 'send', unlocked: false },
    ],
  },
  {
    id: 'social-member',
    name: 'Social Member',
    unlockedCount: 1,
    totalCount: 4,
    badges: [
      { id: 'mixer', label: 'Mixer', icon: 'users', unlocked: true },
      { id: 'networker', label: 'Networker', icon: 'messageCircle', unlocked: false },
      { id: 'host', label: 'Host', icon: 'crown', unlocked: false },
      { id: 'ambassador', label: 'Ambassador', icon: 'award', unlocked: false },
    ],
  },
  {
    id: 'traveler',
    name: 'Traveler',
    unlockedCount: 5,
    totalCount: 8,
    badges: [
      { id: 'frequent-flyer', label: 'Frequent Flyer', icon: 'plane', unlocked: true },
      { id: 'road-warrior', label: 'Road Warrior', icon: 'car', unlocked: true },
      { id: 'diplomat', label: 'Diplomat', icon: 'award', unlocked: false },
      { id: 'globehopper', label: 'Globehopper', icon: 'globe', unlocked: true },
      { id: 'jetsetter', label: 'Jetsetter', icon: 'send', unlocked: true },
      { id: 'nomad', label: 'Nomad', icon: 'mountain', unlocked: true },
      { id: 'voyager', label: 'Voyager', icon: 'ship', unlocked: false },
      { id: 'elite-explorer', label: 'Elite Explorer', icon: 'compass', unlocked: false },
    ],
  },
];

