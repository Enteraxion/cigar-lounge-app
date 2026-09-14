/**
 * Reporting a review, and blocking the member who wrote it.
 *
 * The two halves of App Store guideline 1.2 that need a server. Reporting
 * sends it to somebody; blocking is immediate and personal — the member who
 * blocks stops seeing that person's reviews straight away, whatever anyone
 * decides about the report later. Those are different promises and it matters
 * that the second one does not wait on the first.
 *
 * Reports go to a top-level `reviewReports` collection rather than under the
 * review, so the admin portal can read the queue in one query. Firestore rules
 * let any signed-in member create one and nobody but an admin read them — a
 * report names the person who made it, and a queue the reported member could
 * read is a queue nobody would use twice.
 */

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  setDoc,
  Timestamp,
} from '@react-native-firebase/firestore';
import type { ReportReason } from '../utils/moderation';

const db = getFirestore();

/**
 * Files a report. Deliberately fire-and-forget from the member's point of
 * view: they are told it has been sent, not what will happen, because we
 * cannot promise a particular outcome and should not pretend to.
 */
export async function reportReview(params: {
  reporterId: string;
  loungeId: string;
  reviewId: string;
  reviewAuthorId: string;
  reviewAuthorName: string;
  reviewText: string;
  reason: ReportReason;
}): Promise<void> {
  await addDoc(collection(db, 'reviewReports'), {
    ...params,
    // A copy of the text as reported. The author can edit or delete their
    // review, and a queue of reports pointing at content that has since
    // changed is unreviewable.
    reportedAt: Timestamp.now(),
    status: 'open',
  });
}

/**
 * Everyone this member has blocked, with the name as it was at the time.
 *
 * The name is stored on the block rather than looked up: a member can only
 * read their own user document, so there is no way to resolve a stranger's
 * name later, and "Blocked member" in a settings list is not something anyone
 * can act on.
 */
export async function getBlockedMembers(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'blockedUsers'));
    return snapshot.docs.map(d => ({
      id: d.id,
      name: (d.data().name as string | undefined) ?? 'Blocked member',
    }));
  } catch {
    return [];
  }
}

/** Everyone this member has blocked. Ids only — that is all the filter needs. */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'blockedUsers'));
    return new Set(snapshot.docs.map(d => d.id));
  } catch {
    // A failed read must not hide every review in the app. Showing content a
    // member meant to block is bad; showing them nothing at all is worse.
    return new Set();
  }
}

/**
 * Blocks a member. Their reviews disappear from this member's view everywhere
 * the block list is consulted.
 *
 * One-directional on purpose: this is "I do not want to read this person",
 * not a mutual severing, and the app has no messaging for the stronger sense
 * to apply to.
 */
export async function blockMember(
  userId: string,
  blockedUserId: string,
  blockedUserName: string,
): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'blockedUsers', blockedUserId), {
    name: blockedUserName,
    blockedAt: Timestamp.now(),
  });
}

export async function unblockMember(userId: string, blockedUserId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'blockedUsers', blockedUserId));
}
