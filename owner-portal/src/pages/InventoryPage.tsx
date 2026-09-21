import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import type { HumidorItem, HumidorStockStatus, Lounge } from '../lib/types';

/**
 * Humidor inventory — restructured to match the Kiki Momo admin's Inventory
 * page: a searchable, paginated table with a modal for adding/editing a
 * single item, rather than one long page of inline-editable cards.
 *
 * Each Save persists immediately (matching Kiki Momo's live per-action
 * mutations) instead of batching edits behind one page-level Save button.
 * Under the hood this is still a single `updateDoc` rewriting the whole
 * `humidorItems` array — it's a small inline array on the lounge doc, not a
 * subcollection with per-item ids, so there's nothing to diff against; a
 * per-item edit just computes the next full array and writes it.
 *
 * There's no stock-adjustment ledger or CSV export here (unlike Kiki Momo's
 * Inventory page) — that's backed by real order/stock-history data this
 * app's schema doesn't have, and building it is a separate feature, not a
 * UI restructure.
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

const PAGE_SIZE = 20;

export default function InventoryPage() {
  const { loungeId } = useParams<{ loungeId: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loungeName, setLoungeName] = useState('');
  const [items, setItems] = useState<HumidorItem[]>([]);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<{ item: HumidorItem; index: number | null } | null>(null);
  const [form, setForm] = useState<HumidorItem>(EMPTY_ITEM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      item =>
        item.name.toLowerCase().includes(needle) ||
        item.strength.toLowerCase().includes(needle) ||
        item.origin.toLowerCase().includes(needle),
    );
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAdd = () => {
    setEditing({ item: EMPTY_ITEM, index: null });
    setForm(EMPTY_ITEM);
    setFormError('');
  };

  const openEdit = (item: HumidorItem) => {
    const index = items.indexOf(item);
    setEditing({ item, index });
    setForm(item);
    setFormError('');
  };

  const closeModal = () => setEditing(null);

  const persist = async (nextItems: HumidorItem[]) => {
    if (!loungeId) return;
    await updateDoc(doc(db, 'lounges', loungeId), {
      humidorItems: nextItems,
      updatedAt: Timestamp.now(),
    });
    setItems(nextItems);
  };

  const saveItem = async () => {
    if (!form.name.trim()) {
      setFormError('Every item needs a name.');
      return;
    }
    setFormError('');
    setSaving(true);
    const cleaned: HumidorItem = {
      name: form.name.trim(),
      image: form.image.trim(),
      strength: form.strength.trim(),
      origin: form.origin.trim(),
      price: form.price.trim(),
      stockStatus: form.stockStatus,
    };
    try {
      const nextItems =
        editing?.index == null
          ? [...items, cleaned]
          : items.map((item, i) => (i === editing.index ? cleaned : item));
      await persist(nextItems);
      setStatus(editing?.index == null ? 'Item added.' : 'Item saved.');
      setEditing(null);
    } catch {
      setFormError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: HumidorItem) => {
    if (!confirm(`Remove "${item.name}" from your inventory?`)) return;
    const index = items.indexOf(item);
    const nextItems = items.filter((_, i) => i !== index);
    try {
      await persist(nextItems);
      setStatus('Item removed.');
    } catch {
      setStatus("Couldn't remove that item. Check your connection and try again.");
    }
  };

  return (
    <AppShell
      loungeId={loungeId}
      eyebrow={loungeName}
      title="Humidor Inventory"
      subtitle="Items you add here appear in the “Humidor Highlights” section of your listing in the app."
    >
      {loading ? (
        <p className="muted">Loading…</p>
      ) : loadError ? (
        <div className="empty">Couldn't load this listing.</div>
      ) : (
        <>
          <div className="table-toolbar">
            <input
              className="input"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, category, or origin…"
              aria-label="Search inventory"
            />
            <button className="btn btn--primary" onClick={openAdd}>
              + Add Item
            </button>
          </div>

          {status && <p className="msg msg--success" style={{ marginBottom: 'var(--space-md)' }}>{status}</p>}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Origin</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      {items.length === 0
                        ? 'No items added yet.'
                        : 'No items found matching your search.'}
                    </td>
                  </tr>
                ) : (
                  paged.map(item => (
                    <tr key={items.indexOf(item)}>
                      <td className="table__name">{item.name}</td>
                      <td>{item.strength || '—'}</td>
                      <td>{item.origin || '—'}</td>
                      <td>{item.price || '—'}</td>
                      <td>
                        <span className={`badge badge--${item.stockStatus}`}>
                          {STOCK_OPTIONS.find(o => o.value === item.stockStatus)?.label}
                        </span>
                      </td>
                      <td>
                        <div className="table__actions">
                          <button className="table__action" onClick={() => openEdit(item)}>
                            Edit
                          </button>
                          <button
                            className="table__action table__action--danger"
                            onClick={() => deleteItem(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="pagination">
              <span className="pagination__label">
                Page {page} of {pageCount}
              </span>
              <button
                className="btn btn--secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn--secondary"
                disabled={page >= pageCount}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {editing && (
        <Modal title={editing.index == null ? 'Add Item' : 'Edit Item'} onClose={closeModal}>
          <div className="stack stack--tight">
            <label className="field">
              <span className="field__label">Name</span>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Padrón 1926 Series"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Category / Strength</span>
                <input
                  className="input"
                  value={form.strength}
                  onChange={e => setForm({ ...form, strength: e.target.value })}
                  placeholder="e.g. Full, or Flower"
                />
              </label>
              <label className="field">
                <span className="field__label">Origin</span>
                <input
                  className="input"
                  value={form.origin}
                  onChange={e => setForm({ ...form, origin: e.target.value })}
                  placeholder="e.g. Nicaragua"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Price</span>
                <input
                  className="input"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="e.g. $28"
                />
              </label>
              <label className="field">
                <span className="field__label">Availability</span>
                <select
                  className="select"
                  value={form.stockStatus}
                  onChange={e => setForm({ ...form, stockStatus: e.target.value as HumidorStockStatus })}
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
                value={form.image}
                onChange={e => setForm({ ...form, image: e.target.value })}
                placeholder="https://…"
              />
            </label>

            {formError && <p className="msg msg--error">{formError}</p>}

            <div className="btn-row">
              <button className="btn btn--primary" onClick={saveItem} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn--secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
