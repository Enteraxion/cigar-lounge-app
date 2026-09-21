import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useOwnedLounges } from '../lib/useOwnedLounges';

/**
 * Persistent chrome around every signed-in page: a left sidebar (brand,
 * lounge switcher, section nav, signed-in account + sign out) instead of
 * the old top-bar-only layout — matching the page-structure pattern of the
 * Kiki Momo admin dashboard (persistent nav shell, collapsible on mobile),
 * while keeping this app's own navy/gold theme.
 *
 * Nav links are scoped to whichever lounge is "active": the one in the
 * current route if a page passes `loungeId`, else the first owned lounge.
 * Switching lounges re-points every nav link at the new id, keeping you on
 * the same section (Inventory stays Inventory) rather than bouncing back
 * to the dashboard.
 */
type NavItem = { label: string; suffix: string };

const NAV_ITEMS: NavItem[] = [
  { label: 'Edit Listing', suffix: 'edit' },
  { label: 'Inventory', suffix: 'inventory' },
  { label: 'Events', suffix: 'events' },
  { label: 'Staff Picks', suffix: 'staff-picks' },
  { label: 'Reservations', suffix: 'reservations' },
];

export default function AppShell({
  children,
  eyebrow,
  title,
  subtitle,
  loungeId,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** The lounge this page belongs to, if any (absent on the dashboard). */
  loungeId?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { lounges } = useOwnedLounges();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeLoungeId = loungeId ?? lounges[0]?.id;
  const activeLounge = lounges.find(l => l.id === activeLoungeId);
  const canManage = !!activeLounge?.ownerId;

  const switchLounge = (nextId: string) => {
    setMobileNavOpen(false);
    if (!nextId) return;
    const currentSuffix = NAV_ITEMS.find(item => location.pathname.endsWith(`/${item.suffix}`))?.suffix;
    navigate(currentSuffix ? `/listing/${nextId}/${currentSuffix}` : `/listing/${nextId}/edit`);
  };

  return (
    <div className="shell shell--sidebar">
      <button
        className="sidebar-toggle"
        onClick={() => setMobileNavOpen(open => !open)}
        aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileNavOpen}
      >
        <span className="sidebar-toggle__bar" />
        <span className="sidebar-toggle__bar" />
        <span className="sidebar-toggle__bar" />
      </button>

      {mobileNavOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside className={`sidebar ${mobileNavOpen ? 'sidebar--open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setMobileNavOpen(false)}>
          <span className="brand__mark">Lounge Locator</span>
          <span className="brand__sub">Owner Portal</span>
        </Link>

        {lounges.length > 0 && (
          <div className="sidebar__switcher">
            <span className="field__label">Lounge</span>
            <select
              className="select"
              value={activeLoungeId ?? ''}
              onChange={e => switchLounge(e.target.value)}
            >
              {lounges.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="sidebar__nav">
          <Link
            to="/"
            className={`sidebar__link ${location.pathname === '/' ? 'sidebar__link--active' : ''}`}
            onClick={() => setMobileNavOpen(false)}
          >
            Dashboard
          </Link>

          {NAV_ITEMS.map(item => {
            const href = activeLoungeId ? `/listing/${activeLoungeId}/${item.suffix}` : undefined;
            const active = !!href && location.pathname === href;
            if (!href || !canManage) {
              return (
                <span key={item.suffix} className="sidebar__link sidebar__link--disabled">
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.suffix}
                to={href}
                className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span className="topbar__user">{auth.currentUser?.email}</span>
          <button className="btn btn--secondary btn--block" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="page">
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
