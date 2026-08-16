import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Password reset for owners. The portal previously had no route out of
 * the login screen at all — an owner who forgot their password had no way
 * back in, and no self-serve path existed on the web at all (the mobile
 * app has ForgotPasswordScreen, but the portal is meant to stand on its
 * own for someone working from a laptop).
 *
 * Deliberately shows the same confirmation whether or not the address has
 * an account. Firebase distinguishes them (auth/user-not-found), but
 * surfacing that difference would let anyone test which emails are
 * registered — and the mobile screen's behaviour of reporting the raw
 * error does leak exactly that. Worth aligning the app to this later.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (caught) {
      // An unknown address is not an error the user should see — see the
      // header comment. Anything genuinely broken (offline, malformed
      // address, rate limited) still surfaces.
      const code = (caught as { code?: string })?.code;
      if (code && code !== 'auth/user-not-found' && code !== 'auth/invalid-email') {
        setError("Couldn't send the reset email. Please try again in a moment.");
        setSubmitting(false);
        return;
      }
      if (code === 'auth/invalid-email') {
        setError("That doesn't look like a valid email address.");
        setSubmitting(false);
        return;
      }
    }
    setSent(true);
    setSubmitting(false);
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <h1 className="login__wordmark">The Reserve</h1>
          <p className="login__tagline">Owner Portal</p>
        </div>

        {sent ? (
          <div className="stack">
            <h2 style={{ fontSize: 20, textAlign: 'center' }}>Check your email</h2>
            <p className="muted" style={{ textAlign: 'center' }}>
              If an account exists for <strong style={{ color: 'var(--silver)' }}>{email.trim()}</strong>,
              we've sent a link to reset your password. It may take a minute to arrive.
            </p>
            <Link to="/login" className="btn btn--primary btn--block">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="stack">
            <p className="muted" style={{ textAlign: 'center' }}>
              Enter your email and we'll send you a link to reset your password.
            </p>

            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                autoComplete="email"
              />
            </label>

            {error && <p className="msg msg--error">{error}</p>}

            <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send Reset Link'}
            </button>

            <Link to="/login" className="btn btn--ghost" style={{ justifyContent: 'center' }}>
              Back to Sign In
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
