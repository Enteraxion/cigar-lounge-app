import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentSnapshot } from 'firebase/firestore';
import AdminShell from '../components/AdminShell';
import {
  fetchCounts,
  fetchPage,
  HOURS_PLACEHOLDER,
  updateLounge,
  type AdminLounge,
  type GapFilter,
  type SourceFilter,
} from '../lib/loungeData';

/**
 * The lounge directory — all 8,496, with the filters that make the data gaps
 * visible.
 *
 * The point of this page is not browsing. It is answering "what is missing", which
 * until now could only be answered by running a script against the Admin SDK on
 * one laptop. Every filter below corresponds to a gap measured on 2026-08-21:
 * phone absent on all 8,496; hours still a placeholder on 5,080; photos absent on
 * 4,163; city absent on all 3,328 Google-sourced documents, which quietly makes
 * those lounges invisible to every city search in the app.
 *
 * Reads are shown per page on purpose. Some filters cannot be expressed in
 * Firestore and are answered by scanning, which costs real reads, and an admin
 * changing a dropdown should be able to see that rather than discover it on a
 * bill.
 */

const GAPS: { id: GapFilter; label: string; note: string }[] = [
  { id: 'none', label: 'All lounges', note: '' },
  { id: 'no-phone', label: 'No phone number', note: 'scans' },
  { id: 'placeholder-hours', label: 'Hours not yet available', note: '' },
  { id: 'no-photos', label: 'No photos', note: 'scans' },
  { id: 'no-city', label: 'No city (invisible to search)', note: 'scans' },
  { id: 'claimed', label: 'Claimed by an owner', note: '' },
];

const SOURCES: { id: SourceFilter; label: string }[] = [
  { id: 'all', label: 'Both sources' },
  { id: 'yelp', label: 'Yelp import' },
  { id: 'google', label: 'Google import' },
];

function hoursOk(lounge: AdminLounge): boolean {
  return !!lounge.hours && !lounge.hours.includes(HOURS_PLACEHOLDER);
}

function photoCount(lounge: AdminLounge): number {
  return Array.isArray(lounge.images) ? lounge.images.length : 0;
}

export default function LoungesPage() {
  const [gap, setGap] = useState<GapFilter>('none');
  const [source, setSource] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AdminLounge[] | null>(null);
  const [counts, setCounts] = useState<{ total: number; placeholderHours: number } | null>(null);
  const [reads, setReads] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AdminLounge | null>(null);

  /** Cursor per page index, so Previous does not have to re-scan from the start. */
  const cursors = useRef<(DocumentSnapshot | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const load = useCallback(
    async (index: number) => {
      setError('');
      setRows(null);
      try {
        const page = await fetchPage({
          gap,
          source,
          search,
          after: cursors.current[index] ?? null,
        });
        setRows(page.rows);
        setReads(page.read);
        setTruncated(page.truncated);
        cursors.current[index + 1] = page.cursor;
        setHasNext(!!page.cursor && page.rows.length > 0);
        setPageIndex(index);
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message.toLowerCase().includes('permission')
            ? 'This account does not have admin access.'
            : 'Could not load the directory. Check your connection and try again.',
        );
      }
    },
    [gap, source, search],
  );

  // Any filter change resets to the first page — keeping a page-3 cursor from a
  // different filter would silently show the wrong slice.
  useEffect(() => {
    cursors.current = [null];
    load(0);
  }, [load]);

  useEffect(() => {
    fetchCounts().then(setCounts).catch(() => setCounts(null));
  }, []);

  return (
    <AdminShell
      active="lounges"
      title="Lounges"
      subtitle={
        counts
          ? `${counts.total.toLocaleString()} in the directory · ${counts.placeholderHours.toLocaleString()} still without real opening hours`
          : 'Loading counts…'
      }
      actions={
        <button className="btn btn--secondary" onClick={() => load(pageIndex)}>
          Refresh
        </button>
      }
    >
      <div className="toolbar">
        <label className="field field--inline">
          <span className="field__label">Show</span>
          <select
            className="input input--select"
            value={gap}
            onChange={event => setGap(event.target.value as GapFilter)}
          >
            {GAPS.map(g => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--inline">
          <span className="field__label">Source</span>
          <select
            className="input input--select"
            value={source}
            onChange={event => setSource(event.target.value as SourceFilter)}
          >
            {SOURCES.map(s => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--inline field--grow">
          <span className="field__label">Search name</span>
          <input
            className="input"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="e.g. brass peacock"
          />
        </label>
      </div>

      {/* Firestore has no full-text search, so this is a bounded scan rather than
          an index lookup. Saying so is better than letting an admin believe a
          blank result means the lounge does not exist. */}
      {search.trim() !== '' && (
        <p className="hint">
          Name search reads pages and matches in the browser — Firestore cannot do
          substring search. It stops after about 1,500 documents, so a lounge late in
          the directory may not be found.
        </p>
      )}

      {error && <div className="notice notice--error">{error}</div>}

      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty">Nothing matches those filters.</div>
      ) : (
        <>
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>City</th>
                  <th>Source</th>
                  <th>Phone</th>
                  <th>Hours</th>
                  <th>Photos</th>
                  <th>Owner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(lounge => (
                  <tr key={lounge.id}>
                    <td className="cell--name">{lounge.name}</td>
                    <td className="cell--dim">{lounge.address || '—'}</td>
                    <td className={lounge.city ? undefined : 'cell--gap'}>
                      {lounge.city || 'missing'}
                    </td>
                    <td className="cell--dim">{lounge.source}</td>
                    <td className={lounge.phone ? undefined : 'cell--gap'}>
                      {lounge.phone || 'missing'}
                    </td>
                    <td className={hoursOk(lounge) ? undefined : 'cell--gap'}>
                      {hoursOk(lounge) ? 'ok' : 'placeholder'}
                    </td>
                    <td className={photoCount(lounge) === 0 ? 'cell--gap' : undefined}>
                      {photoCount(lounge) || 'none'}
                    </td>
                    <td className="cell--dim">{lounge.ownerId ? 'claimed' : '—'}</td>
                    <td>
                      <button className="btn btn--danger" onClick={() => setEditing(lounge)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span className="pager__meta">
              Page {pageIndex + 1} · {rows.length} shown · {reads} document
              {reads === 1 ? '' : 's'} read
              {truncated && ' · stopped early at the scan limit'}
            </span>
            <div className="pager__buttons">
              <button
                className="btn btn--secondary"
                disabled={pageIndex === 0}
                onClick={() => load(pageIndex - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn--secondary"
                disabled={!hasNext}
                onClick={() => load(pageIndex + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <EditDialog
          lounge={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(pageIndex);
          }}
        />
      )}
    </AdminShell>
  );
}

/**
 * Editing the fields worth correcting by hand.
 *
 * Deliberately not name, address or coordinates: those come from the Yelp and
 * Google imports, and `refreshCityLounges` rewrites them the next time that city
 * is refreshed — so a hand edit there would be quietly undone and look like data
 * loss. City is editable precisely because it is the field the Google import
 * never wrote.
 */
function EditDialog({
  lounge,
  onClose,
  onSaved,
}: {
  lounge: AdminLounge;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState(lounge.phone ?? '');
  const [city, setCity] = useState(lounge.city ?? '');
  const [hours, setHours] = useState(lounge.hours ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateLounge(lounge.id, {
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        hours: hours.trim() || undefined,
      });
      onSaved();
    } catch {
      setError('Could not save. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__card">
        <h2 className="card__title">{lounge.name}</h2>
        <p className="card__meta">
          {lounge.address} · {lounge.id}
        </p>

        <label className="field">
          <span className="field__label">Phone</span>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">City — format “Houston, TX”</span>
          <input className="input" value={city} onChange={e => setCity(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Opening hours</span>
          <textarea
            className="input"
            rows={3}
            value={hours}
            onChange={e => setHours(e.target.value)}
          />
        </label>

        <p className="hint">
          Name, address and coordinates are not editable — the city refresh would
          overwrite them.
        </p>

        {error && <div className="notice notice--error">{error}</div>}

        <div className="card__foot">
          <button className="btn btn--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
