import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import { useOwnedLounges } from '../lib/useOwnedLounges';
import type { Lounge, ReservationDocument, EventDocument } from '../lib/types';

/**
 * At-a-glance summary per claimed listing: a row of clickable stat tiles
 * (Kiki Momo's overview-page pattern — uppercase micro-label + a big
 * number, the whole tile is the link) instead of the previous stat-grid
 * plus a separate row of buttons pointing at the same destinations.
 */
type LoungeSummary = {
  lounge: Lounge;
  newReservations: number;
  totalReservations: number;
  inventoryCount: number;
  upcomingEvents: number;
};

export default function DashboardPage() {
  const { loading: loungesLoading, lounges } = useOwnedLounges();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<LoungeSummary[]>([]);

  useEffect(() => {
    if (loungesLoading) return;
    if (lounges.length === 0) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    const now = new Date();
    Promise.all(
      lounges.map(async lounge => {
        // Reservations and events are only readable once the claim is
        // approved (firestore.rules keys off ownerId), so don't even ask
        // for a pending listing — it would just be a guaranteed denial.
        if (!lounge.ownerId) {
          return {
            lounge,
            newReservations: 0,
            totalReservations: 0,
            inventoryCount: lounge.humidorItems?.length ?? 0,
            upcomingEvents: 0,
          };
        }

        const [reservationSnap, eventSnap] = await Promise.all([
          getDocs(collection(db, 'lounges', lounge.id, 'reservations')),
          getDocs(collection(db, 'lounges', lounge.id, 'events')),
        ]);

        const reservations = reservationSnap.docs.map(d => d.data() as ReservationDocument);
        const events = eventSnap.docs.map(d => d.data() as EventDocument);

        return {
          lounge,
          newReservations: reservations.filter(r => !r.acknowledgedAt).length,
          totalReservations: reservations.length,
          inventoryCount: lounge.humidorItems?.length ?? 0,
          upcomingEvents: events.filter(e => e.startsAt.toDate() >= now).length,
        };
      }),
    )
      .then(setSummaries)
      .finally(() => setLoading(false));
  }, [loungesLoading, lounges]);

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Your Listings"
      subtitle="Manage how your business appears in Lounge Locator, and keep on top of bookings."
    >
      {loungesLoading || loading ? (
        <p className="muted">Loading…</p>
      ) : summaries.length === 0 ? (
        <div className="empty">
          No claim found for this account yet. Claim your business from the Lounge Locator app and it
          will appear here.
        </div>
      ) : (
        <div className="stack">
          {summaries.map(({ lounge, newReservations, totalReservations, inventoryCount, upcomingEvents }) => {
            const isApproved = !!lounge.ownerId;
            return (
              <div key={lounge.id} className="card">
                <div className="card__head">
                  <div>
                    <h2 style={{ fontSize: 22, marginBottom: 2 }}>{lounge.name}</h2>
                    <p className="muted" style={{ fontSize: 13 }}>
                      {lounge.address}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <span className={`pill ${isApproved ? 'pill--approved' : 'pill--pending'}`}>
                      {isApproved ? 'Approved' : 'Pending Review'}
                    </span>
                    {isApproved && (
                      <Link to={`/listing/${lounge.id}/edit`} className="field__action">
                        Edit Listing
                      </Link>
                    )}
                  </div>
                </div>

                {isApproved ? (
                  <div className="stats">
                    <Link to={`/listing/${lounge.id}/reservations`} className="stat">
                      <span className="stat__value">{totalReservations}</span>
                      <span className="stat__label">Reservations</span>
                      {newReservations > 0 && (
                        <span className="stat__hint">{newReservations} need acknowledging</span>
                      )}
                    </Link>

                    <Link to={`/listing/${lounge.id}/inventory`} className="stat">
                      <span className="stat__value">{inventoryCount}</span>
                      <span className="stat__label">Humidor Items</span>
                      {inventoryCount === 0 && <span className="stat__hint">Add your first</span>}
                    </Link>

                    <Link to={`/listing/${lounge.id}/events`} className="stat">
                      <span className="stat__value">{upcomingEvents}</span>
                      <span className="stat__label">Upcoming Events</span>
                      {upcomingEvents === 0 && <span className="stat__hint">Post an event</span>}
                    </Link>
                  </div>
                ) : (
                  <p className="muted" style={{ marginTop: 'var(--space-md)' }}>
                    We're reviewing your claim. Once it's approved you'll be able to edit this
                    listing, manage your humidor, and see reservations here.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
