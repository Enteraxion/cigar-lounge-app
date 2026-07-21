/**
 * ownerService
 *
 * "Claim your listing" — lets a signed-in member claim an unclaimed
 * lounge (asserting they're the real owner) and then edit that lounge's
 * own details. Auto-approved: there's no manual review step or business
 * verification (e.g. a confirmation email/document check) yet, first
 * claim on a given lounge wins. Ownership itself is tracked directly on
 * the lounge doc (`ownerId` — see src/types/firestore.ts) rather than a
 * separate claims collection, since it's a simple 1:1 relationship with
 * no claim history/dispute flow to model.
 *
 * Enforcement here is client-side only (checking `ownerId` before
 * writing) — there's no firestore.rules file in this repo yet, so
 * nothing stops a modified client from writing around this. Same trust
 * model the rest of the app's Firestore writes already use; flagging it
 * here since ownership is a slightly higher-stakes case than favorites/
 * reviews.
 */

import { getFirestore, doc, getDoc, updateDoc, Timestamp } from '@react-native-firebase/firestore';
import type { LoungeDocument } from '../types/firestore';

const db = getFirestore();

export type ClaimListingInput = {
  ownerName: string;
  ownerContactEmail: string;
  ownerContactPhone: string;
};

/**
 * Claims `loungeId` for `userId`. Throws if the lounge doesn't exist or
 * is already claimed by someone else — callers should catch and show
 * that as a real error, not retry.
 */
export async function claimLounge(
  loungeId: string,
  userId: string,
  input: ClaimListingInput,
): Promise<void> {
  const loungeRef = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(loungeRef);
  if (!snapshot.exists()) {
    throw new Error('This lounge no longer exists.');
  }
  const existingOwnerId = (snapshot.data() as LoungeDocument).ownerId;
  if (existingOwnerId && existingOwnerId !== userId) {
    throw new Error('This listing has already been claimed by someone else.');
  }

  await updateDoc(loungeRef, {
    ownerId: userId,
    ownerName: input.ownerName.trim(),
    ownerContactEmail: input.ownerContactEmail.trim(),
    ownerContactPhone: input.ownerContactPhone.trim(),
    claimedAt: Timestamp.now(),
  });
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
