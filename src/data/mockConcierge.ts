/**
 * Mock data for the AI Concierge flow — matches design-reference/
 * Concierge Home & Conversation View.pdf and AI Recommendation Results &
 * Inspiration.pdf. Photography pulled from src/data/mockImages.ts (there
 * is no bundled assets/images/lounges/ set in this project — see
 * mockImages.ts for why). No real AI/backend wired up yet; the "match"
 * logic below is a simple keyword check standing in for a real model.
 *
 * NOTE: the design reference greets/addresses the member as "Julian
 * Rossi" specifically on these Concierge screens (distinct from
 * "Alexander Rossi" used as the signed-in member everywhere else in this
 * app) — reproduced as-is since the task called for matching the PDF
 * exactly.
 */

import { cigarDetails, loungeInteriors, memberPortrait, rooftopBars, whiskeyBars } from './mockImages';

export const conciergeUser = {
  name: 'Julian Rossi',
  avatarUri: memberPortrait,
};

export type QuickSuggestion = {
  id: string;
  label: string;
};

export const quickSuggestions: QuickSuggestion[] = [
  { id: 'quiet', label: 'Find a quiet lounge' },
  { id: 'bourbon', label: 'Bourbon & cigars' },
  { id: 'patios', label: 'Outdoor patios' },
  { id: 'humidors', label: 'Premium humidors' },
  { id: 'live-music', label: 'Live music' },
];

export type ConciergeLounge = {
  id: string;
  name: string;
  location: string;
  distance: string;
  rating: number;
  image: string;
  reasoning?: string;
};

export const suggestedForYou: ConciergeLounge[] = [
  {
    id: 'smoke-velvet',
    name: 'Smoke & Velvet',
    location: 'Exclusive Spirits • Live Jazz',
    distance: '1.2 mi',
    rating: 4.8,
    image: loungeInteriors[1],
    reasoning: 'Matches your preference for quiet lounges with strong Wi-Fi',
  },
];

export const trendingNearby: ConciergeLounge[] = [
  {
    id: 'the-gatsby',
    name: 'The Gatsby',
    location: 'Manhattan, NY',
    distance: '2.1 mi',
    rating: 4.7,
    image: loungeInteriors[0],
  },
  {
    id: 'cloud-nine-skybar',
    name: 'Cloud Nine Skybar',
    location: 'Quiet rooftop terrace option',
    distance: '2.8 mi',
    rating: 4.6,
    image: rooftopBars[0],
  },
];

export type RecommendationCard = {
  id: string;
  name: string;
  location: string;
  distance: string;
  rating: number;
  image: string;
  tags: string[];
};

export const heritageOakRecommendation: RecommendationCard = {
  id: 'heritage-oak-room',
  name: 'The Heritage Oak Room',
  location: 'Mayfair, London',
  distance: '0.4 mi',
  rating: 4.9,
  image: loungeInteriors[0],
  tags: ['Private Booths', 'Premium Humidor', 'Wi-Fi'],
};

export type CompactSuggestion = {
  id: string;
  name: string;
  subtitle: string;
  image: string;
};

export const cloudNineCompactSuggestion: CompactSuggestion = {
  id: 'cloud-nine-skybar',
  name: 'Cloud Nine Skybar',
  subtitle: 'Quiet rooftop terrace option',
  image: rooftopBars[0],
};

export type ConversationMessage =
  | { id: string; role: 'user'; text: string; timestamp: string }
  | {
      id: string;
      role: 'ai';
      text: string;
      recommendation: RecommendationCard;
      moreSuggestion?: CompactSuggestion;
    }
  | { id: string; role: 'ai-no-results'; query: string };

export const sampleConversation: ConversationMessage[] = [
  {
    id: 'm1',
    role: 'user',
    text: "I'm looking for a lounge in Mayfair that has a great selection of Padrón and a quiet atmosphere for a client meeting.",
    timestamp: 'Sent 8:12 PM',
  },
  {
    id: 'm2',
    role: 'ai',
    text: "Based on your preference for Padrón and a quiet setting for business, I highly recommend the Heritage Oak Room. It's renowned for its extensive humidor and sophisticated, hushed environment perfect for meetings.",
    recommendation: heritageOakRecommendation,
    moreSuggestion: cloudNineCompactSuggestion,
  },
];

export const loadingStatusMessages = [
  'Finding nearby lounges...',
  'Checking inventory & table availability...',
  'Crafting your recommendation...',
];

export const noResultsSuggestions = [
  'Expand your search radius',
  'Relax a filter or two',
  'Try a different city',
];

const MATCH_KEYWORDS = ['padron', 'padrón', 'mayfair', 'quiet', 'business', 'oak', 'heritage', 'humidor'];

/** Stands in for a real recommendation model — keyword match against a mock corpus of one. */
export function findRecommendationForQuery(query: string) {
  const normalized = query.toLowerCase();
  const isMatch = MATCH_KEYWORDS.some(keyword => normalized.includes(keyword));
  if (!isMatch) {
    return null;
  }
  return {
    text: "Based on your preference for Padrón and a quiet setting for business, I highly recommend the Heritage Oak Room. It's renowned for its extensive humidor and sophisticated, hushed environment perfect for meetings.",
    recommendation: heritageOakRecommendation,
    moreSuggestion: cloudNineCompactSuggestion,
  };
}

export type ResultTabId = 'relevance' | 'distance' | 'rating' | 'price';

export const resultTabs: { id: ResultTabId; label: string }[] = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'distance', label: 'Distance' },
  { id: 'rating', label: 'Rating' },
  { id: 'price', label: 'Price' },
];

export type ResultCard = {
  id: string;
  name: string;
  distance: string;
  rating: number;
  location: string;
  tags: string[];
  image: string;
  insight: string;
  topMatch?: boolean;
};










