/**
 * Every read and write this portal performs.
 *
 * Deliberately mirrors the mobile app's ageVerificationService.ts and
 * ownerService.ts rather than inventing new document shapes — the same records
 * are read by the app, so a field written differently here would show up as a
 * bug over there. Where a rule in ../../firestore.rules constrains what may be
 * written, the comment says so, because those constraints are not obvious from
 * the call site.
 */
import {
  collection,
  doc,
  deleteField,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AgeVerification, ClaimingLounge, PendingVerification } from './types';

// ---------------------------------------------------------------- verifications

/**
 * Everyone waiting on an age decision.
 *
 * Reads the whole user document because the reviewer needs the member's name and
 * email alongside the images — a uid on its own tells you nothing about who you
 * are approving. Only an admin can run this at all: `users` is readable by its
 * owner or an admin, so for anyone else it returns permission-denied.
 */
export async function getPendingVerifications(): Promise<PendingVerification[]> {
  const snapshot = await getDocs(
    query(collection(db, 'users'), where('ageVerification.status', '==', 'pending')),
  );
  const records: PendingVerification[] = [];
  for (const document of snapshot.docs) {
    const data = document.data() as {
      name?: string;
      email?: string;
      ageVerification?: AgeVerification;
    };
    if (!data.ageVerification) {
      continue;
    }
    records.push({
      ...data.ageVerification,
      userId: document.id,
      userName: data.name,
      userEmail: data.email,
    });
  }
  // Oldest first. A queue that shows newest first quietly strands whoever has
  // been waiting longest, which is the opposite of what a queue is for.
  records.sort((a, b) => (a.submittedAt?.seconds ?? 0) - (b.submittedAt?.seconds ?? 0));
  return records;
}

/**
 * Records the decision, then notifies the member.
 *
 * That order matters and matches the app: a failed notification must not leave
 * the decision unrecorded. Being told late beats never being decided.
 */
async function decideVerification(
  userId: string,
  status: 'verified' | 'rejected',
  rejectionReason?: string,
): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    {
      ageVerification: {
        status,
        reviewedAt: Timestamp.now(),
        reviewedBy: auth.currentUser?.uid ?? 'admin-portal',
        ...(rejectionReason ? { rejectionReason } : { rejectionReason: deleteField() }),
      },
    },
    { merge: true },
  );

  try {
    // `age_verified` / `age_rejected` are admin-only notification types in
    // firestore.rules — a member cannot forge them. That is deliberate: a forged
    // "you're verified" would be a convincing lie about someone's own account.
    await setDoc(doc(collection(db, 'users', userId, 'notifications')), {
      type: status === 'verified' ? 'age_verified' : 'age_rejected',
      title: status === 'verified' ? 'You’re verified' : 'We couldn’t verify your ID',
      body:
        status === 'verified'
          ? 'Thanks — your ID has been checked and your account is fully active.'
          : rejectionReason ||
            'The ID you sent couldn’t be read clearly. You can upload another one from your profile.',
      read: false,
      createdAt: Timestamp.now(),
      data: {},
    });
  } catch {
    // Swallowed on purpose: the decision above is the durable record. Surfacing
    // this as "approval failed" would have the reviewer press the button again on
    // somebody who is already approved.
  }
}

export const approveVerification = (userId: string) => decideVerification(userId, 'verified');
export const rejectVerification = (userId: string, reason?: string) =>
  decideVerification(userId, 'rejected', reason);

// ---------------------------------------------------------------- claims

/** Lounges where somebody has asked to be recognised as the owner. */
export async function getPendingClaims(): Promise<ClaimingLounge[]> {
  const snapshot = await getDocs(
    query(collection(db, 'lounges'), where('claimStatus', '==', 'pending')),
  );
  return snapshot.docs
    .map(document => ({ id: document.id, ...(document.data() as Omit<ClaimingLounge, 'id'>) }))
    .sort((a, b) => (a.claimedAt?.seconds ?? 0) - (b.claimedAt?.seconds ?? 0));
}

/**
 * The claim fields, cleared together.
 *
 * One constant rather than three call sites listing them separately, because
 * that is exactly how the app once shipped a bug: `rejectLoungeClaim` cleared
 * `claimStatus` but not `ownerId`, leaving a lounge with a phantom owner nobody
 * could see or remove.
 */
const CLAIM_FIELDS = {
  claimStatus: deleteField(),
  claimantUserId: deleteField(),
  ownerName: deleteField(),
  ownerContactEmail: deleteField(),
  ownerContactPhone: deleteField(),
  claimedAt: deleteField(),
};

export async function approveClaim(loungeId: string): Promise<void> {
  const reference = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    throw new Error('This lounge no longer exists.');
  }
  const claimantUserId = (snapshot.data() as ClaimingLounge).claimantUserId;
  if (!claimantUserId) {
    throw new Error('This lounge has no pending claim to approve.');
  }

  await updateDoc(reference, { ownerId: claimantUserId, ...CLAIM_FIELDS });

  try {
    await setDoc(doc(collection(db, 'users', claimantUserId, 'notifications')), {
      type: 'claim_approved',
      title: 'Your business has been approved',
      body: 'You can now manage your listing from My Shops in your profile.',
      read: false,
      createdAt: Timestamp.now(),
      data: { loungeId },
    });
  } catch {
    // As above — the ownership change is the durable part.
  }
}

export async function rejectClaim(loungeId: string): Promise<void> {
  const reference = doc(db, 'lounges', loungeId);
  const snapshot = await getDoc(reference);
  const claimantUserId = snapshot.exists()
    ? (snapshot.data() as ClaimingLounge).claimantUserId
    : undefined;

  // ownerId is cleared alongside the rest — see CLAIM_FIELDS.
  await updateDoc(reference, { ownerId: deleteField(), ...CLAIM_FIELDS });

  if (!claimantUserId) {
    return;
  }
  try {
    await setDoc(doc(collection(db, 'users', claimantUserId, 'notifications')), {
      type: 'claim_rejected',
      title: 'We couldn’t approve your claim',
      body: 'Please get in touch if you believe this was a mistake.',
      read: false,
      createdAt: Timestamp.now(),
      data: { loungeId },
    });
  } catch {
    /* see above */
  }
}
