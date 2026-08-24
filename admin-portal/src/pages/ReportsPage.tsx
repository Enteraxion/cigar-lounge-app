import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { fetchReports, resolveReport, type IssueReport } from '../lib/opsData';

/**
 * Issue reports from members.
 *
 * This is the page with the strongest claim to existing. The app's "Report Issue"
 * button has been writing to `users/{uid}/issueReports` since 2026-08-10, and
 * until 2026-08-21 **nothing read it** — no screen, no function, no script. Every
 * problem any member ever took the trouble to report went into the database and
 * was never seen by anybody.
 *
 * firestore.rules gained an admin read and a collection-group read for this in the
 * same change; the collection-group query is what makes one page possible instead
 * of a per-member walk.
 */
export default function ReportsPage() {
  const [reports, setReports] = useState<IssueReport[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setReports(await fetchReports());
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.toLowerCase().includes('permission')
          ? 'Permission denied — the rules change granting admin read on issue reports may not be deployed yet.'
          : 'Could not load reports.',
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (report: IssueReport) => {
    setBusy(report.id);
    try {
      await resolveReport(report.path, !report.resolved);
      await load();
    } catch {
      setError('Could not update that report.');
    } finally {
      setBusy('');
    }
  };

  const visible = (reports ?? []).filter(r => showResolved || !r.resolved);
  const openCount = (reports ?? []).filter(r => !r.resolved).length;

  return (
    <AdminShell
      active="reports"
      title="Reports"
      subtitle={
        reports
          ? `${openCount} open · ${reports.length} in total`
          : 'What members have reported through the app'
      }
      actions={
        <>
          <label className="checkline">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
            />
            Show resolved
          </label>
          <button className="btn btn--secondary" onClick={load}>
            Refresh
          </button>
        </>
      }
    >
      {error && <div className="notice notice--error">{error}</div>}

      {reports === null ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="empty">
          {openCount === 0 && reports.length > 0
            ? 'Everything reported has been dealt with.'
            : 'No issue reports yet.'}
        </div>
      ) : (
        <div className="stack">
          {visible.map(report => (
            <section className="card" key={report.id}>
              <header className="card__head">
                <div>
                  <h2 className="card__title">Issue reported</h2>
                  <p className="card__meta">
                    {report.createdAt
                      ? report.createdAt.toDate().toLocaleString()
                      : 'no date recorded'}
                    {' · member '}
                    {report.reporterEmail ?? report.userId}
                  </p>
                </div>
                {report.resolved ? (
                  <span className="pill pill--good">Resolved</span>
                ) : (
                  <span className="pill pill--warn">Open</span>
                )}
              </header>

              {/* The report itself. An empty one is worth saying out loud rather
                  than rendering nothing, which is indistinguishable from the
                  field-name bug this page had until 2026-08-23. */}
              {report.description?.trim() ? (
                <p className="body">{report.description}</p>
              ) : (
                <p className="hint">This report was submitted with no description.</p>
              )}
              {/* No "About lounge" block. IssueReportDocument has no loungeId —
                  ReportIssueModal collects free text only, so this rendered
                  nothing and was part of the same invented-shape mistake as
                  `message` and `subject`. If a report ever needs to name a
                  lounge, the app has to write it first. */}

              <footer className="card__foot">
                <button
                  className={report.resolved ? 'btn btn--secondary' : 'btn btn--primary'}
                  disabled={busy === report.id}
                  onClick={() => toggle(report)}
                >
                  {busy === report.id
                    ? 'Working…'
                    : report.resolved
                      ? 'Reopen'
                      : 'Mark resolved'}
                </button>
              </footer>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
