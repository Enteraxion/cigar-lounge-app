/**
 * Mock data for ReviewsScreen — matches
 * design-reference/Lounge Reviews & Write Review.pdf.
 *
 * NOTE: there is no bundled assets/images/lounges/ set in this project —
 * see src/data/mockImages.ts for why. Review photo thumbnails here reuse
 * those same curated Unsplash exports.
 */

import { cigarDetails, loungeInteriors, memberPortrait, whiskeyBars } from './mockImages';

export type RatingDistributionRow = {
  stars: number;
  percent: number;
};

export type CategoryRating = {
  label: string;
  score: number;
};

export type OwnerResponse = {
  authorName: string;
  text: string;
};

export type ReviewItem = {
  id: string;
  authorName: string;
  memberTier: string;
  avatarUri: string;
  rating: number;
  timeAgo: string;
  text: string;
  categoryRatings: CategoryRating[];
  photoUris: string[];
  likeCount: number;
  commentCount: number;
  ownerResponse?: OwnerResponse;
};

export const reviewsSummary = {
  overallRating: 4.8,
  totalCount: 248,
  distribution: [
    { stars: 5, percent: 0.92 },
    { stars: 4, percent: 0.35 },
    { stars: 3, percent: 0.08 },
    { stars: 2, percent: 0.03 },
    { stars: 1, percent: 0.02 },
  ] as RatingDistributionRow[],
};

export const reviews: ReviewItem[] = [
  {
    id: 'julian-thorne-review',
    authorName: 'Julian Thorne',
    memberTier: 'Executive Member',
    avatarUri: memberPortrait,
    rating: 5,
    timeAgo: 'Yesterday',
    text: 'Impeccable service and an incredible selection. The ventilation system here is world-class, keeping the air fresh even during peak hours.',
    categoryRatings: [
      { label: 'Atmosphere', score: 5.0 },
      { label: 'Humidor', score: 4.8 },
      { label: 'Ventilation', score: 5.0 },
    ],
    photoUris: [whiskeyBars[0], cigarDetails[0]],
    likeCount: 24,
    commentCount: 3,
  },
  {
    id: 'marcus-sterling-review',
    authorName: 'Marcus Sterling',
    memberTier: 'Aficionado',
    avatarUri: loungeInteriors[0],
    rating: 4,
    timeAgo: '3 days ago',
    text: "The humidor is actually insane. Found some rare vintage Opus X here that I haven't seen in London for years. Atmosphere is quite formal, which fits the Mayfair vibe perfectly.",
    categoryRatings: [
      { label: 'Humidor', score: 5.0 },
      { label: 'Atmosphere', score: 4.5 },
    ],
    photoUris: [],
    likeCount: 12,
    commentCount: 0,
    ownerResponse: {
      authorName: 'Response from the Owner',
      text: "Thank you Marcus! We take great pride in our curation. We're glad you enjoyed the Opus X.",
    },
  },
  {
    id: 'evelyn-hart-review',
    authorName: 'Evelyn Hart',
    memberTier: 'Founding Member',
    avatarUri: whiskeyBars[1],
    rating: 5,
    timeAgo: '1 week ago',
    text: 'A true sanctuary. The staff remembered my usual order from my last visit six months ago — that level of care is rare these days.',
    categoryRatings: [
      { label: 'Service', score: 5.0 },
      { label: 'Comfort', score: 5.0 },
      { label: 'Staff Knowledge', score: 4.9 },
    ],
    photoUris: [],
    likeCount: 31,
    commentCount: 5,
  },
];

export const detailedRatingCategories = [
  'Atmosphere',
  'Humidor Selection',
  'Staff Knowledge',
  'Service',
  'Ventilation',
  'Comfort',
  'Whiskey Selection',
  'Luxury Experience',
];
