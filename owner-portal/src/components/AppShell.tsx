import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Persistent chrome around every signed-in page: brand, the signed-in
 * account, and sign out. Previously each page drew its own ad-hoc header
 * row with a back link, so there was nothing tying the pages together as
 * one product and no way to sign out from anywhere but the dashboard.
 */
export default function AppShell({
  children,
  eyebrow,
  title,
  subtitle,
  backTo,
  backLabel = 'Back to dashboard',
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand__mark">Lounge Locator</span>
          <span className="brand__sub">Owner Portal</span>
        </Link>

        <div className="topbar__right">
          <span className="topbar__user">{auth.currentUser?.email}</span>
          <button className="btn btn--secondary" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="page">
        {backTo && (
          <Link to={backTo} className="backlink">
            ← {backLabel}
          </Link>
        )}

        <div className="page__head">
          {eyebrow && <span className="page__eyebrow">{eyebrow}</span>}
          <h1 className="page__title">{title}</h1>
          {subtitle && <p className="page__subtitle">{subtitle}</p>}
        </div>

        {children}
      </main>
    </div>
  );
}
