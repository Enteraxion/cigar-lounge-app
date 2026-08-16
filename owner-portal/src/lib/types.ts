/**
 * Minimal subset of the mobile app's LoungeDocument shape (see
 * ../../src/types/firestore.ts) — duplicated rather than imported since
 * this portal is a separate deployable app with its own `npm install`,
 * same reasoning as functions/src/index.ts duplicating the schema.
 * Only the fields this portal actually reads/writes are included.
 */
import type { Timestamp } from 'firebase/firestore';

export type HumidorStockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

/** Mirrors the mobile app's HumidorItem (../../src/types/firestore.ts). */
export type HumidorItem = {
  name: string;
  image: string;
  strength: string;
  origin: string;
  price: string;
  stockStatus: HumidorStockStatus;
};

export type LoungeDocument = {
  name: string;
  address: string;
  description: string;
  hours: string;
  priceRange: string;
  amenities: string[];
  humidorItems?: HumidorItem[];
  ownerId?: string;
  ownerName?: string;
  ownerContactEmail?: string;
  claimantUserId?: string;
  claimStatus?: 'pending';
  updatedAt?: Timestamp;
};

export type Lounge = LoungeDocument & { id: string };

/**
 * Mirrors the mobile app's ReservationDocument (../../src/types/firestore.ts),
 * same duplicate-rather-than-import reasoning as LoungeDocument above.
 * `acknowledgedAt` is the one field this portal writes — see
 * ReservationsPage.
 */
export type ReservationDocument = {
  userId: string;
  guestName: string;
  contactPhone: string;
  partySize: number;
  date: Timestamp;
  timeSlot: string;
  notes?: string;
  createdAt: Timestamp;
  acknowledgedAt?: Timestamp;
};

export type Reservation = ReservationDocument & { id: string };

/** Mirrors the mobile app's EventDocument (../../src/types/firestore.ts). */
export type EventDocument = {
  title: string;
  description: string;
  startsAt: Timestamp;
  endsAt?: Timestamp;
  imageUrl?: string;
  createdAt: Timestamp;
};

export type LoungeEvent = EventDocument & { id: string };
