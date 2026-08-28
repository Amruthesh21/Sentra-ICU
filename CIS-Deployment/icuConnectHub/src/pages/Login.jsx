import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api/auth';
import { PulseAuthShell } from '../components/PulseAuthShell';
import '../styles/pulse-auth.css';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.setupRequired) {
        sessionStorage.setItem('icu_setup_pending', JSON.stringify({
          setupToken: result.setupToken,
          maskedEmail: result.maskedEmail,
        }));
        navigate('/account-setup');
        return;
      }
      sessionStorage.setItem('icu_mfa_pending', JSON.stringify({
        mfaToken: result.mfaToken,
        email: result.email || email.trim(),
        method: result.method || 'email',
        devOtp: result.devOtp || null,
        returnTo: searchParams.get('returnTo') || '',
      }));
      const qs = searchParams.toString();
      navigate(`/mfa${qs ? `?${qs}` : ''}`);
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PulseAuthShell>
      <p className="pulse-auth-eyebrow">Secure clinical terminal</p>
      <h1 className="pulse-auth-title">Access the unit.</h1>

      <form onSubmit={handleSubmit}>
        <div className="pulse-auth-field">
          <label htmlFor="pulse-email">Email</label>
          <input
            id="pulse-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="pulse-auth-field">
          <label htmlFor="pulse-password">Password</label>
          <input
            id="pulse-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error ? <p className="pulse-auth-error">{error}</p> : null}

        <button type="submit" className="pulse-auth-submit" disabled={loading}>
          <span>{loading ? 'Signing in…' : 'Enter dashboard'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <p className="pulse-auth-alt">
        No credentials? <Link to="/">Register a clinician account</Link>
      </p>
    </PulseAuthShell>
  );
}
