/**
 * ageVerificationService
 *
 * The 21+ flow's data layer. Dr. Brinkley, 2026-08-17: "the only people who
 * should be able to register are people who are 21 and up", verified against an
 * ID.
 *
 * Two layers, and the distinction matters:
 *
 *  - **The gate** is the self-declared date of birth, checked by
 *    src/utils/ageCheck.ts *before* createUserWithEmailAndPassword runs. No
 *    under-21 account is created, so there is never a minor account to clean up.
 *  - **The evidence** is the uploaded ID, reviewed by a human — the same manual
 *    pattern the business claims already use, so no paid identity service is
 *    needed to ship this.
 *
 * `isVerified` treats a missing record as unverified. Accounts predate this
 * feature, and silently grandfathering them would defeat the point.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  Timestamp,
} from '@react-native-firebase/firestore';
import type {
  AgeVerification,
  AgeVerificationStatus,
  UserDocument,
} from '../types/firestore';
import { createNotification } from './userActionsService';
import { toIsoDate, type BirthDate } from '../utils/ageCheck';

const db = getFirestore();

export type AgeVerificationRecord = AgeVerification & { userId: string; userName?: string };

/**
 * Records the member's declared date of birth and puts them in review.
 *
 * Called right after the account is created — the age gate has already refused
 * anything under 21 by this point, so this is recording an accepted answer, not
 * deciding one. Merged into the user document so it cannot clobber the rest of
 * the profile.
 */
export async function submitAgeVerification(
  userId: string,
  dateOfBirth: BirthDate,
  idImageUrl?: string,
): Promise<void> {
  const verification: AgeVerification = {
    dateOfBirth: toIsoDate(dateOfBirth),
    status: 'pending',
    ...(idImageUrl ? { idImageUrl } : {}),
    submittedAt: Timestamp.now(),
  };
  await setDoc(doc(db, 'users', userId), { ageVerification: verification }, { merge: true });
}

/** Attaches an ID image to an existing pending record. */
export async function attachIdImage(userId: string, idImageUrl: string): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    { ageVerification: { idImageUrl, status: 'pending', submittedAt: Timestamp.now() } },
    { merge: true },
  );
}

export async function getAgeVerification(userId: string): Promise<AgeVerification | null> {
  const snapshot = await getDoc(doc(db, 'users', userId));
  if (!snapshot.exists()) {
    return null;
  }
  return (snapshot.data() as UserDocument).ageVerification ?? null;
}

/**
 * Whether this member has been confirmed 21+.
 *
 * A missing record is **not** verified. Every account created before this
 * feature existed has no record, and treating absence as a pass would make the
 * whole gate decorative for exactly the accounts nobody has checked.
 */
export async function isVerified(userId: string): Promise<boolean> {
  const verification = await getAgeVerification(userId);
  return verification?.status === 'verified';
}

/** Everyone awaiting review — for the admin screen. */
export async function getPendingAgeVerifications(): Promise<AgeVerificationRecord[]> {
  const snapshot = await getDocs(
    query(collection(db, 'users'), where('ageVerification.status', '==', 'pending')),
  );
  return snapshot.docs.map(document => {
    const data = document.data() as UserDocument;
    return {
      ...(data.ageVerification as AgeVerification),
      userId: document.id,
      userName: data.name,
    };
  });
}

/**
 * Records an admin's decision and tells the member.
 *
 * The decision is written first and the notification second, for the same
 * reason the claim flow does it that way: a failed notification must not leave
 * the decision unrecorded, and being told late beats never being decided.
 */
async function decide(
  userId: string,
  adminUserId: string,
  status: Extract<AgeVerificationStatus, 'verified' | 'rejected'>,
  rejectionReason?: string,
): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    {
      ageVerification: {
        status,
        reviewedAt: Timestamp.now(),
        reviewedBy: adminUserId,
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    },
    { merge: true },
  );

  try {
    await createNotification(
      userId,
      status === 'verified'
        ? {
            type: 'age_verified',
            title: 'You’re verified',
            body: 'Thanks — your ID has been checked and your account is fully active.',
          }
        : {
            type: 'age_rejected',
            title: 'We couldn’t verify your ID',
            body:
              rejectionReason ||
              'The ID you sent couldn’t be read clearly. You can upload another one from your profile.',
          },
    );
  } catch {
    // Deliberately swallowed — the decision above is the durable record, and
    // surfacing a notification failure as "approval failed" would have an admin
    // press the button again on someone already approved.
  }
}

export function approveAgeVerification(userId: string, adminUserId: string): Promise<void> {
  return decide(userId, adminUserId, 'verified');
}

export function rejectAgeVerification(
  userId: string,
  adminUserId: string,
  reason?: string,
): Promise<void> {
  return decide(userId, adminUserId, 'rejected', reason);
}
