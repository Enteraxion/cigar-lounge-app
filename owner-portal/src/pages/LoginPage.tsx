import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

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
    } catch {
      setError('Incorrect email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <h1 className="login__wordmark">Lounge Locator</h1>
          <p className="login__tagline">Owner Portal</p>
        </div>

        <form onSubmit={submit} className="stack">
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@yourbusiness.com"
              autoComplete="email"
              required
            />
          </label>

          {/* The reset link sits below the field rather than beside the
              label so the label row stays clean — and it's outside the
              <label> so clicking it doesn't also focus the password input. */}
          <div className="stack stack--tight">
            <label className="field">
              <span className="field__label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </label>
            <Link to="/forgot-password" className="field__action field__action--end">
              Forgot password?
            </Link>
          </div>

          {error && <p className="msg msg--error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        {/* There's deliberately no sign-up here: an owner account only
            exists once they've claimed their business in the mobile app,
            so a "Create account" form on the web would create an account
            with nothing attached to it. */}
        <p className="login__hint">
          Use the same account you use in the Lounge Locator app. Don't have one yet? Claim your
          business in the app first, then sign in here.
        </p>
      </div>
    </div>
  );
}
