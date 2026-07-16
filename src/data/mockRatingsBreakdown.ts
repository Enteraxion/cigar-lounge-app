/**
 * Mock data for RatingsBreakdownScreen — matches design-reference/Ratings
 * Breakdown & Filter Reviews.pdf. No backend wired up yet.
 */

export type RatingDistributionRow = {
  stars: number;
  percent: number;
};

export const overallRating = {
  score: 4.9,
  maxScore: 5.0,
  verifiedCount: 248,
};

export const ratingDistribution: RatingDistributionRow[] = [
  { stars: 5, percent: 0.95 },
  { stars: 4, percent: 0.32 },
  { stars: 3, percent: 0.09 },
  { stars: 2, percent: 0.04 },
  { stars: 1, percent: 0.02 },
];

export const specificCategories = [
  { label: 'Atmosphere', score: 5.0 },
  { label: 'Humidor Variety', score: 4.8 },
  { label: 'Service', score: 4.9 },
  { label: 'Comfort', score: 4.7 },
  { label: 'Ventilation', score: 5.0 },
];

export const foodAndDrinksQuality = { label: 'Food & Drinks Quality', score: 4.5 };

export type StatHighlight = {
  label: string;
  value: string;
};

export const statHighlightsRowOne: [StatHighlight, StatHighlight] = [
  { label: 'Wi-Fi Speed', value: 'Excellent' },
  { label: 'Business Friendly', value: 'High' },
];

export const statHighlightsRowTwo: [StatHighlight, StatHighlight] = [
  { label: 'Social Scene', value: 'Refined' },
  { label: 'Parking', value: 'Valet Only' },
];
