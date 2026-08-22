import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminShell from '../components/AdminShell';
import { fetchHealth, type Health } from '../lib/opsData';

/**
 * System health on one page.
 *
 * Every number here is one I had to compute with a throwaway Admin SDK script at
 * some point in the past week, which is the argument for the page existing. All of
 * them are server-side aggregation counts, so the whole thing costs about a dozen
 * reads rather than the 8,496 it would take to count in the browser.
 *
 * Numbers Firestore cannot count are deliberately absent — lounges with no phone,
 * no photos, no city each need a full scan. The Lounges page reports those, where
 * an admin has actually asked for them and can see the cost.
 */

function Stat({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string | number;
  tone?: 'good' | 'warn' | 'bad';
  note?: string;
}) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${tone ? ` stat__value--${tone}` : ''}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {note && <span className="stat__note">{note}</span>}
    </div>
  );
}

export default function DashboardPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(caught =>
        setError(
          caught instanceof Error && caught.message.toLowerCase().includes('permission')
            ? 'This account does not have admin access.'
            : 'Could not load the health numbers.',
        ),
      );
  }, []);

  const staleDays = health?.cityStatsGeneratedAt
    ? Math.floor((Date.now() - health.cityStatsGeneratedAt.getTime()) / 86_400_000)
    : null;

  return (
    <AdminShell
      active="dashboard"
      title="Dashboard"
      subtitle="Where the system stands right now."
    >
      {error && <div className="notice notice--error">{error}</div>}
      {!health && !error && <p className="muted">Loading…</p>}

      {health && (
        <div className="stack">
          <section>
            <h2 className="section__heading">Waiting on you</h2>
            <div className="stats">
              <Stat
                label="ID verifications"
                value={health.pendingVerifications}
                tone={health.pendingVerifications > 0 ? 'warn' : 'good'}
              />
              <Stat
                label="Business claims"
                value={health.pendingClaims}
                tone={health.pendingClaims > 0 ? 'warn' : 'good'}
              />
              <Stat
                label="Open issue reports"
                value={health.openReports}
                tone={health.openReports > 0 ? 'warn' : 'good'}
                note="from Report Issue in the app"
              />
            </div>
            <p className="hint">
              <Link to="/approvals">Go to Approvals →</Link>
            </p>
          </section>

          <section>
            <h2 className="section__heading">Directory</h2>
            <div className="stats">
              <Stat label="Lounges" value={health.lounges} />
              <Stat
                label="Without real opening hours"
                value={health.placeholderHours}
                tone={health.placeholderHours > 0 ? 'bad' : 'good'}
                note={`${Math.round((health.placeholderHours / health.lounges) * 100)}% of the directory`}
              />
              <Stat label="Claimed by an owner" value={health.claimed} />
              <Stat label="Reviews written" value={health.reviews} />
            </div>
            <p className="hint">
              <Link to="/lounges">See what is missing →</Link>
            </p>
          </section>

          <section>
            <h2 className="section__heading">Members</h2>
            <div className="stats">
              <Stat label="Accounts" value={health.members} />
              <Stat label="Verified" value={health.verified} tone="good" />
              <Stat label="Pending" value={health.pendingVerifications} />
              <Stat
                label="Rejected"
                value={health.rejected}
                tone={health.rejected > health.verified ? 'warn' : undefined}
              />
            </div>
          </section>

          <section>
            <h2 className="section__heading">Search data freshness</h2>
            <div className="stats">
              <Stat label="Cities in the search index" value={health.cityStatsCities} />
              <Stat
                label="Index last rebuilt"
                value={
                  health.cityStatsGeneratedAt
                    ? health.cityStatsGeneratedAt.toLocaleDateString()
                    : 'never'
                }
                // Nothing regenerates this automatically, so age is the whole
                // signal. A week is fine; a month after an import is not.
                tone={staleDays !== null && staleDays > 14 ? 'warn' : undefined}
                note={staleDays !== null ? `${staleDays} day${staleDays === 1 ? '' : 's'} ago` : undefined}
              />
            </div>
            <p className="hint">
              This is a snapshot, not a live view — it drifts after any import until
              it is rebuilt. <Link to="/operations">Rebuild it →</Link>
            </p>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
