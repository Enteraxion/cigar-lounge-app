/**
 * Reading the lounge directory — 8,496 documents — for the admin table.
 *
 * Two hard constraints shape everything here, both measured against the real
 * project rather than assumed:
 *
 * **1. Firestore cannot query for an absent field.** The most useful filters an
 * admin wants are exactly that: lounges with no phone number, no photos, no city.
 * `where('phone', '==', null)` does not match a document that simply has no
 * `phone` key. So those filters are done by paging through documents and testing
 * each one in JS. That is only viable because the gaps are large — a filter
 * matching 39% of the collection fills a page of 25 almost immediately. It would
 * be hopeless for a rare filter, which is why the two rare ones below use real
 * queries instead.
 *
 * **2. Some combinations need composite indexes, and one is outright refused.**
 * Measured: `where('ownerId','!=',null).orderBy('__name__')` fails with "order by
 * clause cannot contain more fields after the key", and
 * `where('city','==',x).orderBy('name')` demands a composite index. So the
 * queries here stay deliberately plain — one equality filter, ordered by document
 * id — which needs no index at all.
 *
 * WHAT THE DATA ACTUALLY LOOKS LIKE (2026-08-21):
 *   phone     absent on all 8,496
 *   hours     5,080 still on the literal string "Hours not yet available"
 *   images    absent or empty on 4,163 — and only 20 of the 3,328 Google-sourced
 *             documents have any at all
 *   city      absent on all 3,328 Google-sourced documents, so those lounges are
 *             invisible to every city-based search in the app
 *   state     absent on all 8,496; the app parses it out of "Houston, TX"
 */
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

/** The exact string the imports leave behind when no real hours were available. */
export const HOURS_PLACEHOLDER = 'Hours not yet available';

export type AdminLounge = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  hours?: string;
  images?: string[];
  ownerId?: string;
  claimStatus?: string;
  ratings?: { overall?: number } | number;
  tags?: string[];
  /** Derived: which import produced this document. */
  source: 'google' | 'yelp';
};

export type GapFilter =
  | 'none'
  | 'no-phone'
  | 'placeholder-hours'
  | 'no-photos'
  | 'no-city'
  | 'claimed';

export type SourceFilter = 'all' | 'google' | 'yelp';

const PAGE_SIZE = 25;
/**
 * How many documents a scanning filter or a name search will read before giving
 * up. Each one is a billed read, and an admin who types three letters should not
 * quietly cost 8,496 reads — so the UI reports how far it got instead of
 * pretending it searched everything.
 */
const SCAN_LIMIT = 1500;

function toLounge(snapshot: QueryDocumentSnapshot): AdminLounge {
  const data = snapshot.data() as Omit<AdminLounge, 'id' | 'source'>;
  return {
    ...data,
    id: snapshot.id,
    source: snapshot.id.startsWith('google-') ? 'google' : 'yelp',
  };
}

/** Whether a lounge satisfies a filter that Firestore itself cannot express. */
function matchesGap(lounge: AdminLounge, gap: GapFilter): boolean {
  switch (gap) {
    case 'no-phone':
      return !lounge.phone;
    case 'no-photos':
      return !Array.isArray(lounge.images) || lounge.images.length === 0;
    case 'no-city':
      return !lounge.city;
    case 'placeholder-hours':
      return !lounge.hours || lounge.hours.includes(HOURS_PLACEHOLDER);
    default:
      return true;
  }
}

function matchesSource(lounge: AdminLounge, source: SourceFilter): boolean {
  return source === 'all' || lounge.source === source;
}

export type Page = {
  rows: AdminLounge[];
  /** Pass back to fetchPage to get the next page; null when the end is reached. */
  cursor: DocumentSnapshot | null;
  /** How many documents were read to build this page — the real cost. */
  read: number;
  /** True when a scanning filter stopped at SCAN_LIMIT rather than the end. */
  truncated: boolean;
};

/**
 * One page of the table.
 *
 * `claimed` and `placeholder-hours` are served by real Firestore queries because
 * both are expressible and one of them is rare — scanning for 3 claimed lounges
 * among 8,496 would read the whole collection to fill a page. Everything else
 * scans, for the reason in the header.
 */
export async function fetchPage(options: {
  gap: GapFilter;
  source: SourceFilter;
  search: string;
  after?: DocumentSnapshot | null;
}): Promise<Page> {
  const { gap, source, search, after } = options;
  const term = search.trim().toLowerCase();

  // --- the two filters Firestore can answer directly ---
  if (gap === 'claimed') {
    // No orderBy: adding one to a `!=` query is rejected outright (measured).
    const snapshot = await getDocs(query(collection(db, 'lounges'), where('ownerId', '!=', null)));
    const rows = snapshot.docs
      .map(toLounge)
      .filter(l => matchesSource(l, source))
      .filter(l => !term || l.name?.toLowerCase().includes(term));
    return { rows, cursor: null, read: snapshot.size, truncated: false };
  }

  if (gap === 'placeholder-hours' && !term && source === 'all') {
    const base = query(
      collection(db, 'lounges'),
      where('hours', '==', HOURS_PLACEHOLDER),
      orderBy('__name__'),
      limit(PAGE_SIZE),
    );
    const snapshot = await getDocs(after ? query(base, startAfter(after)) : base);
    return {
      rows: snapshot.docs.map(toLounge),
      cursor: snapshot.size === PAGE_SIZE ? snapshot.docs[snapshot.size - 1] : null,
      read: snapshot.size,
      truncated: false,
    };
  }

  // --- everything else: page through and test in JS ---
  const rows: AdminLounge[] = [];
  let read = 0;
  let cursor: DocumentSnapshot | null = after ?? null;
  let exhausted = false;

  while (rows.length < PAGE_SIZE && read < SCAN_LIMIT && !exhausted) {
    const base = query(collection(db, 'lounges'), orderBy('__name__'), limit(100));
    const snapshot = await getDocs(cursor ? query(base, startAfter(cursor)) : base);
    read += snapshot.size;
    if (snapshot.size === 0) {
      exhausted = true;
      break;
    }
    cursor = snapshot.docs[snapshot.size - 1];
    if (snapshot.size < 100) {
      exhausted = true;
    }
    for (const document of snapshot.docs) {
      const lounge = toLounge(document);
      if (!matchesSource(lounge, source)) continue;
      if (!matchesGap(lounge, gap)) continue;
      if (term && !lounge.name?.toLowerCase().includes(term)) continue;
      rows.push(lounge);
      if (rows.length >= PAGE_SIZE) break;
    }
  }

  return {
    rows,
    cursor: exhausted ? null : cursor,
    read,
    truncated: !exhausted && rows.length < PAGE_SIZE,
  };
}

/**
 * The headline counts, for the toolbar.
 *
 * Only the two that a server-side aggregation can answer. The absence counts
 * (no phone, no photos, no city) cannot be counted without reading every
 * document, and spending 8,496 reads to render a number nobody asked for would be
 * the exact mistake the mobile app already had to undo.
 */
export async function fetchCounts(): Promise<{ total: number; placeholderHours: number }> {
  const [total, placeholder] = await Promise.all([
    getCountFromServer(collection(db, 'lounges')),
    getCountFromServer(
      query(collection(db, 'lounges'), where('hours', '==', HOURS_PLACEHOLDER)),
    ),
  ]);
  return {
    total: total.data().count,
    placeholderHours: placeholder.data().count,
  };
}

/**
 * Edits the fields an admin may correct.
 *
 * Restricted to the same set firestore.rules lets an owner change via
 * `isOwnListingEdit` — description, hours, priceRange, amenities — plus the two
 * gaps this table exists to surface. An admin write is permitted on any field by
 * `isAdmin()`, so the limit here is editorial rather than enforced: name, address
 * and coordinates come from the imports and hand-editing them would be silently
 * undone by the next refresh of that city.
 */
export async function updateLounge(
  loungeId: string,
  updates: Partial<Pick<AdminLounge, 'phone' | 'hours' | 'city'>> & { description?: string },
): Promise<void> {
  await updateDoc(doc(db, 'lounges', loungeId), { ...updates, updatedAt: new Date() });
}
