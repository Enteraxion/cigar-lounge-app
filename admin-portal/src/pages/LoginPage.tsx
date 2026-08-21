import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Sign-in for the admin portal.
 *
 * No "create account" and no password reset link, unlike the owner portal.
 * Admins are not self-served — the address is listed in firestore.rules — so a
 * sign-up link would offer something that cannot happen, and a reset link on a
 * page only one person can use is a phishing surface for no benefit. If that
 * password is lost it is reset from the Firebase console.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // No navigation — App.tsx swaps the route as soon as it observes the
      // session, the same pattern the owner portal and the mobile app use.
    } catch {
      // Deliberately not distinguishing "no such account" from "wrong password".
      // On a single-admin portal, confirming an address exists tells an attacker
      // they have the right target.
      setError('Incorrect email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <h1 className="login__wordmark">Lounge Locator</h1>
          <p className="login__tagline">Admin Portal</p>
        </div>

        <form onSubmit={submit} className="stack">
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="field__error">{error}</p>}

          <button className="btn btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
