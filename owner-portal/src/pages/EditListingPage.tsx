import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import type { Lounge } from '../lib/types';

/**
 * Same fields, and the same Firestore write path, as the mobile app's
 * EditListingScreen — deliberately, so an owner gets the same result
 * whichever surface they use. `firestore.rules`'s isOwnListingEdit is
 * what actually constrains which fields can change.
 */
export default function EditListingPage() {
  const { loungeId } = useParams<{ loungeId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [amenitiesText, setAmenitiesText] = useState('');
  const [loungeName, setLoungeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!loungeId) return;
    getDoc(doc(db, 'lounges', loungeId))
      .then(snapshot => {
        if (!snapshot.exists()) {
          setLoadError(true);
          return;
        }
        const lounge = snapshot.data() as Lounge;
        setLoungeName(lounge.name);
        setDescription(lounge.description ?? '');
        setHours(lounge.hours ?? '');
        setPriceRange(lounge.priceRange ?? '');
        setAmenitiesText((lounge.amenities ?? []).join(', '));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [loungeId]);

  const save = async () => {
    if (!loungeId || !auth.currentUser) return;
    if (!description.trim() || !hours.trim()) {
      setSaveError('Description and Hours are required.');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'lounges', loungeId), {
        description: description.trim(),
        hours: hours.trim(),
        priceRange: priceRange.trim(),
        amenities: amenitiesText
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
        updatedAt: Timestamp.now(),
      });
      navigate('/');
    } catch {
      setSaveError("Couldn't save changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      eyebrow={loungeName}
      title="Edit Listing"
      subtitle="This is what guests see on your business's page in the Lounge Locator app."
      backTo="/"
    >
      {loading ? (
        <p className="muted">Loading…</p>
      ) : loadError ? (
        <div className="empty">Couldn't load this listing.</div>
      ) : (
        <div className="card">
          <div className="stack">
            <label className="field">
              <span className="field__label">Description</span>
              <textarea
                className="textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell customers about your business"
                rows={4}
              />
            </label>

            <label className="field">
              <span className="field__label">Hours</span>
              <input
                className="input"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="e.g. Mon–Sat 11am–11pm"
              />
            </label>

            <label className="field">
              <span className="field__label">Price Range</span>
              <input
                className="input"
                value={priceRange}
                onChange={e => setPriceRange(e.target.value)}
                placeholder="e.g. $$$"
              />
            </label>

            <label className="field">
              <span className="field__label">Amenities</span>
              <input
                className="input"
                value={amenitiesText}
                onChange={e => setAmenitiesText(e.target.value)}
                placeholder="e.g. Full Bar, Private Rooms, Valet Parking"
              />
              <span className="field__hint">Separate each amenity with a comma.</span>
            </label>

            {saveError && <p className="msg msg--error">{saveError}</p>}

            <button className="btn btn--primary btn--block" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
