import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import type { Lounge, LoungeDocument, ReservationDocument, EventDocument } from '../lib/types';

/**
 * At-a-glance summary per claimed listing, rather than the bare
 * name-plus-status card this used to be — an owner landing here should be
 * able to see whether anything needs their attention (unacknowledged
 * reservations especially) without opening three sub-pages to find out.
 */
type LoungeSummary = {
  lounge: Lounge;
  newReservations: number;
  totalReservations: number;
  inventoryCount: number;
  upcomingEvents: number;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<LoungeSummary[]>([]);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    // A lounge keeps `claimantUserId` for both a pending and an approved
    // claim (only a rejection clears it — see the mobile app's
    // ownerService.rejectLoungeClaim), so this one query covers either state.
    const q = query(collection(db, 'lounges'), where('claimantUserId', '==', userId));

    getDocs(q)
      .then(async snapshot => {
        const lounges: Lounge[] = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as LoungeDocument),
        }));

        const now = new Date();
        const rows = await Promise.all(
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
        );
        setSummaries(rows);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Your Listings"
      subtitle="Manage how your business appears in Lounge Locator, and keep on top of bookings."
    >
      {loading ? (
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
                  <span className={`pill ${isApproved ? 'pill--approved' : 'pill--pending'}`}>
                    {isApproved ? 'Approved' : 'Pending Review'}
                  </span>
                </div>

                {isApproved ? (
                  <>
                    <div className="stats">
                      <Link to={`/listing/${lounge.id}/reservations`} className="stat">
                        <span className="stat__value">{totalReservations}</span>
                        <span className="stat__label">Reservations</span>
                        {newReservations > 0 && (
                          <span className="stat__hint">
                            {newReservations} need acknowledging
                          </span>
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

                    <div className="btn-row">
                      <Link to={`/listing/${lounge.id}/edit`} className="btn btn--primary">
                        Edit Listing
                      </Link>
                      <Link to={`/listing/${lounge.id}/reservations`} className="btn btn--secondary">
                        Reservations
                      </Link>
                      <Link to={`/listing/${lounge.id}/inventory`} className="btn btn--secondary">
                        Inventory
                      </Link>
                      <Link to={`/listing/${lounge.id}/events`} className="btn btn--secondary">
                        Events
                      </Link>
                    </div>
                  </>
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
