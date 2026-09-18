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
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  Timestamp,
} from '@react-native-firebase/firestore';
import { listenToDoc } from './docListener';
import type {
  AgeVerification,
  AgeVerificationStatus,
  IdDocumentType,
  IdReviewAction,
  UserDocument,
} from '../types/firestore';
import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
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

/**
 * Attaches the photographed document to the member's pending record.
 *
 * Both sides are written in one operation on purpose. The capture screen holds
 * the photos locally until every required side is in hand, so the record never
 * passes through a half-submitted state that the app gate would read as
 * incomplete and hold the member at the upload wall over.
 *
 * `back` is cleared rather than left alone when the document does not have one.
 * A member who first sent a driving licence and then replaced it with a passport
 * would otherwise leave the licence's back image attached to a passport record,
 * and the reviewer would be looking at two different documents.
 *
 * The status returns to `pending` and any previous decision is erased, which is
 * what makes a rejection recoverable: re-uploading puts the member back in the
 * queue instead of leaving them looking at the old rejection reason forever.
 */
/**
 * The automated first pass, run straight after the images are uploaded.
 *
 * Deliberately best-effort and never allowed to throw into the caller. If the
 * review fails, times out, or is not configured, the submission simply stays
 * `pending` and an administrator sees it — which is exactly what happened before
 * this existed. A member must never be blocked because our automation had a bad
 * day.
 */
/**
 * What the automated review decided, as far as the member is concerned.
 *
 * `null` means we never got an answer — the call failed, or the feature is not
 * configured. That is deliberately NOT an error the member sees: their document
 * is saved and queued, and a person will review it. It is, however, something we
 * need to see, which is why the catch below logs instead of swallowing.
 */
export type AutomatedReviewOutcome = {
  decision: 'approve' | 'reject' | 'refer';
  memberMessage?: string;
  action?: IdReviewAction;
};

export async function requestAutomatedReview(): Promise<AutomatedReviewOutcome | null> {
  try {
    const call = httpsCallable<Record<string, never>, AutomatedReviewOutcome>(
      getFunctions(getApp()),
      'reviewIdDocument',
    );
    const { data } = await call({});
    return data ?? null;
  } catch (error) {
    // Quiet to the member, loud to us. This catch used to be empty, and that
    // was the single reason a stale app bundle went unnoticed on 2026-08-31:
    // "the review referred you to a human", "Azure rejected our key" and "this
    // code is not deployed" all produced the identical silent screen. The
    // member still sees a queued submission rather than an error they can do
    // nothing about — but the failure is now on the record.
    console.warn('[ageVerification] automated review unavailable', error);
    return null;
  }
}

export async function attachIdDocument(
  userId: string,
  documentType: IdDocumentType,
  images: { front: string; back?: string },
): Promise<AutomatedReviewOutcome | null> {
  await setDoc(
    doc(db, 'users', userId),
    {
      ageVerification: {
        documentType,
        idImageUrl: images.front,
        idBackImageUrl: images.back ?? deleteField(),
        status: 'pending',
        submittedAt: Timestamp.now(),
        rejectionReason: deleteField(),
        reviewedAt: deleteField(),
        reviewedBy: deleteField(),
      },
    },
    { merge: true },
  );

  // Ask for the automated read now that a complete submission exists. Awaited so
  // the caller's own refresh sees the outcome rather than a stale "pending" —
  // the whole point is that most members never wait for a person.
  //
  // The outcome is returned rather than dropped: the screen that called this
  // needs to tell the member what happened, and re-reading the record would
  // race the write that has only just landed.
  return requestAutomatedReview();
}

/**
 * Corrects the date of birth held on the account.
 *
 * Exists because the automated review can now tell a member their document and
 * their account disagree — and until 2026-08-31 there was nothing anybody could
 * do about that. `dateOfBirth` was written once at sign-up and only ever
 * displayed; no screen edited it and neither did the admin portal. A single
 * mistyped digit meant a permanent referral to a human on every resubmission,
 * which nobody noticed while every submission went to a human anyway.
 *
 * Safe to expose. The 21+ decision is taken from the date printed on the
 * DOCUMENT, never from this one (see functions/src/idReview.ts — `ageOn` is
 * called with `documentDob`); this value is a cross-check that catches typos,
 * not a credential. firestore.rules already permitted the write — it locks
 * `status`, which is the field that would matter.
 */
export async function updateDeclaredDateOfBirth(
  userId: string,
  dateOfBirth: BirthDate,
  { review = true }: { review?: boolean } = {},
): Promise<AutomatedReviewOutcome | null> {
  await setDoc(
    doc(db, 'users', userId),
    {
      ageVerification: {
        dateOfBirth: toIsoDate(dateOfBirth),
        // Back into the queue, and the previous decision cleared. The member has
        // changed the thing the decision was made on, so keeping the old verdict
        // on screen would be wrong — and `reviewIdDocument` refuses to look at a
        // record that is not `pending`, so without this the re-read below would
        // do nothing at all.
        //
        // Permitted by firestore.rules: a member may move their own record TO
        // 'pending' but never to 'verified'. See decidesOwnAgeVerification().
        status: 'pending',
        rejectionReason: deleteField(),
        resolution: deleteField(),
        reviewedAt: deleteField(),
        reviewedBy: deleteField(),
      },
    },
    { merge: true },
  );

  // Re-read the photographs already on file rather than making the member
  // retake them. Nothing about their document changed — only the date we were
  // comparing it against — so asking for fresh photographs would be busywork
  // that costs us the member who is already annoyed.
  return review ? requestAutomatedReview() : null;
}

/**
 * Records that the member chose to explore the app before verifying.
 *
 * Rohith, 2026-08-19: a wall at the moment of sign-up asks somebody to
 * photograph their licence for an app they have not seen yet, and the ones who
 * would have loved it are the ones who quit there. Deferring lets them look
 * first and verify once they care.
 *
 * `status` is untouched — still `pending`. This is the difference between letting
 * someone in to browse and letting them do the things the 21+ check exists to
 * protect: reviews, reservations and business claims all require `verified` and
 * are refused exactly as before.
 */
export async function deferAgeVerification(userId: string): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    { ageVerification: { deferredAt: Timestamp.now() } },
    { merge: true },
  );
}

/**
 * Watches a member's 21+ record and reports every change, live.
 *
 * Added 2026-08-25. Julian approved his own ID in the admin portal during a
 * walkthrough and the "under review" banner stayed on screen — the app had read
 * the record once when it mounted and never looked again, so it only caught up
 * on a full reload.
 *
 * A listener rather than a refetch-on-focus, because neither refresh point would
 * have helped him: he was looking at the screen the whole time, so nothing was
 * re-focused and the app was never backgrounded. Approval happens on somebody
 * else's machine, which makes this genuinely a push, not a poll — the banner now
 * disappears while the member is watching it.
 *
 * Returns its unsubscribe function.
 *
 * The listen itself goes through `listenToDoc` because the phone and the
 * browser SDKs put `onSnapshot` in different places — see docListener.ts.
 */
export function watchAgeVerification(
  userId: string,
  onChange: (verification: AgeVerification | null) => void,
): () => void {
  return listenToDoc(
    doc(db, 'users', userId),
    snapshot => {
      if (!snapshot || !snapshot.exists()) {
        onChange(null);
        return;
      }
      onChange((snapshot.data() as UserDocument).ageVerification ?? null);
    },
    () => {
      // A failed listen must not become a lockout — same reasoning as the
      // one-shot read below. Treated as "no record", which grandfathers rather
      // than blocks.
      onChange(null);
    },
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
