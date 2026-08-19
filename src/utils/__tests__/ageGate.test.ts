/**
 * The 21+ gate decision.
 *
 * This rule decides whether somebody reaches the app at all, so each branch is
 * pinned. Two of them are easy to get backwards later and both would be serious:
 * treating a missing record as "blocked" locks every pre-existing account out of
 * its own app, and treating `pending` as "blocked" strands a new member on a
 * waiting screen until a human happens to review them.
 */

import { deriveAgeGateState } from '../../hooks/useAgeVerification';
import type { AgeVerification } from '../../types/firestore';

const at = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) };
const record = (over: Partial<AgeVerification>): AgeVerification => ({
  dateOfBirth: '1990-01-01',
  status: 'pending',
  submittedAt: at,
  ...over,
});

describe('deriveAgeGateState', () => {
  it('waits while the record is still being read', () => {
    // undefined means "not loaded". Blocking or admitting on it would flash the
    // wrong screen and then swap, which reads as a glitch.
    const state = deriveAgeGateState(undefined);
    expect(state.loading).toBe(true);
    expect(state.mustUploadId).toBe(false);
  });

  it('grandfathers an account with no record', () => {
    // Every account created before this feature has none. Blocking them would
    // have locked the whole team out mid-testing.
    const state = deriveAgeGateState(null);
    expect(state.loading).toBe(false);
    expect(state.mustUploadId).toBe(false);
    expect(state.isVerified).toBe(false);
  });

  it('blocks a fresh signup — pending with no image', () => {
    // The one state that gates. This is what a new member looks like the moment
    // after sign-up writes their declared date of birth.
    const state = deriveAgeGateState(record({ status: 'pending' }));
    expect(state.mustUploadId).toBe(true);
    expect(state.awaitingReview).toBe(false);
  });

  it('lets them in once an ID is attached, review pending', () => {
    // Review is done by a person. Holding them here would strand a new member
    // at the moment they are most interested.
    const state = deriveAgeGateState(
      record({ status: 'pending', idImageUrl: 'https://example/id.png' }),
    );
    expect(state.mustUploadId).toBe(false);
    expect(state.awaitingReview).toBe(true);
  });

  it('lets a rejected member in, flagged, so they can replace the photo', () => {
    const state = deriveAgeGateState(
      record({ status: 'rejected', idImageUrl: 'https://example/id.png' }),
    );
    expect(state.mustUploadId).toBe(false);
    expect(state.wasRejected).toBe(true);
    expect(state.isVerified).toBe(false);
  });

  it('a verified member is gated by nothing and banner-free', () => {
    const state = deriveAgeGateState(
      record({ status: 'verified', idImageUrl: 'https://example/id.png' }),
    );
    expect(state.isVerified).toBe(true);
    expect(state.mustUploadId).toBe(false);
    expect(state.awaitingReview).toBe(false);
    expect(state.wasRejected).toBe(false);
  });

  it('never reports more than one banner state at once', () => {
    for (const v of [
      undefined,
      null,
      record({ status: 'pending' }),
      record({ status: 'pending', idImageUrl: 'u' }),
      record({ status: 'rejected', idImageUrl: 'u' }),
      record({ status: 'verified', idImageUrl: 'u' }),
    ]) {
      const s = deriveAgeGateState(v);
      expect([s.awaitingReview, s.wasRejected].filter(Boolean).length).toBeLessThanOrEqual(1);
    }
  });

  it('treats an empty idImageUrl as no image', () => {
    // A blank string would otherwise satisfy a truthiness check on some paths
    // and let a member past the upload without one.
    expect(deriveAgeGateState(record({ status: 'pending', idImageUrl: '' })).mustUploadId).toBe(true);
  });
});
