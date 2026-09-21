import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Lounge, LoungeDocument } from './types';

/**
 * Lounges the signed-in account owns or has a pending claim on. Shared by
 * the sidebar (lounge switcher) and the dashboard (per-lounge summaries) —
 * extracted from DashboardPage rather than duplicated, since both need the
 * same owned-or-claimed query (see DashboardPage's comment on why it's two
 * queries merged by id: ownership and a claim are not the same thing).
 */
export function useOwnedLounges() {
  const [loading, setLoading] = useState(true);
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const owned = query(collection(db, 'lounges'), where('ownerId', '==', userId));
    const claimed = query(collection(db, 'lounges'), where('claimantUserId', '==', userId));

    Promise.all([getDocs(owned), getDocs(claimed)])
      .then(([ownedSnap, claimedSnap]) => {
        const byId = new Map<string, Lounge>();
        for (const d of [...ownedSnap.docs, ...claimedSnap.docs]) {
          byId.set(d.id, { id: d.id, ...(d.data() as LoungeDocument) });
        }
        setLounges([...byId.values()]);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return { loading, lounges };
}
