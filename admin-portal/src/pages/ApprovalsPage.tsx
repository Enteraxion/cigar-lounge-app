import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import {
  approveClaim,
  approveVerification,
  getPendingClaims,
  getPendingVerifications,
  rejectClaim,
  rejectVerification,
} from '../lib/adminData';
import type { ClaimingLounge, IdDocumentType, PendingVerification } from '../lib/types';

/**
 * The two queues that need a human decision, as tabs on one page.
 *
 * One page rather than two sidebar entries because it is one activity — "things
 * waiting on me" — and splitting it would mean checking two places to know
 * whether there is work.
 *
 * This replaces AdminAgeReviewScreen and AdminClaimReviewScreen in the mobile
 * app, which are deleted as part of the same change. The job was always desk
 * work: comparing two photographs of a document against a date of birth is
 * something a phone screen actively makes harder.
 */

const MINIMUM_AGE = 21;

/** Which sides each document needs — mirrors ../../src/utils/idDocument.ts. */
const SIDES: Record<IdDocumentType, ('front' | 'back')[]> = {
  drivers_license: ['front', 'back'],
  state_id: ['front', 'back'],
  passport: ['front'],
  military_id: ['front', 'back'],
};

const DOCUMENT_LABEL: Record<IdDocumentType, string> = {
  drivers_license: "Driver's License",
  state_id: 'State ID Card',
  passport: 'Passport',
  military_id: 'Military ID',
};

/** A record with no documentType predates the picker and is treated as one-sided. */
function requiredSides(type?: IdDocumentType): ('front' | 'back')[] {
  return type ? SIDES[type] : ['front'];
}

function sideLabel(type: IdDocumentType | undefined, side: 'front' | 'back'): string {
  if (requiredSides(type).length === 1) {
    return type === 'passport' ? 'Photo page' : 'Photo of ID';
  }
  return side === 'front' ? 'Front' : 'Back';
}

function imageForSide(record: PendingVerification, side: 'front' | 'back') {
  return side === 'front' ? record.idImageUrl : record.idBackImageUrl;
}

/** Whether every side this document needs is actually present. */
function isComplete(record: PendingVerification): boolean {
  return requiredSides(record.documentType).every(side => !!imageForSide(record, side));
}

/**
 * Age from a declared ISO date, computed rather than left to the reviewer.
 *
 * Never parses the string with `new Date(iso)` — that reads as UTC midnight and
 * can land a day earlier in a western timezone, which on an age gate is the
 * difference between 20 and 21. Same reasoning as the app's ageCheck.ts.
 */
function ageFromIso(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) {
    return null;
  }
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}

type Tab = 'ids' | 'claims';

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('ids');
  const [verifications, setVerifications] = useState<PendingVerification[] | null>(null);
  const [claims, setClaims] = useState<ClaimingLounge[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [v, c] = await Promise.all([getPendingVerifications(), getPendingClaims()]);
      setVerifications(v);
      setClaims(c);
    } catch (caught) {
      // Almost always permission-denied from a non-admin account, so say that
      // rather than "something went wrong".
      setError(
        caught instanceof Error && caught.message.includes('permission')
          ? 'This account does not have admin access.'
          : 'Could not load the queues. Check your connection and try again.',
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, run: () => Promise<void>) => {
    setBusyId(id);
    try {
      await run();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not work. Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const idCount = verifications?.length ?? 0;
  const claimCount = claims?.length ?? 0;

  return (
    <AdminShell
      active="approvals"
      title="Approvals"
      subtitle="Everything waiting on a decision, oldest first."
      actions={
        <button className="btn btn--secondary" onClick={load}>
          Refresh
        </button>
      }
    >
      <div className="tabs">
        <button
          className={`tab${tab === 'ids' ? ' tab--active' : ''}`}
          onClick={() => setTab('ids')}
        >
          ID verifications
          {idCount > 0 && <span className="tab__badge">{idCount}</span>}
        </button>
        <button
          className={`tab${tab === 'claims' ? ' tab--active' : ''}`}
          onClick={() => setTab('claims')}
        >
          Business claims
          {claimCount > 0 && <span className="tab__badge">{claimCount}</span>}
        </button>
      </div>

      {error && <div className="notice notice--error">{error}</div>}

      {tab === 'ids' ? (
        verifications === null ? (
          <p className="muted">Loading…</p>
        ) : verifications.length === 0 ? (
          <div className="empty">No IDs waiting for review.</div>
        ) : (
          <div className="stack">
            {verifications.map(record => {
              const age = ageFromIso(record.dateOfBirth);
              const underage = age !== null && age < MINIMUM_AGE;
              const complete = isComplete(record);
              const busy = busyId === record.userId;

              return (
                <section className="card" key={record.userId}>
                  <header className="card__head">
                    <div>
                      <h2 className="card__title">{record.userName || 'Member'}</h2>
                      <p className="card__meta">{record.userEmail || record.userId}</p>
                    </div>
                    <span className="pill">{DOCUMENT_LABEL[record.documentType!] ?? 'Photo ID'}</span>
                  </header>

                  <dl className="facts">
                    <div>
                      <dt>Declared date of birth</dt>
                      <dd>{record.dateOfBirth || '—'}</dd>
                    </div>
                    <div>
                      <dt>That makes them</dt>
                      {/* Flagged rather than hidden: the sign-up gate should make
                          this impossible, so if it appears something upstream is
                          wrong and the reviewer needs to see it. */}
                      <dd className={underage ? 'danger' : undefined}>
                        {age === null ? 'unreadable date' : `${age}`}
                        {underage ? '  ⚠ under 21' : ''}
                      </dd>
                    </div>
                    {record.deferredAt && (
                      <div>
                        <dt>Note</dt>
                        <dd>Chose “Explore first” before uploading</dd>
                      </div>
                    )}
                  </dl>

                  {complete ? (
                    <div className="shots">
                      {requiredSides(record.documentType).map(side => {
                        const url = imageForSide(record, side);
                        return url ? (
                          <figure className="shot" key={side}>
                            {/* Opens full size in a new tab — small print on a
                                driving licence is the whole point of looking. */}
                            <a href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt={sideLabel(record.documentType, side)} />
                            </a>
                            <figcaption>{sideLabel(record.documentType, side)}</figcaption>
                          </figure>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="notice notice--warn">
                      {record.idImageUrl
                        ? 'Some sides of this document are missing, so there is nothing complete to check.'
                        : 'No ID uploaded yet — nothing to check against the date above.'}
                    </p>
                  )}

                  <footer className="card__foot">
                    <button
                      className="btn btn--reject"
                      disabled={busy}
                      onClick={() => {
                        const reason =
                          window.prompt(
                            'Reason for rejection (shown to the member — leave blank for the default):',
                          ) ?? undefined;
                        act(record.userId, () => rejectVerification(record.userId, reason || undefined));
                      }}
                    >
                      Reject
                    </button>
                    <button
                      className="btn btn--primary"
                      // Approving an incomplete submission would record a check
                      // that never happened, which is the one thing this page
                      // exists to prevent.
                      disabled={busy || !complete}
                      onClick={() => act(record.userId, () => approveVerification(record.userId))}
                    >
                      {busy ? 'Working…' : 'Verify'}
                    </button>
                  </footer>
                </section>
              );
            })}
          </div>
        )
      ) : claims === null ? (
        <p className="muted">Loading…</p>
      ) : claims.length === 0 ? (
        <div className="empty">No business claims waiting for review.</div>
      ) : (
        <div className="stack">
          {claims.map(claim => {
            const busy = busyId === claim.id;
            return (
              <section className="card" key={claim.id}>
                <header className="card__head">
                  <div>
                    <h2 className="card__title">{claim.name}</h2>
                    <p className="card__meta">
                      {claim.address}
                      {claim.city ? `, ${claim.city}` : ''}
                    </p>
                  </div>
                  <span className="pill">Pending</span>
                </header>

                <dl className="facts">
                  <div>
                    <dt>Claimed by</dt>
                    <dd>{claim.ownerName || '—'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{claim.ownerContactEmail || '—'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{claim.ownerContactPhone || '—'}</dd>
                  </div>
                </dl>

                <footer className="card__foot">
                  <button
                    className="btn btn--reject"
                    disabled={busy}
                    onClick={() => act(claim.id, () => rejectClaim(claim.id))}
                  >
                    Reject
                  </button>
                  <button
                    className="btn btn--primary"
                    disabled={busy}
                    onClick={() => act(claim.id, () => approveClaim(claim.id))}
                  >
                    {busy ? 'Working…' : 'Approve ownership'}
                  </button>
                </footer>
              </section>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
