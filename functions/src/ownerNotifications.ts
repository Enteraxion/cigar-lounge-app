/**
 * What an owner is told when a guest acts on their lounge.
 *
 * Kept pure and separate from the triggers that call it, for the same reason
 * idReview.ts is separate from the model call: the interesting question is not
 * "does it fire" but "what does it say, and when does it say nothing at all".
 *
 * **Why notifications for owners are written by a trigger, not by the app.**
 * Every other notification in this project is written by the member whose
 * action caused it — `new_review_on_favorite` is written by the reviewer's own
 * device. That works because those are claims about the writer's own activity.
 * These are not. An owner notification says "a guest booked a table", and a
 * member able to write that into somebody's notifications could equally write
 * the cancellation, or forty of them. An owner who stops trusting these stops
 * reading them, which costs more than the feature is worth.
 *
 * A Firestore trigger also catches what a client hook cannot. Cancelling is a
 * plain `deleteDoc` in reservationService with no callback, the Owner Portal
 * and admin portal write the same documents by other routes, and a phone that
 * dies between writing the reservation and posting the notification would
 * simply lose it. The trigger fires on the document changing, whoever changed
 * it and whatever happened to them afterwards.
 */

/** The subset of a lounge this module needs. */
export type LoungeOwnership = {
  name?: string;
  /** Set only once a claim is approved — see ownerService.approveLoungeClaim. */
  ownerId?: string;
};

export type OwnerNotification = {
  type: 'reservation_created' | 'reservation_cancelled' | 'new_review_on_owned_lounge';
  title: string;
  body: string;
  data: { loungeId: string };
};

/** "2 guests", "1 guest" — an owner reads this as a table size, so it is never bare. */
export function guestCount(partySize: number): string {
  const n = Number.isFinite(partySize) && partySize > 0 ? Math.floor(partySize) : 1;
  return `${n} ${n === 1 ? 'guest' : 'guests'}`;
}

/**
 * Whether this lounge has an owner who should hear about `actorId`'s action.
 *
 * Two cases produce nothing, and both matter:
 *
 *  - **No owner.** Most of the directory is unclaimed — 8,496 lounges, a
 *    handful claimed — so the common path is silence.
 *  - **The owner is the actor.** An owner booking their own table, or
 *    cancelling a booking from their own portal, does not need telling. Without
 *    this an owner testing their own listing gets a notification from
 *    themselves, which reads as a bug.
 */
export function ownerToNotify(
  lounge: LoungeOwnership | undefined,
  actorId: string | undefined,
): string | null {
  const ownerId = lounge?.ownerId;
  if (!ownerId || ownerId === actorId) {
    return null;
  }
  return ownerId;
}

/** The lounge's name, or something honest when the document has lost it. */
function loungeName(lounge: LoungeOwnership | undefined): string {
  const name = lounge?.name?.trim();
  return name && name.length > 0 ? name : 'your lounge';
}

export function reservationCreatedNotification(
  loungeId: string,
  lounge: LoungeOwnership | undefined,
  reservation: { guestName?: string; partySize?: number; timeSlot?: string; dateLabel?: string },
): OwnerNotification {
  const who = reservation.guestName?.trim() || 'A guest';
  // Date and time are the two things an owner acts on, so they lead the body.
  // The name is in there for recognition, not for planning.
  const when = [reservation.dateLabel, reservation.timeSlot].filter(Boolean).join(' at ');
  return {
    type: 'reservation_created',
    title: `New reservation at ${loungeName(lounge)}`,
    body: `${who} booked a table for ${guestCount(reservation.partySize ?? 1)}${
      when ? ` — ${when}` : ''
    }.`,
    data: { loungeId },
  };
}

export function reservationCancelledNotification(
  loungeId: string,
  lounge: LoungeOwnership | undefined,
  reservation: { guestName?: string; partySize?: number; timeSlot?: string; dateLabel?: string },
): OwnerNotification {
  const who = reservation.guestName?.trim() || 'A guest';
  const when = [reservation.dateLabel, reservation.timeSlot].filter(Boolean).join(' at ');
  return {
    type: 'reservation_cancelled',
    title: `Reservation cancelled at ${loungeName(lounge)}`,
    body: `${who} cancelled their table for ${guestCount(reservation.partySize ?? 1)}${
      when ? ` — ${when}` : ''
    }. The slot is free again.`,
    data: { loungeId },
  };
}

export function reviewPostedNotification(
  loungeId: string,
  lounge: LoungeOwnership | undefined,
  review: { userName?: string; rating?: number },
): OwnerNotification {
  const who = review.userName?.trim() || 'A member';
  const rating = Number.isFinite(review.rating) ? `${review.rating}-star ` : '';
  return {
    type: 'new_review_on_owned_lounge',
    title: `New review of ${loungeName(lounge)}`,
    // Deliberately does not quote the review. An owner opening the app to a
    // one-star sentence in a notification banner is worse than being told there
    // is something to read; the lounge is one tap away.
    body: `${who} left a ${rating}review.`,
    data: { loungeId },
  };
}
