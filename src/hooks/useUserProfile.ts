/**
 * useUserProfile
 *
 * Shared by ProfileScreen and PassportScreen so both show the same real
 * signed-in user data instead of each hardcoding "Alexander Rossi"
 * independently. Combines Firebase Auth (name/email/photo/account
 * creation date — always present for a signed-in user) with the
 * Firestore users/{userId} doc (memberTier/homeCity/favoriteBrand/
 * favoriteLounge/memberSince — NOT guaranteed to exist: real sign-ups
 * never get one created automatically, see SignUpScreen; only the
 * demo-alexander-rossi seed user has a full doc).
 *
 * Auth is treated as the source of truth for identity (name/email/
 * photo) since it's always available and can't drift out of sync the
 * way a manually-maintained Firestore mirror could. Fields with no
 * Firestore value fall back to "Not set" rather than fake data.
 */

import { useCallback, useEffect, useState } from 'react';
import { auth } from '../services/firebaseAuth';
import { getUserProfile } from '../services/userActionsService';
import type { UserDocument } from '../types/firestore';

export const NOT_SET = 'Not set';

export type DisplayProfile = {
  name: string;
  email: string | null;
  avatarUri: string | null;
  memberTier: string;
  homeCity: string;
  favoriteBrand: string;
  favoriteLounge: string;
  memberSince: string;
};

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function buildDisplayProfile(
  authUser: NonNullable<typeof auth.currentUser>,
  firestoreProfile: Partial<UserDocument> | null,
): DisplayProfile {
  const emailLocalPart = authUser.email?.split('@')[0];
  const memberSince = firestoreProfile?.memberSince
    ? formatMonthYear(firestoreProfile.memberSince.toDate())
    : authUser.metadata.creationTime
      ? formatMonthYear(new Date(authUser.metadata.creationTime))
      : NOT_SET;

  return {
    name: authUser.displayName?.trim() || emailLocalPart || 'Member',
    email: authUser.email,
    avatarUri: authUser.photoURL || firestoreProfile?.avatarUrl || null,
    memberTier: firestoreProfile?.memberTier || NOT_SET,
    homeCity: firestoreProfile?.homeCity || NOT_SET,
    favoriteBrand: firestoreProfile?.favoriteBrand || NOT_SET,
    favoriteLounge: firestoreProfile?.favoriteLounge || NOT_SET,
    memberSince,
  };
}

export function useUserProfile() {
  const authUser = auth.currentUser;
  const [firestoreProfile, setFirestoreProfile] = useState<Partial<UserDocument> | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authUser) return;
    setError(null);
    setFirestoreProfile(undefined);
    try {
      setFirestoreProfile(await getUserProfile(authUser.uid));
    } catch {
      setError("Couldn't load your profile. Check your connection and try again.");
      setFirestoreProfile(null);
    }
  }, [authUser]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = authUser != null && firestoreProfile === undefined;
  const profile =
    authUser && firestoreProfile !== undefined
      ? buildDisplayProfile(authUser, firestoreProfile)
      : null;

  return { profile, loading, error, reload: load };
}
