/**
 * The shapes and the copy the Concierge conversation screen renders.
 *
 * This was `mockConcierge.ts`, and until 2026-09-14 it was most of a fake
 * product: an invented Mayfair recommendation, a scripted conversation, a
 * keyword matcher standing in for a model, trending lounges nobody had been
 * to. All of that fed five screens no member could reach, and those went with
 * the audit's F7.
 *
 * What is left is neither mock nor data. `RecommendationCard` and
 * `CompactSuggestion` are the shapes the real `askConcierge` function fills
 * from real Firestore lounges, and the two string lists are UI copy — what the
 * screen says while it waits, and what it offers when the answer is nothing.
 * Renamed to stop the filename claiming otherwise.
 */

/** A lounge the Concierge is recommending. Filled from real Firestore documents. */
export type RecommendationCard = {
  id: string;
  name: string;
  location: string;
  distance: string;
  rating: number;
  image: string;
  tags: string[];
};

/** A smaller second-choice card shown beneath a recommendation. */
export type CompactSuggestion = {
  id: string;
  name: string;
  subtitle: string;
  image: string;
};

/**
 * Shown in sequence while the function is thinking.
 *
 * Each one is something the request genuinely does, in order — candidates are
 * fetched from Firestore, then narrowed, then handed to the model. A progress
 * message that describes work nobody is doing is just a spinner that lies.
 */
export const loadingStatusMessages = [
  'Finding nearby lounges...',
  'Checking inventory & table availability...',
  'Crafting your recommendation...',
];

/** Offered when the Concierge has no lounge to suggest. */
export const noResultsSuggestions = [
  'Expand your search radius',
  'Relax a filter or two',
  'Try a different city',
];
