import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import type { HumidorItem, HumidorStockStatus, Lounge } from '../lib/types';

/**
 * Humidor inventory editor — Julian Brinkley's ask from the 2026-08-05
 * meeting ("they can enter their inventory ... The main thing is to get
 * set up for shops, for them to be able to basically add inventories").
 *
 * `humidorItems` has existed in the schema since the app was seeded, and
 * the mobile LoungeDetailScreen already renders it as a "Humidor
 * Highlights" rail — but nothing could ever write it: both the Yelp
 * import and refreshCityLounges hardcode an empty array, since neither
 * API has inventory data. An owner filling this in here is the only way
 * a real lounge ever gets one.
 *
 * The whole array is rewritten on save rather than diffed per item —
 * humidorItems is a small inline array on the lounge doc (not a
 * subcollection), so there's nothing to merge and a single updateDoc is
 * both simpler and atomic.
 */

const STOCK_OPTIONS: { value: HumidorStockStatus; label: string }[] = [
  { value: 'in-stock', label: 'In stock' },
  { value: 'low-stock', label: 'Low stock' },
  { value: 'out-of-stock', label: 'Out of stock' },
];

const EMPTY_ITEM: HumidorItem = {
  name: '',
  image: '',
  strength: '',
  origin: '',
  price: '',
  stockStatus: 'in-stock',
};

export default function InventoryPage() {
  const { loungeId } = useParams<{ loungeId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loungeName, setLoungeName] = useState('');
  const [items, setItems] = useState<HumidorItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState('');

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
        setItems(lounge.humidorItems ?? []);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [loungeId]);

  const updateItem = (index: number, patch: Partial<HumidorItem>) => {
    setItems(current => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    setSavedAt('');
  };

  const removeItem = (index: number) => {
    setItems(current => current.filter((_, i) => i !== index));
    setSavedAt('');
  };

  const addItem = () => {
    setItems(current => [...current, { ...EMPTY_ITEM }]);
    setSavedAt('');
  };

  const save = async () => {
    if (!loungeId) return;
    // A nameless cigar is the one field that makes a row meaningless — the
    // rest can reasonably be left blank by an owner in a hurry.
    if (items.some(item => !item.name.trim())) {
      setSaveError('Every cigar needs a name.');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'lounges', loungeId), {
        humidorItems: items.map(item => ({
          name: item.name.trim(),
          image: item.image.trim(),
          strength: item.strength.trim(),
          origin: item.origin.trim(),
          price: item.price.trim(),
          stockStatus: item.stockStatus,
        })),
        updatedAt: Timestamp.now(),
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setSaveError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      eyebrow={loungeName}
      title="Humidor Inventory"
      subtitle="Cigars you add here appear in the “Humidor Highlights” section of your listing in the app."
      backTo="/"
    >
      {loading ? (
        <p className="muted">Loading…</p>
      ) : loadError ? (
        <div className="empty">Couldn't load this listing.</div>
      ) : (
        <>
          {items.length === 0 ? (
            <div className="empty">No cigars added yet.</div>
          ) : (
            <div className="stack">
              {items.map((item, index) => (
                <div key={index} className="card">
                  <div className="card__head">
                    <span className="card__label">Cigar {index + 1}</span>
                    <button className="btn btn--danger" onClick={() => removeItem(index)}>
                      Remove
                    </button>
                  </div>

                  <div className="stack stack--tight" style={{ marginTop: 'var(--space-md)' }}>
                    <label className="field">
                      <span className="field__label">Name</span>
                      <input
                        className="input"
                        value={item.name}
                        onChange={e => updateItem(index, { name: e.target.value })}
                        placeholder="e.g. Padrón 1926 Series"
                      />
                    </label>

                    <div className="field-row">
                      <label className="field">
                        <span className="field__label">Strength</span>
                        <input
                          className="input"
                          value={item.strength}
                          onChange={e => updateItem(index, { strength: e.target.value })}
                          placeholder="e.g. Full"
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">Origin</span>
                        <input
                          className="input"
                          value={item.origin}
                          onChange={e => updateItem(index, { origin: e.target.value })}
                          placeholder="e.g. Nicaragua"
                        />
                      </label>
                    </div>

                    <div className="field-row">
                      <label className="field">
                        <span className="field__label">Price</span>
                        <input
                          className="input"
                          value={item.price}
                          onChange={e => updateItem(index, { price: e.target.value })}
                          placeholder="e.g. $28"
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">Availability</span>
                        <select
                          className="select"
                          value={item.stockStatus}
                          onChange={e =>
                            updateItem(index, {
                              stockStatus: e.target.value as HumidorStockStatus,
                            })
                          }
                        >
                          {STOCK_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="field">
                      <span className="field__label">Photo URL (optional)</span>
                      <input
                        className="input"
                        value={item.image}
                        onChange={e => updateItem(index, { image: e.target.value })}
                        placeholder="https://…"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="stack" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn btn--dashed btn--block" onClick={addItem}>
              + Add a cigar
            </button>

            {saveError && <p className="msg msg--error">{saveError}</p>}
            {savedAt && <p className="msg msg--success">Saved at {savedAt}</p>}

            <button className="btn btn--primary btn--block" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Inventory'}
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
}
