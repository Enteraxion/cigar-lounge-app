/**
 * Merging the two queries behind "My Shops".
 *
 * Ownership is recorded on the lounge document itself (no claims
 * collection), across two fields that mean different things:
 *
 *   claimantUserId — who asked. Set on submit, and deliberately *kept* after
 *                    approval, because the Owner Portal queries on it.
 *   ownerId        — who was approved. Set only by approveLoungeClaim, and
 *                    the field firestore.rules' isOwnListingEdit checks.
 *
 * So an approved lounge matches both queries and a pending one matches only
 * the second, which is why this has to de-duplicate rather than concatenate.
 *
 * Pure and separate from ownerService so it can be tested without Firestore —
 * the distinction between "asked" and "approved" is exactly the kind of thing
 * that looks obviously right and silently isn't.
 */

import type { Lounge } from '../services/loungeService';

export type OwnedLounge = Lounge & {
  /**
   * True only when this member is the *approved* owner. Keyed off `ownerId`
   * to match firestore.rules, so this can never disagree with whether an
   * edit will actually be accepted — a screen that offered an Edit button on
   * the strength of a pending claim would fail on save with a permission
   * error the owner couldn't act on.
   */
  approved: boolean;
};

export function mergeOwnedLounges(lounges: Lounge[], userId: string): OwnedLounge[] {
  const byId = new Map<string, OwnedLounge>();

  for (const lounge of lounges) {
    const approved = lounge.ownerId === userId;
    const existing = byId.get(lounge.id);
    // Approved always wins over pending for the same lounge, whichever query
    // happened to yield it first.
    if (!existing || (approved && !existing.approved)) {
      byId.set(lounge.id, { ...lounge, approved });
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    // Approved shops first: an owner with one approved and one pending shop
    // cares about the one they can actually do something with.
    if (a.approved !== b.approved) {
      return a.approved ? -1 : 1;
    }
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}
