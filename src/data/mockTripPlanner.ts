/**
 * Mock data for the Trip Planner flow — matches design-reference/
 * Trip Planner & Saved Conversations.pdf.
 *
 * The invented route (a fixed London -> Edinburgh trip with three
 * hardcoded stopovers at lounges that exist nowhere in the database) is
 * gone — TripPlannerScreen now builds real itineraries from real lounge
 * coordinates, see src/utils/routePlanner.ts. What remains here is the
 * preference chip vocabulary and the saved-conversations list.
 */

/**
 * The preference chips on the Trip Planner. Real in the sense that
 * matters: each label is matched against the tags and amenities a lounge
 * actually carries (see routePlanner.preferenceMatch), so the "% match"
 * on a stop reflects real lounge data rather than a decorative number.
 */
export type PreferenceOption = {
  id: string;
  label: string;
};

export const preferenceOptions: PreferenceOption[] = [
  { id: 'cigar', label: 'Cigar' },
  { id: 'whiskey', label: 'Whiskey' },
  { id: 'lounge', label: 'Lounge' },
  { id: 'patio', label: 'Patio' },
  { id: 'hookah', label: 'Hookah' },
];

export const defaultSelectedPreferenceIds: string[] = [];

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
