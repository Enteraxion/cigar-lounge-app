import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import type { EventDocument, Lounge, LoungeEvent } from '../lib/types';

/**
 * Owner-authored events — the last of the four things Julian Brinkley
 * asked the Owner Portal to do in the 2026-08-05 meeting ("they can
 * basically post events").
 *
 * He didn't define what an event is beyond that, so this is a
 * deliberately small first shape to react to: title, description, and a
 * start date/time, shown on the lounge's detail screen in the app. No
 * RSVP, ticketing, capacity, or recurrence — all of those are real
 * product decisions rather than details, and none of them exist anywhere
 * else in the app to build on yet.
 *
 * Events are a subcollection, so each save is a single addDoc rather than
 * rewriting a whole array the way the Inventory page does.
 */
export default function EventsPage() {
  const { loungeId } = useParams<{ loungeId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loungeName, setLoungeName] = useState('');
  const [events, setEvents] = useState<LoungeEvent[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEvents = async (id: string) => {
    const snapshot = await getDocs(
      query(collection(db, 'lounges', id, 'events'), orderBy('startsAt', 'asc')),
    );
    setEvents(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as EventDocument) })));
  };

  useEffect(() => {
    if (!loungeId) return;
    Promise.all([getDoc(doc(db, 'lounges', loungeId)), loadEvents(loungeId)])
      .then(([loungeSnap]) => {
        if (loungeSnap.exists()) setLoungeName((loungeSnap.data() as Lounge).name);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [loungeId]);

  const addEvent = async () => {
    if (!loungeId) return;
    if (!title.trim()) {
      setFormError('Give the event a title.');
      return;
    }
    if (!startsAt) {
      setFormError('Pick a date and time.');
      return;
    }
    const startsAtDate = new Date(startsAt);
    if (Number.isNaN(startsAtDate.getTime())) {
      setFormError("That date doesn't look right.");
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      await addDoc(collection(db, 'lounges', loungeId, 'events'), {
        title: title.trim(),
        description: description.trim(),
        startsAt: Timestamp.fromDate(startsAtDate),
        createdAt: Timestamp.now(),
      });
      setTitle('');
      setDescription('');
      setStartsAt('');
      await loadEvents(loungeId);
    } catch {
      setFormError("Couldn't save the event. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (eventId: string) => {
    if (!loungeId) return;
    setDeletingId(eventId);
    try {
      await deleteDoc(doc(db, 'lounges', loungeId, 'events', eventId));
      setEvents(current => current.filter(e => e.id !== eventId));
    } catch {
      // Row stays put so the owner can retry — nothing destructive happened.
    } finally {
      setDeletingId(null);
    }
  };

  const now = new Date();
  const upcoming = events.filter(e => e.startsAt.toDate() >= now);
  const past = events.filter(e => e.startsAt.toDate() < now);

  const renderEvent = (event: LoungeEvent, isPast: boolean) => (
    <div key={event.id} className={`card ${isPast ? 'card--muted' : ''}`}>
      <div className="card__head">
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>{event.title}</h2>
          <p style={{ fontSize: 13, color: 'var(--gold)', margin: 0 }}>
            {event.startsAt.toDate().toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <button
          className="btn btn--danger"
          onClick={() => removeEvent(event.id)}
          disabled={deletingId === event.id}
        >
          {deletingId === event.id ? 'Removing…' : 'Remove'}
        </button>
      </div>
      {event.description && (
        <p style={{ fontSize: 13, color: 'var(--silver)', margin: 'var(--space-sm) 0 0' }}>
          {event.description}
        </p>
      )}
    </div>
  );

  return (
    <AppShell
      eyebrow={loungeName}
      title="Events"
      subtitle="Events you post appear on your listing in the app for anyone browsing it."
      backTo="/"
    >
      {loading ? (
        <p className="muted">Loading…</p>
      ) : loadError ? (
        <div className="empty">Couldn't load events.</div>
      ) : (
        <>
          {/* ---- New event ---- */}
          <div className="card">
            <span className="card__label">New event</span>

            <div className="stack stack--tight" style={{ marginTop: 'var(--space-md)' }}>
              <label className="field">
                <span className="field__label">Title</span>
                <input
                  className="input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Padrón Tasting Night"
                />
              </label>

              <label className="field">
                <span className="field__label">Date &amp; time</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                />
              </label>

              <label className="field">
                <span className="field__label">Description (optional)</span>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What should guests know?"
                  rows={3}
                />
              </label>

              {formError && <p className="msg msg--error">{formError}</p>}

              <button className="btn btn--primary btn--block" onClick={addEvent} disabled={saving}>
                {saving ? 'Posting…' : 'Post Event'}
              </button>
            </div>
          </div>

          <h2 className="section-title">Upcoming ({upcoming.length})</h2>
          {upcoming.length === 0 ? (
            <div className="empty">Nothing scheduled yet.</div>
          ) : (
            <div className="stack">{upcoming.map(e => renderEvent(e, false))}</div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="section-title">Past ({past.length})</h2>
              <div className="stack">{past.map(e => renderEvent(e, true))}</div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
