import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * The persistent frame around every page: a left sidebar of sections and a main
 * content area, the layout Rohith picked on 2026-08-21.
 *
 * A sidebar rather than the owner portal's top bar because the two products have
 * different shapes. An owner manages one lounge and moves between a handful of
 * pages about it; an admin moves constantly between unrelated areas — a queue, a
 * table of 8,496 lounges, a member list — and needs all of them one click away
 * with the current one visibly marked.
 *
 * Sections that are not built yet are still listed, marked "soon" and not
 * clickable. Hiding them would make the portal look finished and leave no hint of
 * what is coming; a dead link that silently does nothing is worse than a label
 * that admits it.
 */

export type SectionId =
  | 'dashboard'
  | 'approvals'
  | 'lounges'
  | 'members'
  | 'reports'
  | 'reviews'
  | 'operations';

type Section = { id: SectionId; label: string; to?: string; hint: string };

const SECTIONS: Section[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'System health at a glance' },
  { id: 'approvals', label: 'Approvals', to: '/approvals', hint: 'IDs and business claims' },
  { id: 'lounges', label: 'Lounges', to: '/lounges', hint: 'All 8,496 listings' },
  { id: 'members', label: 'Members', hint: 'Accounts and verification status' },
  { id: 'reports', label: 'Reports', hint: 'Issues members have reported' },
  { id: 'reviews', label: 'Reviews', hint: 'Moderation' },
  { id: 'operations', label: 'Operations', hint: 'Imports and backfills' },
];

export default function AdminShell({
  children,
  active,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  active: SectionId;
  title: string;
  subtitle?: string;
  /** Right-aligned controls in the page header — filters, refresh, counts. */
  actions?: ReactNode;
}) {
  const location = useLocation();

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__mark">Lounge Locator</span>
          <span className="sidebar__sub">Admin</span>
        </div>

        <nav className="sidebar__nav">
          {SECTIONS.map(section => {
            const isActive = section.id === active;
            if (!section.to) {
              return (
                <span
                  key={section.id}
                  className="navitem navitem--disabled"
                  title={`${section.hint} — not built yet`}
                >
                  {section.label}
                  <span className="navitem__soon">soon</span>
                </span>
              );
            }
            return (
              <Link
                key={section.id}
                to={section.to}
                className={`navitem${isActive || location.pathname === section.to ? ' navitem--active' : ''}`}
                title={section.hint}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__foot">
          <span className="sidebar__user" title={auth.currentUser?.email ?? ''}>
            {auth.currentUser?.email}
          </span>
          <button className="btn btn--secondary btn--block" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="content__head">
          <div>
            <h1 className="content__title">{title}</h1>
            {subtitle && <p className="content__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="content__actions">{actions}</div>}
        </div>

        {children}
      </main>
    </div>
  );
}
