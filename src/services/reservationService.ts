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
 */

import { getFirestore, collection, addDoc, Timestamp } from '@react-native-firebase/firestore';
import type { ReservationDocument } from '../types/firestore';

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
