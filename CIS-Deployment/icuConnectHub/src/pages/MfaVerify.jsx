import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resendMfa, verifyMfa } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { redirectAfterLogin } from '../utils/authRedirect';
import { PulseAuthShell } from '../components/PulseAuthShell';
import '../styles/pulse-auth.css';

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem('icu_mfa_pending') || 'null');
  } catch {
    return null;
  }
}

export default function MfaVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { applySession } = useAuth();
  const [pending, setPending] = useState(readPending);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resendIn, setResendIn] = useState(30);
  const inputs = useRef([]);

  useEffect(() => {
    if (!pending?.mfaToken) {
      navigate('/login', { replace: true });
    }
  }, [pending, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function setDigitAt(index, value) {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) inputs.current[index + 1]?.focus();
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = text.split('');
    while (next.length < 6) next.push('');
    setDigits(next.slice(0, 6));
    inputs.current[Math.min(text.length, 5)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit verification code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await verifyMfa(pending.mfaToken, code);
      applySession(session);
      sessionStorage.removeItem('icu_mfa_pending');
      const params = new URLSearchParams(searchParams);
      if (pending.returnTo && !params.get('returnTo')) params.set('returnTo', pending.returnTo);
      redirectAfterLogin(navigate, session.user, params);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      const result = await resendMfa(pending.mfaToken);
      const updated = { ...pending, devOtp: result.devOtp || '123456' };
      setPending(updated);
      sessionStorage.setItem('icu_mfa_pending', JSON.stringify(updated));
      setResendIn(30);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!pending?.mfaToken) return null;

  return (
    <PulseAuthShell eyebrowRight="MFA · SECURE GATE">
      <p className="pulse-auth-eyebrow">Identity verification</p>
      <h1 className="pulse-auth-title">Confirm access.</h1>
      <p className="pulse-auth-hint">
        Enter the 6-digit code sent to <strong>{pending.email}</strong>
      </p>

      {(pending.devOtp || pending.source !== 'api') && (
        <div className="pulse-auth-dev-code">
          Demo verification code: <strong>{pending.devOtp || '123456'}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="pulse-auth-otp-boxes" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => setDigitAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) {
                  inputs.current[i - 1]?.focus();
                }
              }}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {error ? <p className="pulse-auth-error">{error}</p> : null}

        <button type="submit" className="pulse-auth-submit" disabled={loading}>
          <span>{loading ? 'Verifying…' : 'Verify & enter'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <div className="pulse-auth-resend">
        {resendIn > 0 ? (
          <span className="pulse-auth-hint" style={{ margin: 0 }}>Resend code in {resendIn}s</span>
        ) : (
          <button type="button" onClick={handleResend}>Resend code</button>
        )}
      </div>

      <p className="pulse-auth-alt">
        <Link to="/login">← Back to sign in</Link>
      </p>
    </PulseAuthShell>
  );
}
