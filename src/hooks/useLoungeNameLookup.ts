/**
 * useLoungeNameLookup
 *
 * Shared by the AI Concierge screens (ConciergeHomeScreen,
 * ConciergeConversationScreen, ConciergeResultsScreen) to bridge mock
 * recommendation cards to real Firestore lounges. Concierge recommendation
 * *content* (which lounges get suggested, why, in what order) is still
 * mock data — see src/data/mockConcierge.ts — since wiring a real
 * recommendation model is out of scope for this pass. But tapping a card
 * should open a real lounge whenever the mock card happens to name one
 * that actually exists, rather than always dead-ending on LoungeDetail's
 * "not found" state (the mock card's own `id` is never a real Firestore
 * lounge id).
 *
 * This hook fetches every real lounge and exposes a case-insensitive exact
 * name -> id lookup. That is **not** cheap — the collection is 8,294
 * documents / ~6.8 MB (the "cheap at this app's current scale" this comment
 * used to claim stopped being true when the Yelp/Google import ran). It is
 * tolerable only because this hook is confined to the Concierge screens,
 * which are not tabs, and because loungeService caches the fetch. Anything
 * that needs lounges by *place* should use getLoungesNear instead.
 *
 * It's a best-effort bridge, not real search: no
 * fuzzy matching, no backend change. Once Concierge has real recommendation
 * data this whole lookup becomes unnecessary.
 */

import { useEffect, useState } from 'react';
import { getAllLounges } from '../services/loungeService';

export function useLoungeNameLookup() {
  const [nameToId, setNameToId] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllLounges()
      .then(lounges => {
        if (cancelled) return;
        const lookup = new Map<string, string>();
        for (const lounge of lounges) {
          lookup.set(lounge.name.trim().toLowerCase(), lounge.id);
        }
        setNameToId(lookup);
      })
      .catch(() => {
        // Best-effort only — leave nameToId null so lookups just miss and
        // callers fall back to the "not available" alert.
        if (!cancelled) {
          setNameToId(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Real Firestore lounge id for a mock card's name, or null if no match. */
  const findRealLoungeId = (name: string): string | null => {
    return nameToId?.get(name.trim().toLowerCase()) ?? null;
  };

  return { findRealLoungeId, loading: nameToId === null };
}
