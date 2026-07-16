/**
 * Mock data for the Trip Planner flow — matches design-reference/
 * Trip Planner & Saved Conversations.pdf. Photography pulled from
 * src/data/mockImages.ts (there is no bundled assets/images/lounges/ set
 * in this project — see mockImages.ts for why). No real routing/AI wired
 * up yet.
 */

import { loungeInteriors } from './mockImages';

export const routeDetails = {
  starting: 'Mayfair, London',
  destination: 'Edinburgh, UK',
  travelDate: 'Oct 28, 2024',
  stopFrequency: 'Every 2 Hours',
};

export type PreferenceOption = {
  id: string;
  label: string;
};

export const preferenceOptions: PreferenceOption[] = [
  { id: 'padron', label: 'Padrón' },
  { id: 'davidoff', label: 'Davidoff' },
  { id: 'quiet-atmosphere', label: 'Quiet Atmosphere' },
  { id: 'leather-seating', label: 'Leather Seating' },
];

export const defaultSelectedPreferenceIds = ['quiet-atmosphere'];

export type RouteStopLounge = {
  name: string;
  location: string;
  image: string;
};

export type RouteStop = {
  id: string;
  order: number;
  name: string;
  eta: string;
  distance: string;
  lounge?: RouteStopLounge;
};

export const routeStops: RouteStop[] = [
  {
    id: 'cambridge-stopover',
    order: 1,
    name: 'Cambridge Stopover',
    eta: '11:30 AM',
    distance: '55 miles from start',
    lounge: {
      name: 'Smoke & Velvet',
      location: 'Cambridge Centre',
      image: loungeInteriors[1],
    },
  },
  {
    id: 'york-heritage-break',
    order: 2,
    name: 'York Heritage Break',
    eta: '2:45 PM',
    distance: '152 miles from start',
  },
];

export type SavedConversation = {
  id: string;
  title: string;
  timestamp: string;
  summary: string;
  isRecent?: boolean;
};

export const savedConversations: SavedConversation[] = [
  {
    id: 'ny-trip-planning',
    title: 'New York Trip Planning',
    timestamp: '2h ago',
    summary: 'Looking for rooftop lounges near Central Park with vintage whiskeys...',
    isRecent: true,
  },
  {
    id: 'padron-vs-davidoff',
    title: 'Padrón vs Davidoff Selection',
    timestamp: 'Oct 22',
    summary: 'Comparing flavor profiles of Anniversary Series vs Late Hour...',
  },
  {
    id: 'london-weekend-guide',
    title: 'London Weekend Guide',
    timestamp: 'Oct 15',
    summary: 'Top 5 member only clubs with available guest passes for weekend...',
  },
];
