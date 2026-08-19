/**
 * The signed-in member's 21+ verification state, and what it permits.
 *
 * The flow agreed with Dr. Brinkley (2026-08-19) has four steps, and this hook
 * is what the last three read:
 *
 *  1. **Hard block** — date of birth at sign-up. Instant, no waiting; under-21
 *     is refused before an account exists. That happens in SignUpScreen and
 *     never reaches this hook.
 *  2. **Required step** — the ID upload, immediately after sign-up and not
 *     skippable. `mustUploadId` drives that gate in AppNavigator.
 *  3. **Then let them in** — browsing is unrestricted while review is pending,
 *     with a banner saying so. Review is done by a person, so a hard wall here
 *     would leave a new member staring at "waiting for approval" for hours at
 *     the exact moment they are most interested, and would turn every sign-up
 *     into a support-queue item.
 *  4. **Gated actions** — writing a review, reserving a table and claiming a
 *     business need `isVerified`.
 *
 * A member with **no record at all** is let through untouched. Every account
 * created before this feature has none, and blocking them would lock the team
 * out of their own app mid-testing. They are grandfathered deliberately;
 * requiring them to verify retroactively is a product decision nobody has made.
 */

import { useCallback, useEffect, useState } from 'react';
import { auth } from '../services/firebaseAuth';
import { getAgeVerification } from '../services/ageVerificationService';
import type { AgeVerification } from '../types/firestore';

export type AgeVerificationState = {
  /** undefined while loading, null when the account has no record. */
  verification: AgeVerification | null | undefined;
  loading: boolean;
  /**
   * Blocks the app until an ID is supplied. True only for a record that is
   * pending *and* has no image — i.e. someone who just signed up and has not
   * uploaded yet. Once an image exists they are let in, pending or not.
   */
  mustUploadId: boolean;
  /** Submitted and awaiting a human. Drives the banner. */
  awaitingReview: boolean;
  /** An admin looked and said no. Drives a banner prompting a new photo. */
  wasRejected: boolean;
  /** Confirmed 21+. The gate for reviews, reservations and claims. */
  isVerified: boolean;
  reload: () => void;
};

export function useAgeVerification(): AgeVerificationState {
  const userId = auth.currentUser?.uid;
  const [verification, setVerification] = useState<AgeVerification | null | undefined>(undefined);

  const reload = useCallback(() => {
    if (!userId) {
      setVerification(null);
      return;
    }
    getAgeVerification(userId)
      .then(setVerification)
      // A failed read must not become a lockout: treated as "no record", which
      // grandfathers rather than blocks. Failing closed here would mean a
      // dropped request locks a paying member out of the whole app.
      .catch(() => setVerification(null));
  }, [userId]);

  useEffect(reload, [reload]);

  const status = verification?.status;
  return {
    verification,
    loading: verification === undefined,
    mustUploadId: status === 'pending' && !verification?.idImageUrl,
    awaitingReview: status === 'pending' && !!verification?.idImageUrl,
    wasRejected: status === 'rejected',
    isVerified: status === 'verified',
    reload,
  };
}
