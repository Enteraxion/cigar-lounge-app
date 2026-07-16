/**
 * userActionsService
 *
 * Firestore writes/mutations scoped to the signed-in member: favorites,
 * collections, and reviews. Every write here takes a `userId` supplied by
 * the caller — callers must pass `auth.currentUser.uid` (see
 * src/services/firebaseAuth.ts), never the `demo-alexander-rossi` seed
 * user from scripts/seedFirestore.ts. That demo user only exists so the
 * app has something to browse before anyone signs up; it doesn't
 * represent "the logged in person."
 *
 * Same modular-API convention as loungeService.ts — see that file and
 * src/types/firestore.ts for the schema/collection layout.
 */

import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
} from '@react-native-firebase/firestore';
import type {
  CollectionDocument,
  FavoriteDocument,
  LoungeDocument,
  NotificationDocument,
  ReviewCategoryRatings,
  ReviewDocument,
  UserDocument,
} from '../types/firestore';
import { getLoungesByIds, type Lounge } from './loungeService';

const db = getFirestore();

// ---------------------------------------------------------------------------
// Favorites — users/{userId}/favorites/{loungeId}
// ---------------------------------------------------------------------------

/** Checks whether `loungeId` is already favorited by `userId`. */
export async function isFavorited(userId: string, loungeId: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, 'users', userId, 'favorites', loungeId));
  return snapshot.exists();
}

/**
 * Adds the favorite doc if it doesn't exist, removes it if it does.
 * Returns the new favorited state (true = now favorited) so callers can
 * reconcile an optimistic UI update without a second read.
 *
 * Also mirrors `userId` into the lounge doc's own `favoritedByUserIds`
 * array (arrayUnion on favorite, arrayRemove on unfavorite) so
 * submitReview can notify everyone who's favorited a lounge about a new
 * review without a collectionGroup query — see LoungeDocument's comment
 * on favoritedByUserIds in src/types/firestore.ts.
 */
export async function toggleFavorite(userId: string, loungeId: string): Promise<boolean> {
  const ref = doc(db, 'users', userId, 'favorites', loungeId);
  const loungeRef = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    await deleteDoc(ref);
    await updateDoc(loungeRef, { favoritedByUserIds: arrayRemove(userId) });
    return false;
  }
  const favorite: FavoriteDocument = { addedAt: Timestamp.now() };
  await setDoc(ref, favorite);
  await updateDoc(loungeRef, { favoritedByUserIds: arrayUnion(userId) });
  return true;
}

/** Fetches every lounge `userId` has favorited (real Lounge records, not just ids). */
export async function getUserFavorites(userId: string): Promise<Lounge[]> {
  return getLoungesByIds(await getUserFavoriteIds(userId));
}

/**
 * Fetches just the favorited lounge ids, without batch-fetching full
 * lounge docs — for seeding heart-icon state across a list of lounges
 * that's already loaded (Home, Search Results), where re-fetching the
 * full Lounge record per favorite would be wasted work.
 */
export async function getUserFavoriteIds(userId: string): Promise<string[]> {
  const snapshot = await getDocs(collection(db, 'users', userId, 'favorites'));
  return snapshot.docs.map(d => d.id);
}

// ---------------------------------------------------------------------------
// Reviews — lounges/{loungeId}/reviews/{reviewId}
// ---------------------------------------------------------------------------

export type SubmitReviewInput = {
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  categoryRatings: ReviewCategoryRatings;
  wouldReturn: boolean;
  recommend: boolean;
  photos: string[];
  visitDate: Date;
};

/**
 * Adds a new review doc under the lounge, returning the new review's id.
 *
 * Also notifies everyone who's favorited this lounge (via the lounge
 * doc's denormalized `favoritedByUserIds`, kept in sync by
 * toggleFavorite) that a new review was posted — except the reviewer
 * themselves. Best-effort: a notification failure here shouldn't fail
 * the review submission the user is actually waiting on, so errors are
 * swallowed after the review write has already succeeded.
 */
export async function submitReview(loungeId: string, review: SubmitReviewInput): Promise<string> {
  const data: ReviewDocument = {
    userId: review.userId,
    userName: review.userName,
    userAvatar: review.userAvatar,
    // No membership-tier system exists yet for real (non-seed) users —
    // 'Member' is a generic placeholder, not a fabricated tier.
    memberTier: 'Member',
    rating: review.rating,
    visitDate: Timestamp.fromDate(review.visitDate),
    wouldReturn: review.wouldReturn,
    recommend: review.recommend,
    text: review.text,
    photos: review.photos,
    categoryRatings: review.categoryRatings,
    helpfulCount: 0,
    createdAt: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, 'lounges', loungeId, 'reviews'), data);

  try {
    const loungeSnapshot = await getDoc(doc(db, 'lounges', loungeId));
    const lounge = loungeSnapshot.data() as LoungeDocument | undefined;
    const favoriters = (lounge?.favoritedByUserIds ?? []).filter(id => id !== review.userId);
    await Promise.all(
      favoriters.map(favoriterId =>
        createNotification(favoriterId, {
          type: 'new_review_on_favorite',
          title: 'New review on a lounge you favorited',
          body: lounge?.name
            ? `${review.userName} just reviewed ${lounge.name}.`
            : `${review.userName} just posted a new review.`,
          data: { loungeId, reviewId: ref.id },
        }),
      ),
    );
  } catch {
    // Notifications are best-effort — the review itself already saved.
  }

  return ref.id;
}

/**
 * Updates the editable fields of an existing review. Only the fields
 * present on `data` are written (via `updateDoc`, matching the partial-
 * update style already used elsewhere in this file, e.g.
 * toggleReviewHelpful) — author identity fields (`userId`, `userName`,
 * `userAvatar`, `memberTier`) are intentionally not editable here, since
 * a review edit changes what was said, not who said it.
 */
export async function updateReview(
  loungeId: string,
  reviewId: string,
  data: Partial<SubmitReviewInput>,
): Promise<void> {
  const updates: Partial<ReviewDocument> = {};
  if (data.rating !== undefined) updates.rating = data.rating;
  if (data.text !== undefined) updates.text = data.text;
  if (data.categoryRatings !== undefined) updates.categoryRatings = data.categoryRatings;
  if (data.wouldReturn !== undefined) updates.wouldReturn = data.wouldReturn;
  if (data.recommend !== undefined) updates.recommend = data.recommend;
  if (data.photos !== undefined) updates.photos = data.photos;
  if (data.visitDate !== undefined) updates.visitDate = Timestamp.fromDate(data.visitDate);
  await updateDoc(doc(db, 'lounges', loungeId, 'reviews', reviewId), updates);
}

/** Deletes a review doc outright — no soft-delete/undo, matching toggleFavorite's style of direct deleteDoc calls elsewhere in this file. */
export async function deleteReview(loungeId: string, reviewId: string): Promise<void> {
  await deleteDoc(doc(db, 'lounges', loungeId, 'reviews', reviewId));
}

/**
 * Toggles whether `userId` has marked a review helpful, keeping
 * `helpfulUserIds` and the denormalized `helpfulCount` in sync in a
 * single update. Reads the doc first so we know which way to toggle —
 * `arrayUnion`/`arrayRemove` alone would let a double-tap from two
 * in-flight calls double-count, so the increment direction is derived
 * from the current membership check rather than assumed by the caller.
 *
 * When a review is freshly marked helpful (not un-marked) by someone
 * other than its own author, also notifies that author — best-effort,
 * same reasoning as submitReview's notification step below.
 */
export async function toggleReviewHelpful(
  loungeId: string,
  reviewId: string,
  userId: string,
): Promise<void> {
  const ref = doc(db, 'lounges', loungeId, 'reviews', reviewId);
  const snapshot = await getDoc(ref);
  const review = snapshot.data() as ReviewDocument | undefined;
  const alreadyMarked = review?.helpfulUserIds?.includes(userId) ?? false;

  if (alreadyMarked) {
    await updateDoc(ref, {
      helpfulUserIds: arrayRemove(userId),
      helpfulCount: increment(-1),
    });
    return;
  }

  await updateDoc(ref, {
    helpfulUserIds: arrayUnion(userId),
    helpfulCount: increment(1),
  });

  if (review && review.userId !== userId) {
    try {
      await createNotification(review.userId, {
        type: 'review_helpful',
        title: 'Your review got a helpful vote',
        body: 'Someone marked your review as helpful.',
        data: { loungeId, reviewId },
      });
    } catch {
      // Notifications are best-effort — the helpful vote itself already saved.
    }
  }
}

// ---------------------------------------------------------------------------
// Collections — users/{userId}/collections/{collectionId}
// ---------------------------------------------------------------------------

export type UserCollection = CollectionDocument & { id: string };

export type CreateCollectionInput = {
  name: string;
  description: string;
  coverImage: string;
  category: string;
  isPrivate: boolean;
};

/** Creates a new collection doc, returning its new id. Starts with no lounges. */
export async function createCollection(
  userId: string,
  input: CreateCollectionInput,
): Promise<string> {
  const now = Timestamp.now();
  const data: CollectionDocument = {
    name: input.name,
    description: input.description,
    coverImage: input.coverImage,
    category: input.category,
    isPrivate: input.isPrivate,
    loungeIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, 'users', userId, 'collections'), data);
  return ref.id;
}

/** Adds `loungeId` to a collection's loungeIds array (arrayUnion — safe to call if already present). */
export async function addLoungeToCollection(
  userId: string,
  collectionId: string,
  loungeId: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'collections', collectionId), {
    loungeIds: arrayUnion(loungeId),
    updatedAt: Timestamp.now(),
  });
}

/** Fetches every collection `userId` has created. */
export async function getUserCollections(userId: string): Promise<UserCollection[]> {
  const snapshot = await getDocs(collection(db, 'users', userId, 'collections'));
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as CollectionDocument) }));
}

/** Fetches a single collection by id, or null if it doesn't exist (e.g. CollectionDetailScreen). */
export async function getUserCollection(
  userId: string,
  collectionId: string,
): Promise<UserCollection | null> {
  const snapshot = await getDoc(doc(db, 'users', userId, 'collections', collectionId));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as CollectionDocument) };
}

/**
 * Flips a collection's `isFavorited` flag (favoriting the collection
 * itself, not the lounges inside it) and writes it back with
 * `merge: true`. Returns the new value so callers can reconcile an
 * optimistic UI update without a second read.
 */
export async function toggleCollectionFavorite(
  userId: string,
  collectionId: string,
): Promise<boolean> {
  const ref = doc(db, 'users', userId, 'collections', collectionId);
  const snapshot = await getDoc(ref);
  const current = (snapshot.data() as CollectionDocument | undefined)?.isFavorited ?? false;
  const next = !current;
  await setDoc(ref, { isFavorited: next }, { merge: true });
  return next;
}

// ---------------------------------------------------------------------------
// Passport / Profile stats — computed client-side from data we already
// read elsewhere, rather than a Cloud Functions aggregation (out of scope
// for now). See PassportScreen/ProfileScreen for which of these actually
// have a real data source vs. still show a "Coming Soon" placeholder —
// there's no check-in/travel-history feature yet, so loungesVisited,
// statesExplored, checkIns, and milesTraveled aren't computed here at
// all rather than being backed by a guessed/fake number.
// ---------------------------------------------------------------------------

export type UserStats = {
  reviewsWritten: number;
  favoritesSaved: number;
  photosUploaded: number;
  collectionsCount: number;
};

/**
 * reviewsWritten/photosUploaded require finding every review this user
 * wrote across ALL lounges — a Firestore collectionGroup query on
 * `reviews` filtered by `userId` is the simplest correct way to do that
 * without maintaining a denormalized counter on the user doc.
 *
 * NOTE: this requires a Firestore index for the `reviews` collection
 * group on the `userId` field. If it's missing, this query throws
 * `failed-precondition` with a direct link (in the error message) to
 * create it in the Firebase console — that's a one-time setup step, not
 * a bug.
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const [reviewsSnapshot, favoriteIds, collections] = await Promise.all([
    getDocs(query(collectionGroup(db, 'reviews'), where('userId', '==', userId))),
    getUserFavoriteIds(userId),
    getUserCollections(userId),
  ]);

  const photosUploaded = reviewsSnapshot.docs.reduce((sum, d) => {
    const review = d.data() as ReviewDocument;
    return sum + (review.photos?.length ?? 0);
  }, 0);

  return {
    reviewsWritten: reviewsSnapshot.size,
    favoritesSaved: favoriteIds.length,
    photosUploaded,
    collectionsCount: collections.length,
  };
}

// ---------------------------------------------------------------------------
// User profile — users/{userId}
// ---------------------------------------------------------------------------

/**
 * Fetches the user's profile doc, or null if it doesn't exist yet — real
 * signed-up users don't get one created at sign-up time (only the
 * demo-alexander-rossi seed user has a full doc), so callers need to
 * handle null explicitly rather than assuming every field is populated.
 */
export async function getUserProfile(userId: string): Promise<Partial<UserDocument> | null> {
  const snapshot = await getDoc(doc(db, 'users', userId));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data() as Partial<UserDocument>;
}

/**
 * Writes profile fields to the user doc with `merge: true`, so this
 * works identically whether the doc already exists (demo user, or a
 * real user who's edited their profile before) or is being created for
 * the first time (every other real user).
 */
export async function updateUserProfile(
  userId: string,
  data: Partial<UserDocument>,
): Promise<void> {
  await setDoc(doc(db, 'users', userId), data, { merge: true });
}

// ---------------------------------------------------------------------------
// Notifications — users/{userId}/notifications/{notificationId}
//
// In-app only (see src/screens/NotificationsScreen.tsx) — no push/FCM
// wiring here. Generated by real actions elsewhere in this file
// (toggleReviewHelpful, submitReview), always for the OTHER user
// involved, never for the user who performed the action.
// ---------------------------------------------------------------------------

/** Creates a new notification doc for `userId`, defaulting `read` to false and `createdAt` to now. */
export async function createNotification(
  userId: string,
  notification: Omit<NotificationDocument, 'id' | 'read' | 'createdAt'>,
): Promise<void> {
  const data: Omit<NotificationDocument, 'id'> = {
    ...notification,
    read: false,
    createdAt: Timestamp.now(),
  };
  await addDoc(collection(db, 'users', userId, 'notifications'), data);
}

/** Fetches every notification for `userId`, newest first. */
export async function getUserNotifications(userId: string): Promise<NotificationDocument[]> {
  const snapshot = await getDocs(
    query(collection(db, 'users', userId, 'notifications'), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<NotificationDocument, 'id'>) }));
}

/** Marks a single notification as read. */
export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), { read: true });
}

/**
 * Marks every currently-unread notification as read. This list is always
 * small (in-app notifications only, no push backlog), so a loop of
 * individual updateDoc calls is simple and sufficiently fast — not worth
 * a writeBatch for the volumes this feature deals with.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snapshot = await getDocs(
    query(collection(db, 'users', userId, 'notifications'), where('read', '==', false)),
  );
  await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { read: true })));
}
