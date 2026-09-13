import {
  guestCount,
  ownerToNotify,
  reservationCancelledNotification,
  reservationCreatedNotification,
  reviewPostedNotification,
} from './ownerNotifications';

const OWNED = { name: 'Brass Peacock', ownerId: 'owner-1' };

describe('ownerToNotify — who hears about it', () => {
  it('says nobody for an unclaimed lounge', () => {
    // The common case by a wide margin: 8,496 lounges, a handful claimed.
    expect(ownerToNotify({ name: 'Brass Peacock' }, 'member-1')).toBeNull();
    expect(ownerToNotify(undefined, 'member-1')).toBeNull();
  });

  it('says nobody when the owner is the one acting', () => {
    // An owner booking their own table, or cancelling from their own portal,
    // does not need telling. A notification from yourself reads as a bug.
    expect(ownerToNotify(OWNED, 'owner-1')).toBeNull();
  });

  it('names the owner when a guest acts', () => {
    expect(ownerToNotify(OWNED, 'member-1')).toBe('owner-1');
  });

  it('still names the owner when the actor is unknown', () => {
    // A reservation written without a userId is malformed, but the owner still
    // has a booking to honour — silence would be the worse failure.
    expect(ownerToNotify(OWNED, undefined)).toBe('owner-1');
  });
});

describe('guestCount', () => {
  it('is never bare, and never plural for one', () => {
    expect(guestCount(1)).toBe('1 guest');
    expect(guestCount(4)).toBe('4 guests');
  });

  it('survives nonsense rather than printing it', () => {
    expect(guestCount(0)).toBe('1 guest');
    expect(guestCount(-3)).toBe('1 guest');
    expect(guestCount(NaN)).toBe('1 guest');
    expect(guestCount(2.7)).toBe('2 guests');
  });
});

describe('what the owner actually reads', () => {
  it('leads a new reservation with when, not who', () => {
    const n = reservationCreatedNotification('l1', OWNED, {
      guestName: 'Rohith',
      partySize: 2,
      timeSlot: '8:30 PM',
      dateLabel: 'Sun, Sep 13',
    });
    expect(n.type).toBe('reservation_created');
    expect(n.title).toBe('New reservation at Brass Peacock');
    expect(n.body).toBe('Rohith booked a table for 2 guests — Sun, Sep 13 at 8:30 PM.');
    expect(n.data.loungeId).toBe('l1');
  });

  it('tells the owner the slot is free when one is cancelled', () => {
    const n = reservationCancelledNotification('l1', OWNED, {
      guestName: 'Rohith',
      partySize: 2,
      timeSlot: '8:30 PM',
      dateLabel: 'Sun, Sep 13',
    });
    expect(n.type).toBe('reservation_cancelled');
    expect(n.body).toContain('free again');
  });

  it('does not quote the review', () => {
    // An owner should not meet a one-star sentence in a banner. They are told
    // there is something to read; the lounge is one tap away.
    const n = reviewPostedNotification('l1', OWNED, { userName: 'Rohith', rating: 1 });
    expect(n.body).toBe('Rohith left a 1-star review.');
    expect(n.title).toBe('New review of Brass Peacock');
  });

  it('falls back to honest wording when the lounge has lost its name', () => {
    const n = reservationCreatedNotification('l1', { ownerId: 'owner-1' }, { partySize: 1 });
    expect(n.title).toBe('New reservation at your lounge');
    expect(n.body).toBe('A guest booked a table for 1 guest.');
  });

  it('omits the dash entirely when there is no date or time', () => {
    // Rather than trailing an empty "— ." at the end of the sentence.
    const n = reservationCreatedNotification('l1', OWNED, { guestName: 'Rohith', partySize: 3 });
    expect(n.body).toBe('Rohith booked a table for 3 guests.');
  });

  it('every notification points at the lounge it is about', () => {
    // NotificationsScreen taps through on data.loungeId; without it the row is
    // dead, which is how several notifications in this app used to behave.
    for (const n of [
      reservationCreatedNotification('l9', OWNED, { partySize: 1 }),
      reservationCancelledNotification('l9', OWNED, { partySize: 1 }),
      reviewPostedNotification('l9', OWNED, {}),
    ]) {
      expect(n.data.loungeId).toBe('l9');
    }
  });
});
