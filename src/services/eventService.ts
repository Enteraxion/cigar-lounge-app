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
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from '@react-native-firebase/firestore';
import type { EventDocument } from '../types/firestore';

const db = getFirestore();

export type LoungeEvent = EventDocument & { id: string };

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
