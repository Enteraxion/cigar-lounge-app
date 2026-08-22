/**
 * Members, reports, reviews, and the operations that need server-side power.
 *
 * Three of these read collections the portal is the first thing ever to look at.
 * `users/{uid}/issueReports` in particular was written by the app's "Report Issue"
 * button and read by nothing at all until 2026-08-21 — no screen, no function —
 * so every issue any member ever reported sat unread. firestore.rules gained an
 * admin read and a collection-group read for it in the same change.
 */
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db } from './firebase';
import { HOURS_PLACEHOLDER } from './loungeData';

const functions = getFunctions(app);

// ---------------------------------------------------------------- dashboard

export type Health = {
  lounges: number;
  placeholderHours: number;
  claimed: number;
  members: number;
  verified: number;
  pendingVerifications: number;
  rejected: number;
  pendingClaims: number;
  reviews: number;
  openReports: number;
  cityStatsGeneratedAt: Date | null;
  cityStatsCities: number;
};

/**
 * The numbers for the dashboard, all as server-side counts.
 *
 * `getCountFromServer` bills one read per query rather than one per document, so
 * this whole page costs about a dozen reads instead of the 8,496 it would take to
 * count in the browser. That distinction is the entire reason the mobile app had
 * to be rewritten in August, so it is worth honouring here from the start.
 *
 * Counts that Firestore cannot express — lounges with no phone, no photos, no
 * city — are deliberately absent. Each would need a full collection scan, and
 * spending 8,496 reads to render a number nobody asked for is the exact mistake
 * this pattern exists to avoid. The Lounges page reports those, where the admin
 * has actually asked for them.
 */
export async function fetchHealth(): Promise<Health> {
  const lounges = collection(db, 'lounges');
  const users = collection(db, 'users');

  const [
    loungeCount,
    placeholder,
    claimed,
    memberCount,
    verified,
    pending,
    rejected,
    pendingClaims,
    reviews,
    reportsTotal,
    reportsResolved,
    cityStats,
  ] = await Promise.all([
    getCountFromServer(lounges),
    getCountFromServer(query(lounges, where('hours', '==', HOURS_PLACEHOLDER))),
    getCountFromServer(query(lounges, where('ownerId', '!=', null))),
    getCountFromServer(users),
    getCountFromServer(query(users, where('ageVerification.status', '==', 'verified'))),
    getCountFromServer(query(users, where('ageVerification.status', '==', 'pending'))),
    getCountFromServer(query(users, where('ageVerification.status', '==', 'rejected'))),
    getCountFromServer(query(lounges, where('claimStatus', '==', 'pending'))),
    getCountFromServer(collectionGroup(db, 'reviews')),
    // Total and resolved counted separately, then subtracted. A direct
    // `where('resolved','!=',true)` looks right and is wrong: Firestore's `!=`
    // excludes documents where the field is ABSENT, and an unresolved report has
    // no `resolved` field at all — so it would have reported 0 open reports no
    // matter how many were waiting, which is precisely the failure this page
    // exists to end.
    getCountFromServer(collectionGroup(db, 'issueReports')),
    getCountFromServer(query(collectionGroup(db, 'issueReports'), where('resolved', '==', true))),
    getDocs(query(collection(db, 'aggregates'), where('__name__', '==', 'cityStats'))),
  ]);

  const stats = cityStats.docs[0]?.data() as
    | { generatedAt?: Timestamp; cities?: unknown[] }
    | undefined;

  return {
    lounges: loungeCount.data().count,
    placeholderHours: placeholder.data().count,
    claimed: claimed.data().count,
    members: memberCount.data().count,
    verified: verified.data().count,
    pendingVerifications: pending.data().count,
    rejected: rejected.data().count,
    pendingClaims: pendingClaims.data().count,
    reviews: reviews.data().count,
    openReports: reportsTotal.data().count - reportsResolved.data().count,
    cityStatsGeneratedAt: stats?.generatedAt ? stats.generatedAt.toDate() : null,
    cityStatsCities: Array.isArray(stats?.cities) ? stats!.cities!.length : 0,
  };
}

// ---------------------------------------------------------------- members

export type Member = {
  uid: string;
  name?: string;
  email?: string;
  memberSince?: Timestamp;
  status: string;
  dateOfBirth?: string;
  deferred: boolean;
};

/**
 * Every member document.
 *
 * Not paginated, because there are 11 of them. Worth revisiting at a few thousand
 * — the cursor machinery on the Lounges page is the pattern to copy — but building
 * it now would be scaffolding around nothing.
 */
export async function fetchMembers(): Promise<Member[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs
    .map(document => {
      const data = document.data() as {
        name?: string;
        email?: string;
        memberSince?: Timestamp;
        ageVerification?: { status?: string; dateOfBirth?: string; deferredAt?: Timestamp };
      };
      return {
        uid: document.id,
        name: data.name,
        email: data.email,
        memberSince: data.memberSince,
        status: data.ageVerification?.status ?? 'no record',
        dateOfBirth: data.ageVerification?.dateOfBirth,
        deferred: !!data.ageVerification?.deferredAt,
      };
    })
    .sort((a, b) => (b.memberSince?.seconds ?? 0) - (a.memberSince?.seconds ?? 0));
}

/**
 * Takes a verification back off a member, returning them to pending.
 *
 * Pending rather than rejected: rejecting implies somebody looked at the document
 * and refused it, which is a different statement from "this needs looking at
 * again".
 */
export async function revokeVerification(uid: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      ageVerification: {
        status: 'pending',
        reviewedAt: Timestamp.now(),
        reviewedBy: auth.currentUser?.uid ?? 'admin-portal',
      },
    },
    { merge: true },
  );
}

/** Deletes the Auth account, the documents and the ID photos. Server-side only. */
export async function deleteMember(uid: string): Promise<{
  filesDeleted: number;
  authDeleted: boolean;
}> {
  const call = httpsCallable<{ userId: string }, { filesDeleted: number; authDeleted: boolean }>(
    functions,
    'adminDeleteMember',
  );
  return (await call({ userId: uid })).data;
}

// ---------------------------------------------------------------- reports

export type IssueReport = {
  id: string;
  path: string;
  userId: string;
  subject?: string;
  message?: string;
  loungeId?: string;
  createdAt?: Timestamp;
  resolved?: boolean;
};

/** Issue reports across every member — the collection nothing had ever read. */
export async function fetchReports(): Promise<IssueReport[]> {
  const snapshot = await getDocs(query(collectionGroup(db, 'issueReports'), limit(200)));
  return snapshot.docs
    .map(document => {
      const data = document.data() as Omit<IssueReport, 'id' | 'path' | 'userId'>;
      // The parent of the subcollection is the user document, so the uid comes
      // from the path — a collection-group query does not carry it otherwise.
      const userId = document.ref.parent.parent?.id ?? 'unknown';
      return { ...data, id: document.id, path: document.ref.path, userId };
    })
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function resolveReport(path: string, resolved: boolean): Promise<void> {
  await setDoc(doc(db, path), { resolved, resolvedAt: Timestamp.now() }, { merge: true });
}

// ---------------------------------------------------------------- reviews

export type AdminReview = {
  id: string;
  path: string;
  loungeId: string;
  userId?: string;
  userName?: string;
  rating?: number;
  text?: string;
  createdAt?: Timestamp;
};

export async function fetchReviews(): Promise<AdminReview[]> {
  const snapshot = await getDocs(query(collectionGroup(db, 'reviews'), limit(200)));
  return snapshot.docs
    .map(document => {
      const data = document.data() as Omit<AdminReview, 'id' | 'path' | 'loungeId'>;
      return {
        ...data,
        id: document.id,
        path: document.ref.path,
        loungeId: document.ref.parent.parent?.id ?? 'unknown',
      };
    })
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

/**
 * Removes a review.
 *
 * firestore.rules only lets the author delete their own review, so this succeeds
 * for an admin solely because `isAdmin()` is not part of that path — meaning it
 * will fail. Left as a real call rather than hidden: the Reviews page surfaces the
 * error, and the rule needs widening deliberately rather than as a side effect of
 * building a page. See the note on the Reviews page.
 */
export async function deleteReview(path: string): Promise<void> {
  await deleteDoc(doc(db, path));
}

// ---------------------------------------------------------------- operations

export async function backfillCities(dryRun: boolean): Promise<{
  missing: number;
  parsed: number;
  unparseable: number;
  unparseableSamples: string[];
}> {
  const call = httpsCallable<
    { dryRun: boolean },
    { missing: number; parsed: number; unparseable: number; unparseableSamples: string[] }
  >(functions, 'adminBackfillCities');
  return (await call({ dryRun })).data;
}

export async function rebuildCityStats(): Promise<{ cities: number; lounges: number }> {
  const call = httpsCallable<Record<string, never>, { cities: number; lounges: number }>(
    functions,
    'adminRebuildCityStats',
  );
  return (await call({})).data;
}
