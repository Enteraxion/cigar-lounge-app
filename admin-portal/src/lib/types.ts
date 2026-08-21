/**
 * The subset of the mobile app's Firestore shapes this portal reads.
 *
 * Duplicated from ../../src/types/firestore.ts rather than imported, for the same
 * reason owner-portal/src/lib/types.ts does it: this is a separate deployable app
 * with its own `npm install`, and Firebase only deploys what is inside its own
 * directory. Only the fields the portal actually touches are listed.
 */
import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------- age verification

export type AgeVerificationStatus = 'pending' | 'verified' | 'rejected';

/** Mirrors the app's IdDocumentType (../../src/types/firestore.ts). */
export type IdDocumentType = 'drivers_license' | 'state_id' | 'passport' | 'military_id';

export type AgeVerification = {
  /** ISO YYYY-MM-DD, self-declared at sign-up and already gate-checked there. */
  dateOfBirth: string;
  status: AgeVerificationStatus;
  /** Absent on records written before the document picker existed. */
  documentType?: IdDocumentType;
  /** The front of a card, or a passport's photo page. */
  idImageUrl?: string;
  /** The back of a card. Absent for passports and for legacy records. */
  idBackImageUrl?: string;
  /** Set when the member chose "Explore first" instead of uploading. */
  deferredAt?: Timestamp;
  submittedAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
};

export type PendingVerification = AgeVerification & {
  userId: string;
  userName?: string;
  userEmail?: string;
};

// ---------------------------------------------------------------- claims

export type ClaimingLounge = {
  id: string;
  name: string;
  address: string;
  city?: string;
  claimStatus?: 'pending';
  claimantUserId?: string;
  ownerId?: string;
  ownerName?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  claimedAt?: Timestamp;
};
