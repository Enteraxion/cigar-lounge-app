/**
 * Sort options for SortBottomSheet — matches
 * design-reference/Sort & Active Summary.pdf radio list.
 */

export type SortOption = {
  id: string;
  label: string;
  icon?: 'crown';
};

export const sortOptions: SortOption[] = [
  { id: 'best-match', label: 'Best Match' },
  { id: 'distance', label: 'Distance' },
  { id: 'highest-rated', label: 'Highest Rated' },
  { id: 'most-reviewed', label: 'Most Reviewed' },
  { id: 'recently-added', label: 'Recently Added' },
  { id: 'open-now', label: 'Open Now' },
  { id: 'premium-experience', label: 'Premium Experience', icon: 'crown' },
  { id: 'traveler-favorites', label: 'Traveler Favorites' },
];

export const defaultSortOptionId = 'best-match';
