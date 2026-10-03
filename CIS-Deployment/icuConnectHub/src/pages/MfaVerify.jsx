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

function digitsFrom(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6).split('');
}

function padDigits(list) {
  const next = [...list];
  while (next.length < 6) next.push('');
  return next.slice(0, 6);
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
  const submitting = useRef(false);

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

  function applyCode(code, startAt = 0) {
    const chars = digitsFrom(code);
    if (!chars.length) return;
    setDigits((current) => {
      const next = [...current];
      chars.forEach((ch, i) => {
        if (startAt + i < 6) next[startAt + i] = ch;
      });
      return padDigits(next);
    });
    inputs.current[Math.min(startAt + chars.length, 5)]?.focus();
  }

  async function submitCode(code) {
    if (submitting.current) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code');
      return;
    }
    submitting.current = true;
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
      submitting.current = false;
      setLoading(false);
    }
  }

  function setDigitAt(index, value) {
    const raw = value.replace(/\D/g, '');
    if (raw.length > 1) {
      applyCode(raw, index);
      if (raw.length >= 6) submitCode(raw.slice(0, 6));
      return;
    }
    const next = [...digits];
    next[index] = raw.slice(-1);
    setDigits(next);
    if (raw && index < 5) inputs.current[index + 1]?.focus();
    if (next.join('').length === 6) submitCode(next.join(''));
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = padDigits(text.split(''));
    setDigits(next);
    inputs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) submitCode(text);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await submitCode(digits.join(''));
  }

  async function handleResend() {
    try {
      const result = await resendMfa(pending.mfaToken);
      const updated = {
        ...pending,
        mfaToken: result.mfaToken || pending.mfaToken,
        devOtp: result.devOtp || null,
        emailSent: !!result.emailSent,
        emailDeliveryFailed: !!result.emailDeliveryFailed,
        maskedEmail: result.maskedEmail || pending.maskedEmail,
      };
      setPending(updated);
      sessionStorage.setItem('icu_mfa_pending', JSON.stringify(updated));
      setDigits(['', '', '', '', '', '']);
      setResendIn(30);
      setError(null);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!pending?.mfaToken) return null;

  const emailLabel = pending.maskedEmail || pending.email;
  const showOnScreenCode = Boolean(pending.devOtp);

  return (
    <PulseAuthShell eyebrowRight="MFA · SECURE GATE">
      <p className="pulse-auth-eyebrow">Identity verification</p>
      <h1 className="pulse-auth-title">Confirm access.</h1>
      <p className="pulse-auth-hint">
        {pending.emailSent
          ? <>Enter the 6-digit code sent to <strong>{emailLabel}</strong>.</>
          : showOnScreenCode
            ? <>Email is not sending on this laptop (SMTP is off). Use the on-screen code.</>
            : <>Enter the 6-digit code for <strong>{emailLabel}</strong>.</>}
      </p>

      {showOnScreenCode && (
        <div className="pulse-auth-dev-code">
          <div>On-screen verification code</div>
          <strong>{pending.devOtp}</strong>
          <button
            type="button"
            className="pulse-auth-use-code"
            onClick={() => {
              const next = padDigits(digitsFrom(pending.devOtp));
              setDigits(next);
              submitCode(pending.devOtp);
            }}
          >
            Use this code
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="pulse-auth-otp-boxes" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={i === 0 ? 6 : 1}
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
        <Link to={pending?.portal ? `/login?portal=${encodeURIComponent(pending.portal)}` : '/login'}>
          ← Back to sign in
        </Link>
      </p>
    </PulseAuthShell>
  );
}
