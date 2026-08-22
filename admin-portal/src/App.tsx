import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { isAdminEmail } from './lib/admins';
import LoginPage from './pages/LoginPage';
import ApprovalsPage from './pages/ApprovalsPage';
import LoungesPage from './pages/LoungesPage';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import ReportsPage from './pages/ReportsPage';
import ReviewsPage from './pages/ReviewsPage';
import OperationsPage from './pages/OperationsPage';

function Splash() {
  return <div className="splash">Loading…</div>;
}

/**
 * Shown to somebody who signs in successfully but is not an admin — a shop owner
 * using their app password, most likely.
 *
 * They need to be told plainly and given a way out. Without this they would land
 * on a dashboard where every query fails, and read that as the portal being
 * broken rather than as them being in the wrong place. This is courtesy, not
 * security: firestore.rules refuses their reads regardless of what the interface
 * does.
 */
function NoAccess({ email }: { email: string | null }) {
  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <h1 className="login__wordmark">Lounge Locator</h1>
          <p className="login__tagline">Admin Portal</p>
        </div>
        <p className="muted" style={{ textAlign: 'center' }}>
          <strong>{email}</strong> does not have admin access.
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
          If you manage a lounge, use the Owner Portal or the My Shops section of the mobile
          app instead.
        </p>
        <button className="btn btn--secondary btn--block" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, nextUser => {
        setUser(nextUser);
        setInitializing(false);
      }),
    [],
  );

  if (initializing) {
    return <Splash />;
  }
  if (!user) {
    return <LoginPage />;
  }
  if (!isAdminEmail(user.email)) {
    return <NoAccess email={user.email} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/lounges" element={<LoungesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        {/* Dashboard is the landing page now that it exists — it answers "is
            there anything to do" before you have to click anything. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
