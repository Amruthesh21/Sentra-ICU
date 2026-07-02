import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resendMfa, verifyMfa } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { redirectAfterLogin } from '../utils/authRedirect';
import RtowLogo from '../components/RtowLogo';
import '../styles/auth-login.css';

const OTP_LEN = 6;

function loadMfaPending() {
  try {
    const raw = sessionStorage.getItem('icu_mfa_pending');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function MfaVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { applySession } = useAuth();
  const [pending, setPending] = useState(loadMfaPending);
  const [digits, setDigits] = useState(Array(OTP_LEN).fill(''));
  const [method, setMethod] = useState('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (!pending?.mfaToken) navigate('/login', { replace: true });
  }, [pending, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (pending?.methods?.includes('totp') && !pending?.methods?.includes('email')) {
      setMethod('totp');
    }
  }, [pending]);

  function updateDigit(index, value) {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < OTP_LEN - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (!text) return;
    e.preventDefault();
    const next = Array(OTP_LEN).fill('');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputsRef.current[Math.min(text.length, OTP_LEN - 1)]?.focus();
  }

  async function handleVerify(e) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < OTP_LEN) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const session = await verifyMfa(pending.mfaToken, code, method);
      applySession(session);
      sessionStorage.removeItem('icu_mfa_pending');
      redirectAfterLogin(navigate, session?.user, searchParams);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || method !== 'email') return;
    setError('');
    try {
      const result = await resendMfa(pending.mfaToken);
      const updated = {
        ...pending,
        mfaToken: result.mfaToken,
        devOtp: result.devOtp,
        devMode: result.devMode,
        emailDeliveryFailed: result.emailDeliveryFailed,
        emailSent: result.emailSent,
      };
      setPending(updated);
      sessionStorage.setItem('icu_mfa_pending', JSON.stringify(updated));
      setResendIn(result.resendAfterSeconds || 30);
      setDigits(Array(OTP_LEN).fill(''));
    } catch (err) {
      setError(err.message || 'Could not resend code');
    }
  }

  function toggleMethod() {
    if (!pending?.methods?.includes('totp')) return;
    setMethod((m) => (m === 'email' ? 'totp' : 'email'));
    setDigits(Array(OTP_LEN).fill(''));
    setError('');
  }

  if (!pending) return null;

  const masked = pending.maskedEmail || 'your email';
  const hint = method === 'totp'
    ? 'Enter the 6-digit code from your authenticator app'
    : `Verification code has been sent to ${masked}`;

  return (
    <div className="auth-shell">
      <div className="auth-shell-inner">
        <section className="auth-brand auth-brand--logo-only">
          <RtowLogo blend />
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card auth-card--mfa">
          <h2 className="auth-card-title">Verify Your Identity</h2>
          <p className="auth-card-sub auth-card-sub--center">{hint}</p>

          {pending.devMode && method === 'email' && (
            <div className="auth-dev-otp-banner">
              <p className="auth-dev-otp-label">Development mode — use this code:</p>
              <p className="auth-dev-otp-code">{pending.devOtp || '123456'}</p>
              <p className="auth-dev-otp-note">Email delivery is disabled for local POC. Production will use real email OTP.</p>
            </div>
          )}

          {!pending.devMode && pending.emailSent && !pending.devOtp && method === 'email' && (
            <p className="auth-email-hint">
              Check inbox and spam for mail from <strong>monish.reddy@invensis.net</strong>.
              {' '}Didn&apos;t receive it? Wait for Resend, then the code will appear here.
            </p>
          )}

          {!pending.devMode && pending.emailDeliveryFailed && method === 'email' && (
            <p className="auth-email-fail">
              Email could not be delivered. Use the code below or try Resend Code.
            </p>
          )}

          {!pending.devMode && pending.devOtp && method === 'email' && (
            <p className="auth-dev-otp">Verification code: <strong>{pending.devOtp}</strong></p>
          )}

          <form onSubmit={handleVerify}>
            <div className="auth-otp-row" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  className="auth-otp-box"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => updateDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            {method === 'email' && (
              <div className="auth-resend-row">
                {resendIn > 0 ? (
                  <span className="auth-resend-muted">Resend Code in {resendIn}s</span>
                ) : (
                  <button type="button" className="auth-link-btn" onClick={handleResend}>
                    Resend Code
                  </button>
                )}
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          {pending.methods?.includes('totp') && (
            <button type="button" className="auth-alt-link" onClick={toggleMethod}>
              {method === 'email' ? 'Use authenticator app instead' : 'Use email code instead'}
            </button>
          )}
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
