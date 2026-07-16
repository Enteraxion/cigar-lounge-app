/**
 * loungeService
 *
 * Firestore-backed data access for lounges + reviews, using
 * @react-native-firebase/firestore's modular API (same convention as
 * src/services/firebaseAuth.ts). Screens should go through these
 * functions rather than importing '@react-native-firebase/firestore'
 * directly, so query shape/collection names stay in one place.
 *
 * See src/types/firestore.ts for the document shapes and
 * scripts/seedFirestore.ts for how the `lounges` collection was
 * populated from the old mock data.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from '@react-native-firebase/firestore';
import type { LoungeDocument, ReviewDocument } from '../types/firestore';

const db = getFirestore();

export type Lounge = LoungeDocument & { id: string };
export type Review = ReviewDocument & { id: string };

/** Fetches every document in the `lounges` collection. */
export async function getAllLounges(): Promise<Lounge[]> {
  const snapshot = await getDocs(collection(db, 'lounges'));
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as LoungeDocument) }));
}

/** Fetches a single lounge by id, or null if it doesn't exist. */
export async function getLoungeById(id: string): Promise<Lounge | null> {
  const snapshot = await getDoc(doc(db, 'lounges', id));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as LoungeDocument) };
}

/**
 * Batch-fetches lounges by id (for favorites/collections screens, where
 * a user doc holds a list of lounge ids). Missing ids are silently
 * dropped rather than throwing, since a favorited/collected lounge could
 * have been removed since the reference was saved.
 *
 * Implemented as parallel getDoc calls rather than a single `where(
 * documentId(), 'in', ids)` query — simpler and has no 30-item cap,
 * which matters once collections/favorites grow past that.
 */
export async function getLoungesByIds(ids: string[]): Promise<Lounge[]> {
  const results = await Promise.all(ids.map(id => getLoungeById(id)));
  return results.filter((lounge): lounge is Lounge => lounge !== null);
}

/**
 * Basic client-side substring search across name, address, and tags.
 * Firestore has no native case-insensitive substring query, and at this
 * app's current scale (a few dozen lounges) fetching everything and
 * filtering in JS is simpler and cheaper than maintaining keyword-array
 * indexes for prefix queries. Revisit with a real search index (e.g.
 * Algolia/Typesense) if the lounge count grows large enough for this to
 * matter.
 *
 * A blank query means "browse all" (e.g. "View All" links and the Map
 * screen's List toggle land here with no query) rather than "match
 * nothing", so it returns every lounge unfiltered.
 */
export async function searchLounges(searchQuery: string): Promise<Lounge[]> {
  const needle = searchQuery.trim().toLowerCase();
  const lounges = await getAllLounges();
  if (!needle) {
    return lounges;
  }

  return lounges.filter(lounge => {
    const haystack = [lounge.name, lounge.address, ...lounge.tags].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

/** Fetches the `reviews` subcollection for a lounge, newest first. */
export async function getReviewsForLounge(loungeId: string): Promise<Review[]> {
  const reviewsQuery = query(
    collection(db, 'lounges', loungeId, 'reviews'),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(reviewsQuery);
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as ReviewDocument) }));
}
