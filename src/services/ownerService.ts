/**
 * ownerService
 *
 * "Claim your listing" — lets a signed-in member claim an unclaimed
 * lounge (asserting they're the real owner) and then edit that lounge's
 * own details. There is no in-app payment (per Julian Brinkley's
 * direction, 2026-08-10) — submitting a claim is a sales inquiry (see
 * ClaimListingScreen.tsx and functions/src/index.ts's
 * sendClaimInquiryEmail), not a purchase, so submitLoungeClaim doesn't
 * grant ownership directly. It puts the lounge into `claimStatus:
 * 'pending'` for a human admin to review (see AdminClaimReviewScreen.tsx);
 * only approveLoungeClaim sets `ownerId`. Ownership itself is tracked
 * directly on the lounge doc rather than a separate claims collection,
 * since it's a simple 1:1 relationship with no claim history/dispute
 * flow to model.
 *
 * The checks in this file (checking `ownerId`/`claimStatus` before
 * writing) are UX guards, not the real security boundary — firestore.rules
 * enforces all of this again server-side (isClaimSubmission/
 * isOwnListingEdit/isAdmin), so a modified client can't write around it.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteField,
  Timestamp,
} from '@react-native-firebase/firestore';
import type { LoungeDocument } from '../types/firestore';
import type { Lounge } from './loungeService';
import { createNotification } from './userActionsService';
import { OWNER_PORTAL_URL } from '../config/ownerPortal';
import { mergeOwnedLounges, type OwnedLounge } from '../utils/ownedLounges';

const db = getFirestore();

export type ClaimListingInput = {
  ownerName: string;
  ownerContactEmail: string;
  ownerContactPhone: string;
};

/**
 * Submits a claim inquiry on `loungeId` from `userId` for admin review —
 * this function does NOT grant ownership; it sets `claimStatus: 'pending'`
 * so an admin can approve or reject it (see
 * approveLoungeClaim/rejectLoungeClaim). ClaimListingScreen separately
 * emails sales about the inquiry (functions/src/index.ts's
 * sendClaimInquiryEmail) — that's independent of this Firestore write.
 * Throws if the lounge doesn't exist, is already owned by someone else,
 * or already has another claim pending — callers should catch and show
 * that as a real error, not retry.
 */
export async function submitLoungeClaim(
  loungeId: string,
  userId: string,
  input: ClaimListingInput,
): Promise<void> {
  const loungeRef = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(loungeRef);
  if (!snapshot.exists()) {
    throw new Error('This lounge no longer exists.');
  }
  const lounge = snapshot.data() as LoungeDocument;
  if (lounge.ownerId && lounge.ownerId !== userId) {
    throw new Error('This listing has already been claimed by someone else.');
  }
  if (lounge.claimStatus === 'pending' && lounge.claimantUserId !== userId) {
    throw new Error('Someone else\'s claim on this listing is already under review.');
  }

  await updateDoc(loungeRef, {
    claimStatus: 'pending',
    claimantUserId: userId,
    ownerName: input.ownerName.trim(),
    ownerContactEmail: input.ownerContactEmail.trim(),
    ownerContactPhone: input.ownerContactPhone.trim(),
    claimedAt: Timestamp.now(),
  });
}

export type PendingClaim = LoungeDocument & { id: string };

/** Every lounge with a claim currently awaiting admin review — see AdminClaimReviewScreen.tsx. */
export async function getPendingClaims(): Promise<PendingClaim[]> {
  const pendingQuery = query(collection(db, 'lounges'), where('claimStatus', '==', 'pending'));
  const snapshot = await getDocs(pendingQuery);
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as LoungeDocument) }));
}

/**
 * Approves the pending claim on `loungeId`, granting ownership to its
 * claimant and telling them so.
 *
 * The notification is the point of the whole flow from the claimant's side.
 * Before this existed, approval was silent: the member filled in a claim
 * form, saw an "under review" screen, and then nothing ever happened in the
 * app — the only observable change was a `ownerId` field they couldn't see.
 * They had no way to know they could now edit their listing.
 *
 * Ordered deliberately: ownership is granted first and the notification sent
 * second, so a failed notification cannot leave a lounge unapproved. If the
 * notification write fails the approval still stands, which is the right way
 * round — being told late beats being approved never.
 */
export async function approveLoungeClaim(loungeId: string): Promise<void> {
  const loungeRef = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(loungeRef);
  if (!snapshot.exists()) {
    throw new Error('This lounge no longer exists.');
  }
  const lounge = snapshot.data() as LoungeDocument;
  if (!lounge.claimantUserId) {
    throw new Error('This lounge has no pending claim to approve.');
  }
  const claimantUserId = lounge.claimantUserId;

  await updateDoc(loungeRef, {
    ownerId: claimantUserId,
    claimStatus: deleteField(),
  });

  await notifyClaimant(claimantUserId, {
    type: 'claim_approved',
    title: 'Your business has been approved',
    body:
      `You're now the verified owner of ${lounge.name}. You can edit your ` +
      'listing from My Shops in your profile, or manage events, inventory ' +
      `and reservations at ${OWNER_PORTAL_URL}`,
    data: { loungeId },
  });
}

/**
 * Rejects the pending claim on `loungeId`. Clears every claim-related
 * field so the lounge reverts to unclaimed and can be claimed again —
 * there's no claims history collection to preserve the rejected attempt
 * in (matches the rest of this file's no-history trust model).
 *
 * Notifies the claimant *before* clearing, because clearing is what destroys
 * the record of who to notify — and because a rejection is otherwise
 * completely invisible: `claimantUserId` is what the Owner Portal queries on,
 * so a rejected claim simply vanished from the claimant's dashboard with no
 * explanation anywhere.
 */
export async function rejectLoungeClaim(loungeId: string): Promise<void> {
  const loungeRef = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(loungeRef);
  const lounge = snapshot.exists() ? (snapshot.data() as LoungeDocument) : null;

  if (lounge?.claimantUserId) {
    await notifyClaimant(lounge.claimantUserId, {
      type: 'claim_rejected',
      title: 'Your business claim wasn’t approved',
      body:
        `We couldn't verify your claim on ${lounge.name}. If you own this ` +
        'lounge, you can submit a new claim with your business details, or ' +
        'reply to our team and we’ll help sort it out.',
      data: { loungeId },
    });
  }

  await updateDoc(loungeRef, {
    claimStatus: deleteField(),
    claimantUserId: deleteField(),
    ownerName: deleteField(),
    ownerContactEmail: deleteField(),
    ownerContactPhone: deleteField(),
    claimedAt: deleteField(),
  });
}

/**
 * Sends a claim decision, swallowing failures.
 *
 * A notification that doesn't send must not surface as "approval failed" to
 * the admin, who would then reasonably press Approve again on a lounge that
 * is already approved. The decision itself is the durable record; this is
 * how the member finds out about it.
 */
async function notifyClaimant(
  userId: string,
  notification: Parameters<typeof createNotification>[1],
): Promise<void> {
  try {
    await createNotification(userId, notification);
  } catch {
    // Intentionally ignored — see above.
  }
}

/**
 * Every lounge this member owns or has a claim pending on, for the My Shops
 * screen.
 *
 * Two queries rather than one because approval doesn't clear
 * `claimantUserId` (the Owner Portal relies on that too), so an approved
 * lounge matches both fields and a pending one matches only the second. The
 * merge that reconciles them is pure and tested — see
 * src/utils/ownedLounges.ts.
 */
export async function getLoungesForOwner(userId: string): Promise<OwnedLounge[]> {
  const [owned, claimed] = await Promise.all([
    getDocs(query(collection(db, 'lounges'), where('ownerId', '==', userId))),
    getDocs(query(collection(db, 'lounges'), where('claimantUserId', '==', userId))),
  ]);

  const lounges: Lounge[] = [...owned.docs, ...claimed.docs].map(document => ({
    id: document.id,
    ...(document.data() as LoungeDocument),
  }));

  return mergeOwnedLounges(lounges, userId);
}

export type LoungeDetailsInput = {
  description: string;
  hours: string;
  priceRange: string;
  amenities: string[];
};

/**
 * Updates the editable subset of a lounge's own details — only the
 * claimed owner can call this successfully. Throws if `userId` isn't
 * the lounge's `ownerId` (including an unclaimed lounge, where
 * `ownerId` is undefined).
 */
export async function updateLoungeDetails(
  loungeId: string,
  userId: string,
  input: LoungeDetailsInput,
): Promise<void> {
  const loungeRef = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(loungeRef);
  if (!snapshot.exists()) {
    throw new Error('This lounge no longer exists.');
  }
  if ((snapshot.data() as LoungeDocument).ownerId !== userId) {
    throw new Error('Only the business owner who claimed this listing can edit it.');
  }

  await updateDoc(loungeRef, {
    description: input.description.trim(),
    hours: input.hours.trim(),
    priceRange: input.priceRange.trim(),
    amenities: input.amenities,
    updatedAt: Timestamp.now(),
  });
}
