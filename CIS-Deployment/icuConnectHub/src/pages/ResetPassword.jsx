import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import AuthPageShell from '../components/AuthPageShell';

const CODE_LEN = 6;

function loadResetPending() {
  try {
    const raw = sessionStorage.getItem('icu_reset_pending');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [pending] = useState(loadResetPending);
  const [digits, setDigits] = useState(Array(CODE_LEN).fill(''));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (!pending?.resetToken) navigate('/forgot-password', { replace: true });
  }, [pending, navigate]);

  function updateDigit(index, value) {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < CODE_LEN - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LEN);
    if (!text) return;
    e.preventDefault();
    const next = Array(CODE_LEN).fill('');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputsRef.current[Math.min(text.length, CODE_LEN - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < CODE_LEN) {
      setError('Enter the 6-digit reset code from your email');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await resetPassword({
        resetToken: pending.resetToken,
        code,
        password,
        confirmPassword,
      });
      sessionStorage.removeItem('icu_reset_pending');
      setSuccess(result.message || 'Password updated. You can sign in now.');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(err.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  }

  if (!pending) return null;

  return (
    <AuthPageShell
      title="Reset Password"
      subtitle={`Enter the code sent to ${pending.maskedEmail || 'your email'} and choose a new password.`}
    >
      {pending.devMode && pending.devOtp && (
        <div className="auth-dev-otp-banner">
          <p className="auth-dev-otp-label">Development mode — reset code:</p>
          <p className="auth-dev-otp-code">{pending.devOtp}</p>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label">Reset code</label>
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
        {success ? <p className="auth-success">{success}</p> : null}

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </button>

        <p className="auth-card-foot">
          <Link to="/forgot-password" className="auth-inline-link">Request a new code</Link>
          {' · '}
          <Link to="/login" className="auth-inline-link">Sign in</Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
