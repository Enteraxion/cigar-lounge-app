import { useEffect, useMemo, useState } from 'react';
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
  updateDoc,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import kioskCatalog from '../data/kioskCatalog.json';
import type { KioskProduct, Lounge, StaffPick, StaffPickDocument } from '../lib/types';

/**
 * Staff Picks — owner-curated highlights from the physical kiosk's real
 * product catalog, shown on the kiosk's home screen ("⭐ Staff Picks / This
 * Week" tile). Picking from kioskCatalog.json (a static snapshot of the
 * kiosk's Product.kt — see scripts/generateKioskCatalog.mjs) rather than
 * free text keeps a pick tied to a real sku the kiosk can resolve locally,
 * the same way Inventory ties a humidor item to real data instead of
 * inventing it.
 */
const CATALOG = kioskCatalog as KioskProduct[];
const SEARCH_LIMIT = 12;

export default function StaffPicksPage() {
  const { loungeId } = useParams<{ loungeId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loungeName, setLoungeName] = useState('');
  const [picks, setPicks] = useState<StaffPick[]>([]);

  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadPicks = async (id: string) => {
    const snapshot = await getDocs(
      query(collection(db, 'lounges', id, 'staffPicks'), orderBy('createdAt', 'desc')),
    );
    const rows = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as StaffPickDocument) }));
    setPicks(rows);
    setNoteDrafts(Object.fromEntries(rows.map(r => [r.id, r.note ?? ''])));
  };

  useEffect(() => {
    if (!loungeId) return;
    Promise.all([getDoc(doc(db, 'lounges', loungeId)), loadPicks(loungeId)])
      .then(([loungeSnap]) => {
        if (loungeSnap.exists()) setLoungeName((loungeSnap.data() as Lounge).name);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [loungeId]);

  const pickedSkus = useMemo(() => new Set(picks.map(p => p.sku)), [picks]);

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return CATALOG.filter(
      p =>
        !pickedSkus.has(p.sku) &&
        (p.name.toLowerCase().includes(needle) ||
          p.sku.toLowerCase().includes(needle) ||
          p.category.toLowerCase().includes(needle)),
    ).slice(0, SEARCH_LIMIT);
  }, [search, pickedSkus]);

  const catalogBySku = useMemo(() => new Map(CATALOG.map(p => [p.sku, p])), []);

  const addPick = async (product: KioskProduct) => {
    if (!loungeId) return;
    setAdding(product.sku);
    setError('');
    try {
      await addDoc(collection(db, 'lounges', loungeId, 'staffPicks'), {
        sku: product.sku,
        createdAt: Timestamp.now(),
      });
      await loadPicks(loungeId);
    } catch {
      setError("Couldn't add that pick. Check your connection and try again.");
    } finally {
      setAdding(null);
    }
  };

  const removePick = async (pickId: string) => {
    if (!loungeId) return;
    setRemovingId(pickId);
    try {
      await deleteDoc(doc(db, 'lounges', loungeId, 'staffPicks', pickId));
      setPicks(current => current.filter(p => p.id !== pickId));
    } catch {
      setError("Couldn't remove that pick. Check your connection and try again.");
    } finally {
      setRemovingId(null);
    }
  };

  const saveNote = async (pickId: string) => {
    if (!loungeId) return;
    setSavingNoteId(pickId);
    try {
      const note = (noteDrafts[pickId] ?? '').trim();
      await updateDoc(doc(db, 'lounges', loungeId, 'staffPicks', pickId), { note });
      setPicks(current => current.map(p => (p.id === pickId ? { ...p, note } : p)));
    } catch {
      setError("Couldn't save that note. Check your connection and try again.");
    } finally {
      setSavingNoteId(null);
    }
  };

  return (
    <AppShell
      loungeId={loungeId}
      eyebrow={loungeName}
      title="Staff Picks"
      subtitle="Highlight real items from your kiosk menu on the “Staff Picks” screen at the kiosk."
    >
      {loading ? (
        <p className="muted">Loading…</p>
      ) : loadError ? (
        <div className="empty">Couldn't load this listing.</div>
      ) : (
        <>
          <div className="card">
            <span className="card__label">Add a pick</span>
            <div style={{ marginTop: 'var(--space-md)' }}>
              <input
                className="input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search the kiosk menu by name, SKU, or category…"
                aria-label="Search kiosk menu"
              />
            </div>

            {search.trim() && (
              <div className="stack stack--tight" style={{ marginTop: 'var(--space-md)' }}>
                {results.length === 0 ? (
                  <p className="muted">No matching menu items{pickedSkus.size ? ' left to add' : ''}.</p>
                ) : (
                  results.map(product => (
                    <div
                      key={product.sku}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-md)',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--hairline)',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: 14 }}>
                          {product.name}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {product.category} · ${product.price} · SKU {product.sku}
                        </div>
                      </div>
                      <button
                        className="table__action"
                        onClick={() => addPick(product)}
                        disabled={adding === product.sku}
                      >
                        {adding === product.sku ? 'Adding…' : '+ Add'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {error && <p className="msg msg--error" style={{ marginTop: 'var(--space-md)' }}>{error}</p>}
          </div>

          <h2 className="section-title">Current Picks ({picks.length})</h2>
          {picks.length === 0 ? (
            <div className="empty">No staff picks yet — search above to add your first.</div>
          ) : (
            <div className="stack">
              {picks.map(pick => {
                const product = catalogBySku.get(pick.sku);
                return (
                  <div key={pick.id} className="card">
                    <div className="card__head">
                      <div>
                        <h2 style={{ fontSize: 18, marginBottom: 2 }}>
                          {product?.name ?? `Unknown item (SKU ${pick.sku})`}
                        </h2>
                        {product && (
                          <p className="muted" style={{ fontSize: 13 }}>
                            {product.category} · ${product.price} · SKU {product.sku}
                          </p>
                        )}
                      </div>
                      <button
                        className="btn btn--danger"
                        onClick={() => removePick(pick.id)}
                        disabled={removingId === pick.id}
                      >
                        {removingId === pick.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>

                    <div className="field-row" style={{ marginTop: 'var(--space-md)', alignItems: 'flex-end' }}>
                      <label className="field">
                        <span className="field__label">Staff note (optional)</span>
                        <input
                          className="input"
                          value={noteDrafts[pick.id] ?? ''}
                          onChange={e =>
                            setNoteDrafts(current => ({ ...current, [pick.id]: e.target.value }))
                          }
                          placeholder="e.g. A team favorite for unwinding after work"
                        />
                      </label>
                      <button
                        className="btn btn--secondary"
                        onClick={() => saveNote(pick.id)}
                        disabled={savingNoteId === pick.id || (noteDrafts[pick.id] ?? '') === (pick.note ?? '')}
                      >
                        {savingNoteId === pick.id ? 'Saving…' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
