/**
 * Firestore schema for The Reserve.
 *
 * This file is the single source of truth for document shapes across
 * both the app (once screens are wired to Firestore in a later phase)
 * and scripts/seedFirestore.ts. It has no runtime behavior — types only.
 *
 * Collections:
 *   lounges/{loungeId}
 *   lounges/{loungeId}/reviews/{reviewId}
 *   users/{userId}
 *   users/{userId}/favorites/{loungeId}
 *   users/{userId}/recentlyViewed/{loungeId}
 *   users/{userId}/searchHistory/{termSlug}
 *   users/{userId}/collections/{collectionId}
 *   users/{userId}/notifications/{notificationId}
 *
 * `Timestamp` below stands in for whichever SDK reads/writes the doc:
 * `firebase-admin`'s `Timestamp` from the seed script, or
 * `@react-native-firebase/firestore`'s `FirebaseFirestoreTypes.Timestamp`
 * once screens read this data — both are structurally compatible
 * (`{ seconds, nanoseconds }` + `toDate()`), so screen code can import its
 * own SDK's Timestamp type and these shapes still line up.
 */

export type Timestamp = {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
};

// ---------------------------------------------------------------------------
// lounges/{loungeId}
// ---------------------------------------------------------------------------

export type LoungeStatus = 'open' | 'closed';

export type LoungeCoordinates = {
  lat: number;
  lng: number;
};

/**
 * Every score is out of 5.0. `overall` is the single number shown as a
 * lounge's headline rating everywhere except the Ratings Breakdown /
 * Write Review screens, which surface the rest of these categories
 * individually.
 */
export type LoungeRatings = {
  overall: number;
  atmosphere: number;
  humidorVariety: number;
  service: number;
  comfort: number;
  ventilation: number;
  wifiSpeed: number;
  businessFriendly: number;
  foodDrinksQuality: number;
  socialScene: number;
  parking: number;
};

export type HumidorStockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export type HumidorItem = {
  name: string;
  image: string;
  strength: string;
  origin: string;
  price: string;
  stockStatus: HumidorStockStatus;
};

export type LoungeDocument = {
  name: string;
  description: string;
  address: string;
  coordinates: LoungeCoordinates;
  hours: string;
  status: LoungeStatus;
  images: string[];
  amenities: string[];
  tags: string[];
  priceRange: string;
  ratings: LoungeRatings;
  reviewCount: number;
  /**
   * Kept inline (not a subcollection) — humidor inventories in this app
   * are small (3-5 items) and always read/written as a whole with the
   * lounge doc, so a subcollection would just add read overhead for no
   * benefit at this scale.
   */
  humidorItems: HumidorItem[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /**
   * Denormalized mirror of which users currently have this lounge
   * favorited (kept in sync by toggleFavorite via arrayUnion/arrayRemove
   * in src/services/userActionsService.ts). Lets submitReview notify
   * everyone who favorited a lounge about a new review without a
   * collectionGroup query — see getUserStats's comment on the real pain
   * a missing composite index caused for that approach. Optional since
   * seeded/older lounge docs predate this field.
   */
  favoritedByUserIds?: string[];
  /**
   * "City, State"-style label, only populated by scripts/importYelpLounges.ts
   * (from Yelp's structured location.city/location.state fields) — powers
   * loungeService.getDistinctCities() for SearchSuggestionsScreen's Cities
   * list. Omitted on the hand-authored seedFirestore.ts demo lounges, whose
   * free-text `address` field (e.g. "City Center", "Near You") isn't
   * reliable to parse a real city out of.
   */
  city?: string;
  /**
   * Set once a business owner claims this listing (see
   * src/services/ownerService.ts's claimLounge) — auto-approved (no
   * manual review step exists yet), first claim wins. `ownerId` gates
   * edit access in updateLoungeDetails; presence of `ownerId` alone
   * means "claimed," regardless of whether contact fields are filled.
   */
  ownerId?: string;
  ownerName?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  claimedAt?: Timestamp;
};

// ---------------------------------------------------------------------------
// lounges/{loungeId}/reviews/{reviewId}
// ---------------------------------------------------------------------------

/**
 * Mirrors the categories on WriteReviewScreen (see
 * src/data/mockReviews.ts's detailedRatingCategories) — a subset of
 * LoungeRatings' keys, since not every lounge-level rating category is
 * something an individual reviewer scores per visit.
 */
export type ReviewCategoryRatings = Partial<{
  atmosphere: number;
  humidorVariety: number;
  service: number;
  comfort: number;
  ventilation: number;
  staffKnowledge: number;
  whiskeySelection: number;
  luxuryExperience: number;
}>;

export type OwnerResponse = {
  text: string;
  respondedAt: Timestamp;
};

export type ReviewDocument = {
  userId: string;
  userName: string;
  userAvatar: string;
  memberTier: string;
  rating: number;
  visitDate: Timestamp;
  wouldReturn: boolean;
  recommend: boolean;
  text: string;
  photos: string[];
  categoryRatings: ReviewCategoryRatings;
  helpfulCount: number;
  createdAt: Timestamp;
  ownerResponse?: OwnerResponse;
  /**
   * uids of members who've marked this review helpful — used both to
   * derive whether the current user has already voted (so the button can
   * show the right state) and to prevent double-counting `helpfulCount`
   * if toggleReviewHelpful is called twice for the same user.
   */
  helpfulUserIds?: string[];
};

// ---------------------------------------------------------------------------
// users/{userId}
// ---------------------------------------------------------------------------

export type UserStats = {
  loungesVisited: number;
  statesExplored: number;
  reviewsWritten: number;
  photosUploaded: number;
  favoritesSaved: number;
  checkIns: number;
  milesTraveled: number;
};

export type UserDocument = {
  name: string;
  email: string;
  avatarUrl: string;
  memberTier: string;
  homeCity: string;
  favoriteBrand: string;
  favoriteLounge: string;
  memberSince: Timestamp;
  /** Starts at all-zero for every new user; incremented by later phases
   * (check-in flow, review submission, favoriting, etc.) — never
   * hardcoded from mock data. */
  stats: UserStats;
};

// ---------------------------------------------------------------------------
// users/{userId}/favorites/{loungeId}
// ---------------------------------------------------------------------------

/**
 * Existence of the doc IS the favorite — no fields beyond the timestamp
 * are needed since the loungeId is already the doc's own id.
 */
export type FavoriteDocument = {
  addedAt: Timestamp;
};

// ---------------------------------------------------------------------------
// users/{userId}/recentlyViewed/{loungeId}
// ---------------------------------------------------------------------------

/**
 * Same shape/rationale as FavoriteDocument — existence of the doc IS the
 * view record, re-set (not re-created) on every visit so `viewedAt`
 * always reflects the most recent view. Powers SearchSuggestionsScreen's
 * Recently Visited list.
 */
export type RecentlyViewedDocument = {
  viewedAt: Timestamp;
};

// ---------------------------------------------------------------------------
// users/{userId}/searchHistory/{termSlug}
// ---------------------------------------------------------------------------

/**
 * Powers SearchScreen's Recent Searches list. Doc id is a slug of `term`
 * (see userActionsService.recordSearch) so re-running the same search
 * bumps `searchedAt` instead of creating duplicate history entries.
 */
export type SearchHistoryDocument = {
  term: string;
  searchedAt: Timestamp;
};

// ---------------------------------------------------------------------------
// users/{userId}/collections/{collectionId}
// ---------------------------------------------------------------------------

export type CollectionDocument = {
  name: string;
  description: string;
  coverImage: string;
  category: string;
  isPrivate: boolean;
  loungeIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Optional — whether the owning user has favorited this collection itself
   * (distinct from the lounges inside it). Not present on older docs. */
  isFavorited?: boolean;
};

// ---------------------------------------------------------------------------
// users/{userId}/notifications/{notificationId}
// ---------------------------------------------------------------------------

/**
 * In-app-only notifications (no push/FCM wiring — see NotificationsScreen).
 * `review_helpful` fires when someone marks a review you wrote as helpful;
 * `new_review_on_favorite` fires when someone reviews a lounge you've
 * favorited. Both are generated by real user actions in
 * userActionsService.ts (toggleReviewHelpful / submitReview), never by a
 * background job.
 */
export type NotificationType = 'review_helpful' | 'new_review_on_favorite';

export type NotificationDocument = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
  /** Deep-link target — which lounge/review this notification is about, for
   * navigating back to it from NotificationsScreen. */
  data?: {
    loungeId?: string;
    reviewId?: string;
  };
};
