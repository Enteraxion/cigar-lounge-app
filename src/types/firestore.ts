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
   * Set once an admin approves a pending claim (see
   * src/services/ownerService.ts's approveLoungeClaim) — `ownerId` gates
   * edit access in updateLoungeDetails and is the sole source of truth
   * for "who owns this listing." Submitting a claim inquiry alone does
   * NOT set this (there is no in-app payment — see ClaimListingScreen's
   * header comment); it only creates a `claimStatus: 'pending'` claim for
   * a human to review (see claimStatus below) while sales follows up
   * separately.
   *
   * Removable, not permanent: ownerService.revokeLoungeOwnership clears it
   * (along with every other claim field) when a subscription lapses or a
   * claim turns out to have been fraudulent, returning the lounge to
   * claimable. Anything that decides what an owner may do should read this
   * field rather than caching the answer.
   */
  ownerId?: string;
  ownerName?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  claimedAt?: Timestamp;
  /**
   * Present only while a claim is awaiting manual admin review (see
   * src/screens/AdminClaimReviewScreen.tsx) — blocks new claims on this
   * lounge while set. Absent once resolved either way: approving clears
   * it (leaving `ownerId` as the sole marker of ownership); rejecting
   * clears it along with `ownerName`/`claimantUserId`/etc, since there's
   * no claim-history collection to preserve a rejected attempt in — the
   * lounge just becomes claimable again.
   */
  claimStatus?: 'pending';
  /** uid of the member whose paid claim is pending review — distinct from
   * `ownerId`, which is only set once that claim is approved. */
  claimantUserId?: string;
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
// lounges/{loungeId}/events/{eventId}
// ---------------------------------------------------------------------------

/**
 * A one-off event a shop is hosting — cigar night, tasting, launch party.
 * Owner-authored from the Owner Portal's Events page; Julian Brinkley's
 * ask in the 2026-08-05 meeting was simply that shops "can basically post
 * events", with no further definition, so this is a deliberately small
 * first shape for him to react to rather than a guess at something
 * elaborate: no ticketing, no RSVP, no recurrence.
 *
 * A subcollection rather than an inline array (unlike humidorItems) since
 * events accumulate over time and are queried by date, where inventory is
 * a short list always read whole with the lounge.
 */
export type EventDocument = {
  title: string;
  description: string;
  /** When the event starts — what upcoming/past is decided on. */
  startsAt: Timestamp;
  /** Optional; owners can also just put timing detail in the description. */
  endsAt?: Timestamp;
  imageUrl?: string;
  createdAt: Timestamp;
};

// ---------------------------------------------------------------------------
// lounges/{loungeId}/reservations/{reservationId}
// ---------------------------------------------------------------------------

/**
 * A "Reserve a Table" booking — a lounge-scoped subcollection, same
 * pattern as reviews above, rather than a top-level collection (this
 * schema has no top-level collections anywhere). `date` + `timeSlot` are
 * kept separate (a calendar day plus a fixed slot label like "7:00 PM")
 * rather than combined into one Timestamp, since ReserveTableScreen picks
 * them independently and slots are a fixed list, not free-form time
 * entry — see that screen for why (LoungeDocument's `hours` is
 * unstructured free text, so there's no real open/close data to validate
 * a time against). No availability/capacity checking exists yet — this
 * only records the request; there's no owner-facing view of reservations
 * to conflict against yet either.
 */
export type ReservationDocument = {
  userId: string;
  guestName: string;
  contactPhone: string;
  partySize: number;
  /** Calendar day for the reservation, midnight local time. */
  date: Timestamp;
  /** Fixed slot label, e.g. "7:00 PM" — see ReserveTableScreen's SLOTS. */
  timeSlot: string;
  notes?: string;
  createdAt: Timestamp;
  /**
   * Set when the lounge's owner marks the reservation as seen from the
   * Owner Portal — Julian Brinkley's ask in the 2026-08-05 meeting: shops
   * should be able to "indicate that they recognize when somebody has
   * reserved a table." Absent means nobody at the lounge has confirmed
   * seeing it yet; this is an acknowledgement, not an approval — there's
   * no reject/capacity flow (see reservationService.ts).
   */
  acknowledgedAt?: Timestamp;
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

export type AiExperienceMode = 'business' | 'vacation';

/**
 * Concierge personalisation. Stored on the user document rather than in a
 * new collection because it is a handful of scalars always read with the
 * profile — and because these values are *sent to the model* on every
 * concierge request, so they must load with the member, not after them.
 */
export type AiPreferences = {
  experienceMode: AiExperienceMode;
  maxTravelDistanceMiles: number;
  atmospheres: string[];
  /** Brands the member smokes — from src/data/cigarBrands.ts. */
  cigarBrands: string[];
  /** What they drink alongside — from src/data/drinks.ts. */
  drinks: string[];
};

export type UserDocument = {
  /** Absent for members who have never opened AI Settings. */
  aiPreferences?: AiPreferences;
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
// users/{userId}/savedFilters/{filterId}
// ---------------------------------------------------------------------------

/**
 * Mirrors src/utils/loungeSearch.ts's `SearchFilters` shape (duplicated
 * rather than imported, same reasoning as the rest of this file being
 * self-contained) — a snapshot of FilterBottomSheet's draft state at the
 * moment the member saved it, re-applied verbatim when they pick this
 * preset again.
 */
export type SavedFilterCriteria = {
  distanceMiles: number;
  nearCurrentLocation: boolean;
  cityQuery: string;
  availability: string[];
  atmosphere: string[];
  amenities: string[];
  entertainment: string[];
};

export type SavedFilterDocument = {
  name: string;
  criteria: SavedFilterCriteria;
  createdAt: Timestamp;
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
/**
 * `claim_approved` / `claim_rejected` are the only types written by an admin
 * rather than by an ordinary member action, and firestore.rules restricts
 * them to admins for that reason — a member able to write "your business has
 * been approved" into someone else's notifications is a convincing scam.
 * Keep this union and the rules' allow-list in sync.
 */
export type NotificationType =
  | 'review_helpful'
  | 'new_review_on_favorite'
  | 'claim_approved'
  | 'claim_rejected'
  | 'ownership_revoked';

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

// ---------------------------------------------------------------------------
// users/{userId}/issueReports/{reportId}
// ---------------------------------------------------------------------------

/**
 * Free-text problem reports from ReportIssueModal (currently only reachable
 * from AIFeedbackScreen's "Report Issues" action, about an AI
 * recommendation). Kept per-user rather than a top-level collection, same
 * reasoning as the rest of this schema — there's no admin-facing reports
 * inbox yet to read these back out; this just stops the report from being
 * silently discarded.
 */
export type IssueReportDocument = {
  description: string;
  createdAt: Timestamp;
};

// ---------------------------------------------------------------------------
// users/{userId}/conversations/{conversationId}
// ---------------------------------------------------------------------------

/**
 * A saved AI Concierge conversation.
 *
 * Saved Conversations was a screen listing three invented chats ("New York
 * Trip Planning", "Padrón vs Davidoff Selection") that no member had ever
 * had. Persisting the real thing is what makes the screen honest — and it
 * makes the Concierge itself materially more useful, since a chat is
 * otherwise lost the moment the screen unmounts.
 *
 * `messages` is stored inline rather than as a subcollection: a concierge
 * conversation is short, always read whole, and never queried across.
 */
export type ConversationTurn = {
  role: 'user' | 'assistant';
  text: string;
  /** Lounge ids the concierge recommended on this turn, if any. */
  loungeIds?: string[];
};

export type ConversationDocument = {
  /** First user message, trimmed — the list needs a human-readable handle. */
  title: string;
  /** Latest assistant reply, trimmed, for the list preview. */
  summary: string;
  messages: ConversationTurn[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ---------------------------------------------------------------------------
// users/{userId}/aiFeedback/{feedbackId}
// ---------------------------------------------------------------------------

/**
 * A thumbs-up/down on a concierge recommendation, plus why.
 *
 * AIFeedbackScreen previously collected this and threw it away — the submit
 * button showed a success message and wrote nothing. Persisting it is the
 * minimum bar for asking someone to rate something.
 */
export type AiFeedbackDocument = {
  loungeId: string | null;
  loungeName: string;
  helpful: boolean;
  /** Chosen improvement reasons, only meaningful when helpful is false. */
  reasons: string[];
  note: string;
  createdAt: Timestamp;
};

