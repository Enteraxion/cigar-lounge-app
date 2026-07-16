/**
 * Mock data for the User Profile screen — matches design-reference/
 * User Profile Screen.pdf. Photography pulled from src/data/mockImages.ts
 * (there is no bundled assets/images/lounges/ set in this project — see
 * mockImages.ts for why) so imagery stays consistent with the rest of the
 * app. No backend wired up yet.
 */

import { cigarDetails, loungeInteriors, whiskeyBars } from './mockImages';
import type { Badge } from './mockPassport';

// ProfileScreen now builds its own stat cards from real data — see that
// screen's header comment (userActionsService.ts's getUserStats()).

export const profileAchievementsUnlocked = 8;
export const profileAchievementsTotal = 24;

export const profileAchievementsPreview: Badge[] = [
  { id: 'explorer', label: 'Explorer', icon: 'compass', unlocked: true },
  { id: 'road-warrior', label: 'Road Warrior', icon: 'car', unlocked: true },
  { id: 'humidor-hunter', label: 'Humidor Hunter', icon: 'box', unlocked: false },
];

export type FavoriteCigar = {
  id: string;
  name: string;
  subtitle: string;
  rating: number;
  image: string;
};

export const favoriteCigars: FavoriteCigar[] = [
  { id: 'opusx-reserva', name: 'Arturo Fuente', subtitle: 'OpusX Reserva', rating: 5, image: cigarDetails[1] },
  { id: 'behike-52', name: 'Cohiba', subtitle: 'Behike 52', rating: 5, image: cigarDetails[2] },
  { id: 'anniversary-1926', name: 'Padrón', subtitle: '1926 Anniversary', rating: 4, image: cigarDetails[0] },
];

export type TravelMapPoint = {
  x: number;
  y: number;
};

export const travelHistory = {
  regions: '14',
  lounges: '38',
  lastDestination: {
    city: 'Milan, Italy',
    date: 'Oct 2023',
  },
  mapPoints: [
    { x: 28, y: 22 },
    { x: 52, y: 16 },
    { x: 68, y: 34 },
    { x: 58, y: 52 },
    { x: 38, y: 58 },
  ] as TravelMapPoint[],
};

export type ActivityEntry = {
  id: string;
  icon: 'logIn' | 'camera';
  description: string;
  highlight: string;
  meta: string;
  xp?: number;
  quote?: string;
  photos?: string[];
  overflowCount?: number;
};

export const recentActivity: ActivityEntry[] = [
  {
    id: 'oak-room-checkin',
    icon: 'logIn',
    description: 'Checked in at',
    highlight: 'The Oak Room',
    meta: '2 hours ago • Mayfair, London',
    xp: 25,
    quote:
      '"Phenomenal draw on the 1926 Anniversary tonight. The service here remains second to none."',
  },
  {
    id: 'casa-del-habano-photos',
    icon: 'camera',
    description: 'Added 3 photos to',
    highlight: 'Casa del Habano',
    meta: 'Yesterday • Rome, Italy',
    photos: [loungeInteriors[0], whiskeyBars[0]],
    overflowCount: 1,
  },
];
