import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import RtowLogo from '../components/RtowLogo';
import { redirectAfterLogin } from '../utils/authRedirect';
import '../styles/auth-login.css';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { applySession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username.trim(), password);

      if (result.setupRequired) {
        sessionStorage.setItem('icu_setup_pending', JSON.stringify({
          setupToken: result.setupToken,
          maskedEmail: result.maskedEmail,
        }));
        navigate('/account-setup');
        return;
      }

      if (result.accessToken && result.mfaRequired === false) {
        applySession(result);
        redirectAfterLogin(navigate, result.user, searchParams);
        return;
      }

      sessionStorage.setItem('icu_mfa_pending', JSON.stringify({
        mfaToken: result.mfaToken,
        maskedEmail: result.maskedEmail,
        methods: result.methods || ['email'],
        remember,
        devOtp: result.devOtp,
        devMode: result.devMode,
        emailDeliveryFailed: result.emailDeliveryFailed,
        emailSent: result.emailSent,
      }));
      navigate(`/mfa?${searchParams.toString()}`);
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell-inner">
        <section className="auth-brand">
          <RtowLogo blend />
          <h1 className="auth-product-title">ICU Connect V2 — Critical Care Monitoring Platform</h1>
          <p className="auth-product-tagline">Live Vitals. Faster Decisions. Zero Delays.</p>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <h2 className="auth-card-title">Welcome Back</h2>
            <p className="auth-card-sub">Sign In to access your Dashboard</p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-label">
                Email or username
                <input
                  className="auth-input"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>

              <label className="auth-label">
                Password
                <div className="auth-password-wrap">
                  <input
                    className="auth-input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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

              <div className="auth-row">
                <label className="auth-remember">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember me
                </label>
                <Link to="/forgot-password" className="auth-link-btn auth-link-btn--active">
                  Forgot password?
                </Link>
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <p className="auth-card-foot auth-card-foot--hint">
                First-time hospital admin? Sign in with your registered email and temporary password.
              </p>
            </form>
          </div>
        </section>
      </div>

      <footer className="auth-footer">
        <span>V2.0</span>
        <span>Privacy Policy</span>
        <span>© Rtwo Healthcare Technologies</span>
      </footer>
    </div>
  );
}
