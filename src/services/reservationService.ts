/**
 * reservationService
 *
 * "Reserve a Table" — lets a signed-in member book a date/time slot at a
 * lounge (see src/screens/ReserveTableScreen.tsx). Reservations are just
 * recorded here, same trust model as reviews/favorites elsewhere in this
 * app: no availability/capacity checking against other reservations,
 * since there's no owner-facing view of a lounge's bookings yet to
 * conflict against. Revisit once the Owner Portal (or an in-app
 * equivalent) can actually show a lounge's reservations back to its owner.
 *
 * The owner side arrived with the Owner Portal's Reservations page. The MEMBER
 * side did not, and for two weeks nothing read this collection back to the
 * person who made the booking: ReserveTableScreen wrote the document, showed a
 * "Reservation Confirmed" screen, and that was the last the member ever saw of
 * it — not on their profile, not on the lounge. QA logged it on 2026-08-23
 * (BUG-001) and they were right; a confirmation you cannot look up again is
 * indistinguishable from one that was never saved. getMyReservations below is
 * the read that was missing.
 */

import {
  getFirestore,
  collection,
  collectionGroup,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from '@react-native-firebase/firestore';
import type { ReservationDocument } from '../types/firestore';
import { getLoungesByIds, type Lounge } from './loungeService';

const db = getFirestore();

export type CreateReservationInput = {
  guestName: string;
  contactPhone: string;
  partySize: number;
  date: Date;
  timeSlot: string;
  notes?: string;
};

/** Creates a reservation under `lounges/{loungeId}/reservations`, returning its new id. */
export async function createReservation(
  loungeId: string,
  userId: string,
  input: CreateReservationInput,
): Promise<string> {
  const data: ReservationDocument = {
    userId,
    guestName: input.guestName.trim(),
    contactPhone: input.contactPhone.trim(),
    partySize: input.partySize,
    date: Timestamp.fromDate(input.date),
    timeSlot: input.timeSlot,
    createdAt: Timestamp.now(),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
  const ref = await addDoc(collection(db, 'lounges', loungeId, 'reservations'), data);
  return ref.id;
}

/**
 * Every reservation this member has made, across all lounges, soonest first.
 *
 * A collectionGroup query, because reservations live under the LOUNGE
 * (`lounges/{id}/reservations`) rather than under the member — the lounge is
 * who needs to list them. That means there is no per-member path to walk, and
 * the same pattern getUserReviews already uses applies here. Needs the
 * COLLECTION_GROUP index on `reservations.userId` in firestore.indexes.json.
 *
 * Sorted in JS rather than with orderBy so the query stays a single-field
 * lookup and needs no composite index: a member has a handful of
 * reservations, not thousands.
 */
export type MyReservation = ReservationDocument & {
  id: string;
  loungeId: string;
  lounge: Lounge | null;
};

export async function getMyReservations(userId: string): Promise<MyReservation[]> {
  const snapshot = await getDocs(
    query(collectionGroup(db, 'reservations'), where('userId', '==', userId)),
  );

  const rows = snapshot.docs.map(d => ({
    ...(d.data() as ReservationDocument),
    id: d.id,
    // The parent of the subcollection is the lounge document; a
    // collectionGroup query does not carry the id any other way.
    loungeId: d.ref.parent.parent?.id ?? '',
  }));

  // One batched fetch for every lounge involved rather than a read per row.
  const lounges = await getLoungesByIds([...new Set(rows.map(r => r.loungeId).filter(Boolean))]);
  const byId = new Map(lounges.map(lounge => [lounge.id, lounge]));

  return rows
    .map(row => ({ ...row, lounge: byId.get(row.loungeId) ?? null }))
    .sort((a, b) => b.date.seconds - a.date.seconds);
}

/**
 * Cancels a reservation.
 *
 * firestore.rules already allows the guest to delete their own
 * (`allow delete: if isReservationGuest()`), so this needed no rule change —
 * only a caller. A booking a member can see but never withdraw would be worse
 * than one they cannot see at all: it would have them turning up to a table
 * they no longer want, or phoning the lounge to undo something the app
 * offered them no way to undo.
 */
export async function cancelReservation(loungeId: string, reservationId: string): Promise<void> {
  await deleteDoc(doc(db, 'lounges', loungeId, 'reservations', reservationId));
}
