/**
 * The "asked" vs "approved" distinction behind My Shops.
 *
 * `claimantUserId` (who asked) survives approval because the Owner Portal
 * queries on it, so the two ownership queries overlap and the field that
 * decides what an owner can actually *do* is `ownerId`. Getting that backwards
 * would offer an Edit button that fails on save with a permission error the
 * owner can't act on — which is why it's tested rather than assumed.
 */

import { mergeOwnedLounges } from '../ownedLounges';
import type { Lounge } from '../../services/loungeService';

const ME = 'user-me';
const SOMEONE_ELSE = 'user-other';

function lounge(id: string, over: Partial<Lounge> = {}): Lounge {
  return {
    id,
    name: `Lounge ${id}`,
    address: `${id} Main St`,
    coordinates: { lat: 30, lng: -97 },
    images: [],
    tags: [],
    amenities: [],
    ratings: { overall: 4 },
    reviewCount: 0,
    ...over,
  } as unknown as Lounge;
}

describe('mergeOwnedLounges', () => {
  it('marks a lounge approved only when ownerId matches', () => {
    const result = mergeOwnedLounges(
      [lounge('a', { ownerId: ME, claimantUserId: ME })],
      ME,
    );
    expect(result).toHaveLength(1);
    expect(result[0].approved) /* keyed off ownerId, matching firestore.rules */
      .toBe(true);
  });

  it('treats a pending claim as not approved', () => {
    // The whole point: claimantUserId set and ownerId absent is exactly what a
    // submitted-but-unreviewed claim looks like.
    const result = mergeOwnedLounges(
      [lounge('a', { claimantUserId: ME, claimStatus: 'pending' })],
      ME,
    );
    expect(result[0].approved).toBe(false);
  });

  it('de-duplicates the lounge both queries return', () => {
    // An approved lounge matches ownerId AND claimantUserId, so it arrives
    // twice and must not render as two shops.
    const document = lounge('a', { ownerId: ME, claimantUserId: ME });
    const result = mergeOwnedLounges([document, document], ME);
    expect(result).toHaveLength(1);
    expect(result[0].approved).toBe(true);
  });

  it('lets approved win regardless of which copy is seen first', () => {
    const asClaim = lounge('a', { claimantUserId: ME });
    const asOwned = lounge('a', { ownerId: ME, claimantUserId: ME });
    expect(mergeOwnedLounges([asClaim, asOwned], ME)[0].approved).toBe(true);
    expect(mergeOwnedLounges([asOwned, asClaim], ME)[0].approved).toBe(true);
  });

  it('does not mark a lounge owned by someone else as approved', () => {
    // Someone whose claim was rejected and the lounge then claimed by the real
    // owner could still appear here if the query were stale.
    const result = mergeOwnedLounges(
      [lounge('a', { ownerId: SOMEONE_ELSE, claimantUserId: ME })],
      ME,
    );
    expect(result[0].approved).toBe(false);
  });

  it('puts approved shops before pending ones', () => {
    const result = mergeOwnedLounges(
      [
        lounge('pending', { name: 'A Pending', claimantUserId: ME }),
        lounge('owned', { name: 'Z Owned', ownerId: ME, claimantUserId: ME }),
      ],
      ME,
    );
    expect(result.map(r => r.id)).toEqual(['owned', 'pending']);
  });

  it('sorts by name within the same status', () => {
    const result = mergeOwnedLounges(
      [
        lounge('b', { name: 'Bravo', ownerId: ME }),
        lounge('a', { name: 'Alpha', ownerId: ME }),
      ],
      ME,
    );
    expect(result.map(r => r.name)).toEqual(['Alpha', 'Bravo']);
  });

  it('returns nothing for a member who owns nothing', () => {
    // The common case — this is what keeps the My Shops card off every
    // ordinary member's profile.
    expect(mergeOwnedLounges([], ME)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [lounge('a', { ownerId: ME })];
    const snapshot = JSON.stringify(input);
    mergeOwnedLounges(input, ME);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('tolerates a lounge with no name', () => {
    const result = mergeOwnedLounges(
      [lounge('a', { name: undefined as never, ownerId: ME }), lounge('b', { ownerId: ME })],
      ME,
    );
    expect(result).toHaveLength(2);
  });
});
