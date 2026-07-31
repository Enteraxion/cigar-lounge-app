/**
 * reviewFilters
 *
 * Real filter/sort logic for FilterReviewsSheet + ReviewsScreen. Only
 * covers dimensions with actual backing fields on ReviewDocument
 * (rating, createdAt, helpfulCount) — "Verified Visitors" and "Reviewer
 * Type" (Business/Locals/Travelers) were dropped from the original
 * design's filter sheet because no such field exists anywhere in the
 * schema (no visit-verification system, no reviewer-type concept), so
 * they could only ever have been decorative.
 */

import type { Review } from '../services/loungeService';

export type ReviewSortOption = 'Most Helpful' | 'Newest' | 'Highest Rated';

export const REVIEW_SORT_OPTIONS: ReviewSortOption[] = ['Most Helpful', 'Newest', 'Highest Rated'];

export type ReviewFilters = {
  sortBy: ReviewSortOption;
  /** Minimum star rating (inclusive), or null for no filter. */
  minStars: number | null;
};

export const defaultReviewFilters: ReviewFilters = {
  sortBy: 'Most Helpful',
  minStars: null,
};

export function applyReviewFilters(reviews: Review[], filters: ReviewFilters): Review[] {
  const filtered = filters.minStars
    ? reviews.filter(review => review.rating >= filters.minStars!)
    : reviews;

  const sorted = [...filtered];
  switch (filters.sortBy) {
    case 'Newest':
      sorted.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
      break;
    case 'Highest Rated':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    case 'Most Helpful':
    default:
      sorted.sort((a, b) => b.helpfulCount - a.helpfulCount);
      break;
  }
  return sorted;
}
