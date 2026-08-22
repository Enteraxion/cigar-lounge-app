import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { deleteMember, fetchMembers, revokeVerification, type Member } from '../lib/opsData';

/**
 * Every member account.
 *
 * Until this page there was no way to see members at all — the only query against
 * `users` anywhere was "who has a pending verification". That is how 7 orphaned
 * user documents came to sit unnoticed in the project: documents whose Auth
 * account had been deleted, still holding the member's declared date of birth.
 * They are flagged here rather than hidden, because they are the reason the page
 * was needed.
 */

function statusTone(status: string): string {
  switch (status) {
    case 'verified':
      return 'pill pill--good';
    case 'pending':
      return 'pill pill--warn';
    case 'rejected':
      return 'pill pill--bad';
    default:
      return 'pill pill--quiet';
  }
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setMembers(await fetchMembers());
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.toLowerCase().includes('permission')
          ? 'This account does not have admin access.'
          : 'Could not load members.',
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (member: Member) => {
    const label = member.email || member.name || member.uid;
    if (
      !window.confirm(
        `Permanently delete ${label}?\n\n` +
          'This removes their sign-in account, their profile and all its data ' +
          '(favourites, collections, reviews, notifications), and any photographs ' +
          'of their ID.\n\nThis cannot be undone.',
      )
    ) {
      return;
    }
    setBusy(member.uid);
    setResult('');
    try {
      const outcome = await deleteMember(member.uid);
      setResult(
        `Deleted ${label} — ${outcome.filesDeleted} file${outcome.filesDeleted === 1 ? '' : 's'} ` +
          `removed from storage, sign-in account ${outcome.authDeleted ? 'deleted' : 'was already gone'}.`,
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete that member.');
    } finally {
      setBusy('');
    }
  };

  const revoke = async (member: Member) => {
    if (!window.confirm(`Send ${member.email || member.uid} back to pending verification?`)) {
      return;
    }
    setBusy(member.uid);
    try {
      await revokeVerification(member.uid);
      await load();
    } catch {
      setError('Could not change that member.');
    } finally {
      setBusy('');
    }
  };

  const orphans = members?.filter(m => !m.email).length ?? 0;

  return (
    <AdminShell
      active="members"
      title="Members"
      subtitle={members ? `${members.length} account${members.length === 1 ? '' : 's'}` : 'Loading…'}
      actions={
        <button className="btn btn--secondary" onClick={load}>
          Refresh
        </button>
      }
    >
      {error && <div className="notice notice--error">{error}</div>}
      {result && <div className="notice notice--warn">{result}</div>}

      {orphans > 0 && (
        <p className="hint">
          {orphans} document{orphans === 1 ? '' : 's'} here have no email address. Those are
          almost certainly leftovers from accounts deleted outside the app — they still
          hold a declared date of birth, so they are worth clearing.
        </p>
      )}

      {members === null ? (
        <p className="muted">Loading…</p>
      ) : members.length === 0 ? (
        <div className="empty">No members yet.</div>
      ) : (
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Joined</th>
                <th>Verification</th>
                <th>Date of birth</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.uid}>
                  <td className={member.email ? 'cell--name' : 'cell--gap'}>
                    {member.email || 'no email on record'}
                  </td>
                  <td className="cell--dim">{member.name || '—'}</td>
                  <td className="cell--dim">
                    {member.memberSince
                      ? member.memberSince.toDate().toLocaleDateString()
                      : '—'}
                  </td>
                  <td>
                    <span className={statusTone(member.status)}>{member.status}</span>
                    {member.deferred && <span className="pill pill--quiet">skipped ID</span>}
                  </td>
                  <td className="cell--dim">{member.dateOfBirth || '—'}</td>
                  <td className="cell--actions">
                    {member.status === 'verified' && (
                      <button
                        className="btn btn--secondary"
                        disabled={busy === member.uid}
                        onClick={() => revoke(member)}
                      >
                        Un-verify
                      </button>
                    )}
                    <button
                      className="btn btn--reject"
                      disabled={busy === member.uid}
                      onClick={() => remove(member)}
                    >
                      {busy === member.uid ? 'Working…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
