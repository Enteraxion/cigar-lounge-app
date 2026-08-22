import { useState } from 'react';
import AdminShell from '../components/AdminShell';
import { backfillCities, rebuildCityStats } from '../lib/opsData';

/**
 * The maintenance jobs, moved off one laptop.
 *
 * Every one of these was a local `npm run` needing `serviceAccountKey.json` on
 * Rohith's machine, which made him a single point of failure: with him away,
 * nobody could refresh the search index or repair the directory. They run as
 * admin-only Cloud Functions now, so anyone with the admin login can.
 *
 * Both write jobs preview first. A button that spends money or rewrites 8,496
 * documents on its first click is a button nobody should trust, so the default is
 * always "tell me what you would do".
 */

type Outcome = { title: string; lines: string[] } | null;

export default function OperationsPage() {
  const [busy, setBusy] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [error, setError] = useState('');

  const run = async (id: string, work: () => Promise<Outcome>) => {
    setBusy(id);
    setError('');
    setOutcome(null);
    try {
      setOutcome(await work());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That did not run. Check the function is deployed.',
      );
    } finally {
      setBusy('');
    }
  };

  const cityJob = (dryRun: boolean) => async (): Promise<Outcome> => {
    const r = await backfillCities(dryRun);
    return {
      title: dryRun ? 'Preview — nothing written' : 'Cities written',
      lines: [
        `${r.missing.toLocaleString()} lounges have no city`,
        `${r.parsed.toLocaleString()} could be read from their address`,
        `${r.unparseable.toLocaleString()} could not be parsed and were skipped`,
        ...(r.unparseableSamples.length
          ? ['', 'Examples it could not parse:', ...r.unparseableSamples.map(s => `  ${s}`)]
          : []),
      ],
    };
  };

  return (
    <AdminShell
      active="operations"
      title="Operations"
      subtitle="Maintenance jobs that used to need a laptop and a service-account key."
    >
      {error && <div className="notice notice--error">{error}</div>}

      {outcome && (
        <section className="card">
          <h2 className="card__title">{outcome.title}</h2>
          <pre className="pre">{outcome.lines.join('\n')}</pre>
        </section>
      )}

      <div className="stack">
        <section className="card">
          <h2 className="card__title">Fill in missing cities</h2>
          <p className="body">
            Every one of the 3,328 Google-imported lounges has no <code>city</code> field.
            That is the field the Search tab groups by and the one the search index is
            built from, so those lounges are invisible to city search — 39% of the
            directory. Their addresses already contain the city, so this reads it from
            there. No API calls, no cost.
          </p>
          <p className="hint">
            Only writes when the address ends in the “…, City, ST 12345” shape, and skips
            anything it cannot read confidently. A wrong city is worse than none — it
            would file a lounge under a place it is not in.
          </p>
          <footer className="card__foot">
            <button
              className="btn btn--secondary"
              disabled={!!busy}
              onClick={() => run('city-dry', cityJob(true))}
            >
              {busy === 'city-dry' ? 'Checking…' : 'Preview'}
            </button>
            <button
              className="btn btn--primary"
              disabled={!!busy}
              onClick={() => {
                if (!window.confirm('Write the parsed cities to the directory?')) return;
                run('city-run', cityJob(false));
              }}
            >
              {busy === 'city-run' ? 'Writing…' : 'Run it'}
            </button>
          </footer>
        </section>

        <section className="card">
          <h2 className="card__title">Rebuild the search index</h2>
          <p className="body">
            Recomputes <code>aggregates/cityStats</code>, the single document the Search
            tab reads instead of counting all 8,496 lounges in the app. It is a snapshot
            and nothing refreshes it automatically, so it drifts after any import — and
            after filling in cities above, which changes every count.
          </p>
          <footer className="card__foot">
            <button
              className="btn btn--primary"
              disabled={!!busy}
              onClick={() =>
                run('stats', async () => {
                  const r = await rebuildCityStats();
                  return {
                    title: 'Search index rebuilt',
                    lines: [
                      `${r.cities.toLocaleString()} cities`,
                      `from ${r.lounges.toLocaleString()} lounges`,
                    ],
                  };
                })
              }
            >
              {busy === 'stats' ? 'Rebuilding…' : 'Rebuild now'}
            </button>
          </footer>
        </section>

        <section className="card">
          <h2 className="card__title">Phone numbers and opening hours</h2>
          <p className="body">
            Not runnable from here yet. Filling in the phone numbers — absent on all
            8,496 — and the 5,080 placeholder opening hours needs the Google Places key
            available server-side, and <code>GOOGLE_PLACES_API_KEY</code> is still a
            placeholder secret.
          </p>
          <p className="hint">
            Until it is set, this runs from a terminal:
            <br />
            <code>npm run backfill:google -- --confirm</code>
            <br />
            Dry-run by default, and it reports the exact number of billable calls before
            spending anything. Roughly $192 for the full 8,496 at Enterprise-tier
            pricing.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
