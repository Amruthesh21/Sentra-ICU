import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { redirectAfterLogin } from '../utils/authRedirect';
import { PulseAuthShell } from '../components/PulseAuthShell';
import '../styles/pulse-auth.css';

const PORTALS = [
  {
    id: 'platform',
    title: 'Super Admin',
    copy: 'You operate the platform. Manage every hospital from one dashboard.',
    headline: 'Platform access.',
    submit: 'Enter platform',
  },
  {
    id: 'hospital',
    title: 'Hospital Admin',
    copy: 'You run one hospital. Units, beds, staff, and devices for that site only.',
    headline: 'Hospital access.',
    submit: 'Enter hospital',
  },
  {
    id: 'clinical',
    title: 'Doctors & nurses',
    copy: 'You work the ward. Live vitals, waveforms, and the beds your hospital configured.',
    headline: 'Access the unit.',
    submit: 'Enter dashboard',
  },
];

function portalFromSearch(searchParams) {
  const raw = String(searchParams.get('portal') || '').toLowerCase();
  return PORTALS.find((p) => p.id === raw) || null;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { applySession } = useAuth();
  const initialPortal = useMemo(() => portalFromSearch(searchParams), [searchParams]);
  const [portal, setPortal] = useState(initialPortal);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function choosePortal(next) {
    setPortal(next);
    setError(null);
    const params = new URLSearchParams(searchParams);
    params.set('portal', next.id);
    navigate(`/login?${params.toString()}`, { replace: true });
  }

  function clearPortal() {
    setPortal(null);
    setEmail('');
    setPassword('');
    setError(null);
    const params = new URLSearchParams(searchParams);
    params.delete('portal');
    const qs = params.toString();
    navigate(qs ? `/login?${qs}` : '/login', { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!portal) {
      setError('Select Super Admin, Hospital Admin, or Clinical staff first');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password, portal.id);
      if (result.setupRequired) {
        sessionStorage.setItem('icu_setup_pending', JSON.stringify({
          setupToken: result.setupToken,
          maskedEmail: result.maskedEmail,
        }));
        navigate('/account-setup');
        return;
      }
      if (result.authenticated) {
        applySession(result.session);
        redirectAfterLogin(navigate, result.session.user, searchParams);
        return;
      }
      sessionStorage.setItem('icu_mfa_pending', JSON.stringify({
        mfaToken: result.mfaToken,
        email: result.email || email.trim(),
        maskedEmail: result.maskedEmail || null,
        method: result.method || 'email',
        emailSent: result.emailSent,
        emailDeliveryFailed: result.emailDeliveryFailed,
        devOtp: result.devOtp || null,
        returnTo: searchParams.get('returnTo') || '',
        portal: portal.id,
      }));
      const qs = searchParams.toString();
      navigate(`/mfa${qs ? `?${qs}` : ''}`);
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  if (!portal) {
    return (
      <PulseAuthShell>
        <p className="pulse-auth-eyebrow">Choose your area</p>
        <h1 className="pulse-auth-title pulse-auth-title--pick">Who is signing in?</h1>
        <p className="pulse-auth-hint">Credentials only work in the area they belong to.</p>
        <div className="pulse-auth-portals">
          {PORTALS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pulse-auth-portal"
              onClick={() => choosePortal(item)}
            >
              <span className="pulse-auth-portal-title">{item.title}</span>
              <span className="pulse-auth-portal-copy">{item.copy}</span>
            </button>
          ))}
        </div>
      </PulseAuthShell>
    );
  }

  return (
    <PulseAuthShell>
      <p className="pulse-auth-eyebrow">{portal.title}</p>
      <h1 className="pulse-auth-title">{portal.headline}</h1>

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
          <span>{loading ? 'Signing in…' : portal.submit}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <p className="pulse-auth-alt">
        <button type="button" onClick={clearPortal}>← Choose a different area</button>
      </p>
    </PulseAuthShell>
  );
}
