import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { completeAccountSetup } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import AuthPageShell from '../components/AuthPageShell';
import { redirectAfterLogin } from '../utils/authRedirect';

const SPECIALTIES = [
  'Intensivist / Critical Care',
  'Anesthesiology',
  'Pulmonology',
  'Cardiology',
  'Emergency Medicine',
  'Internal Medicine',
  'Nephrology',
  'Neurology',
  'General Surgery',
  'Other',
];

function loadSetupPending() {
  try {
    const raw = sessionStorage.getItem('icu_setup_pending');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function AccountSetup() {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [pending] = useState(loadSetupPending);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pending?.setupToken) navigate('/login', { replace: true });
  }, [pending, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await completeAccountSetup({
        setupToken: pending.setupToken,
        username: username.trim(),
        displayName: displayName.trim(),
        specialty,
        password,
        confirmPassword,
      });
      sessionStorage.removeItem('icu_setup_pending');
      applySession(session);
      redirectAfterLogin(navigate, session.user, new URLSearchParams());
    } catch (err) {
      setError(err.message || 'Could not complete setup');
    } finally {
      setLoading(false);
    }
  }

  if (!pending) return null;

  return (
    <AuthPageShell
      title="Complete Your Profile"
      subtitle={`Set up your hospital admin account for ${pending.maskedEmail || 'your hospital'}`}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label">
          Username
          <input
            className="auth-input"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        </label>

        <label className="auth-label">
          Full name
          <input
            className="auth-input"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>

        <label className="auth-label">
          Specialty
          <select className="auth-input" value={specialty} onChange={(e) => setSpecialty(e.target.value)} required>
            {SPECIALTIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="auth-label">
          New password
          <div className="auth-password-wrap">
            <input
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </label>

        <label className="auth-label">
          Confirm password
          <input
            className="auth-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Saving…' : 'Create account & sign in'}
        </button>

        <p className="auth-card-foot">
          <Link to="/login" className="auth-inline-link">← Back to sign in</Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
