import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import EditListingPage from './pages/EditListingPage';
import ReservationsPage from './pages/ReservationsPage';
import InventoryPage from './pages/InventoryPage';
import EventsPage from './pages/EventsPage';

function SplashScreen() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted)',
      }}
    >
      Loading…
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, nextUser => {
      setUser(nextUser);
      setInitializing(false);
    });
  }, []);

  if (initializing) {
    return <SplashScreen />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        {/* Signed-out route by design — someone who can't get in is exactly
            who needs this page. */}
        <Route
          path="/forgot-password"
          element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
        />
        <Route path="/" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
        <Route
          path="/listing/:loungeId/edit"
          element={user ? <EditListingPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/listing/:loungeId/reservations"
          element={user ? <ReservationsPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/listing/:loungeId/inventory"
          element={user ? <InventoryPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/listing/:loungeId/events"
          element={user ? <EventsPage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
