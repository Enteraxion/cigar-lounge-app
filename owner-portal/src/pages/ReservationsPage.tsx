import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import type { Lounge, Reservation, ReservationDocument } from '../lib/types';

/**
 * The owner-facing side of the mobile app's "Reserve a Table" flow. Until
 * this page existed, reservations were effectively write-only: the app
 * wrote them to Firestore and emailed the lounge, but no owner could ever
 * log in and see the list. Julian Brinkley's ask (2026-08-05 meeting) was
 * that shops be able to "indicate that they recognize when somebody has
 * reserved a table" — that's the Acknowledge button below.
 *
 * Upcoming vs past is split on the reservation's own `date`, and the list
 * is sorted client-side rather than with an orderBy query to avoid needing
 * a composite Firestore index for what is a small per-lounge collection.
 */
export default function ReservationsPage() {
  const { loungeId } = useParams<{ loungeId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loungeName, setLoungeName] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loungeId) return;
    Promise.all([
      getDoc(doc(db, 'lounges', loungeId)),
      getDocs(collection(db, 'lounges', loungeId, 'reservations')),
    ])
      .then(([loungeSnap, reservationSnap]) => {
        if (loungeSnap.exists()) setLoungeName((loungeSnap.data() as Lounge).name);
        const rows = reservationSnap.docs.map(d => ({
          id: d.id,
          ...(d.data() as ReservationDocument),
        }));
        rows.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
        setReservations(rows);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [loungeId]);

  const acknowledge = async (reservationId: string) => {
    if (!loungeId) return;
    setAcknowledgingId(reservationId);
    try {
      const now = Timestamp.now();
      await updateDoc(doc(db, 'lounges', loungeId, 'reservations', reservationId), {
        acknowledgedAt: now,
      });
      setReservations(current =>
        current.map(r => (r.id === reservationId ? { ...r, acknowledgedAt: now } : r)),
      );
    } catch {
      // Left un-acknowledged so the owner can retry; no destructive change.
    } finally {
      setAcknowledgingId(null);
    }
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = reservations.filter(r => r.date.toDate() >= startOfToday);
  const past = reservations.filter(r => r.date.toDate() < startOfToday);

  const renderRow = (reservation: Reservation, isPast: boolean) => {
    const acknowledged = !!reservation.acknowledgedAt;
    return (
      <div key={reservation.id} className={`card ${isPast ? 'card--muted' : ''}`}>
        <div className="card__head">
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 2 }}>{reservation.guestName}</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              Party of {reservation.partySize} ·{' '}
              {reservation.date.toDate().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}{' '}
              at {reservation.timeSlot}
            </p>
          </div>
          <span className={`pill ${acknowledged ? 'pill--done' : 'pill--new'}`}>
            {acknowledged ? 'Acknowledged' : 'New'}
          </span>
        </div>

        <p className="muted" style={{ fontSize: 13, marginTop: 'var(--space-md)' }}>
          {reservation.contactPhone}
        </p>

        {reservation.notes && (
          <p
            style={{
              fontSize: 13,
              fontStyle: 'italic',
              color: 'var(--silver)',
              margin: 'var(--space-sm) 0 0',
              paddingLeft: 10,
              borderLeft: '2px solid var(--gold)',
            }}
          >
            “{reservation.notes}”
          </p>
        )}

        {!acknowledged && (
          <button
            className="btn btn--primary btn--block"
            style={{ marginTop: 'var(--space-md)' }}
            onClick={() => acknowledge(reservation.id)}
            disabled={acknowledgingId === reservation.id}
          >
            {acknowledgingId === reservation.id ? 'Saving…' : 'Acknowledge'}
          </button>
        )}
      </div>
    );
  };

  return (
    <AppShell eyebrow={loungeName} title="Reservations" backTo="/">
      {loading ? (
        <p className="muted">Loading…</p>
      ) : loadError ? (
        <div className="empty">Couldn't load reservations.</div>
      ) : reservations.length === 0 ? (
        <div className="empty">
          No reservations yet. When someone books a table in the app, it will appear here.
        </div>
      ) : (
        <>
          <h2 className="section-title">Upcoming ({upcoming.length})</h2>
          {upcoming.length === 0 ? (
            <p className="muted">Nothing coming up.</p>
          ) : (
            <div className="stack">{upcoming.map(r => renderRow(r, false))}</div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="section-title">Past ({past.length})</h2>
              <div className="stack">{past.map(r => renderRow(r, true))}</div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
