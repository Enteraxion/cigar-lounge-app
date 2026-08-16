/**
 * eventService
 *
 * Read access to a lounge's owner-posted events (see
 * src/types/firestore.ts's EventDocument). Events are authored entirely
 * from the Owner Portal — the mobile app only ever reads them, which is
 * why there's no create/update here to match reservationService's shape.
 */

import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
  limit,
  query,
  where,
  orderBy,
  Timestamp,
} from '@react-native-firebase/firestore';
import type { EventDocument } from '../types/firestore';

const db = getFirestore();

export type LoungeEvent = EventDocument & { id: string };

/** An event plus the lounge hosting it, for cross-lounge listings. */
export type MemberEvent = LoungeEvent & { loungeId: string; loungeName?: string };

/**
 * Upcoming events for a lounge, soonest first. Past events are filtered
 * out in the query rather than client-side so a lounge with years of
 * history doesn't drag them all down to the device.
 */
export async function getUpcomingEvents(loungeId: string): Promise<LoungeEvent[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'lounges', loungeId, 'events'),
      where('startsAt', '>=', Timestamp.now()),
      orderBy('startsAt', 'asc'),
    ),
  );
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as EventDocument) }));
}

/**
 * Upcoming events across every lounge, soonest first — HomeScreen's
 * "Member Events" rail, which previously showed two invented events
 * ("Single Malt & Habano Night" at a venue called The Reserve) that
 * every member saw identically and that no shop had ever posted.
 *
 * A collectionGroup query so one round trip covers all lounges instead
 * of one per lounge; `limit` keeps it cheap since the rail only shows a
 * handful. The parent lounge id comes off the document path rather than
 * being duplicated onto each event, so an event never disagrees with
 * where it actually lives.
 */
export async function getUpcomingEventsAcrossLounges(max = 10): Promise<MemberEvent[]> {
  const snapshot = await getDocs(
    query(
      collectionGroup(db, 'events'),
      where('startsAt', '>=', Timestamp.now()),
      orderBy('startsAt', 'asc'),
      limit(max),
    ),
  );
  return snapshot.docs.map(d => ({
    id: d.id,
    loungeId: d.ref.parent.parent?.id ?? '',
    ...(d.data() as EventDocument),
  }));
}
