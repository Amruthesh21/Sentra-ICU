import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import AuthPageShell from '../components/AuthPageShell';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await forgotPassword(email.trim());
      if (result.resetToken) {
        sessionStorage.setItem('icu_reset_pending', JSON.stringify({
          resetToken: result.resetToken,
          maskedEmail: result.maskedEmail || email.trim(),
          devOtp: result.devOtp,
          devMode: result.devMode,
          emailDeliveryFailed: result.emailDeliveryFailed,
        }));
        navigate('/reset-password');
        return;
      }
      setMessage(result.message || 'If an account exists for this email, a reset code has been sent.');
    } catch (err) {
      setError(err.message || 'Could not send reset code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell
      title="Forgot Password"
      subtitle="Enter your registered email. We will send a reset code."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label">
          Email address
          <input
            className="auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        {message ? <p className="auth-success">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset code'}
        </button>

        <p className="auth-card-foot">
          <Link to="/login" className="auth-inline-link">← Back to sign in</Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
