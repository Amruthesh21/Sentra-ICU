import { useState } from 'react';

export function generateTempPassword() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `Welcome@${suffix}`;
}

export default function AdminCredentialsModal({
  open,
  title = 'Hospital admin credentials',
  email,
  tempPassword,
  hospitalName,
  onClose,
}) {
  const [copied, setCopied] = useState('');

  if (!open) return null;

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  }

  return (
    <div className="order-modal-overlay" onClick={onClose}>
      <div className="order-modal sa-credentials-modal" onClick={(e) => e.stopPropagation()}>
        <div className="order-modal-head">
          <h3>{title}</h3>
          <button type="button" className="order-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sa-credentials-body">
          {hospitalName ? (
            <p className="muted">
              Share these credentials with the hospital admin for
              {' '}
              <strong>{hospitalName}</strong>
              . They must sign in with <strong>email</strong> and this temporary password, then complete profile setup.
            </p>
          ) : (
            <p className="muted">
              Share these credentials with the hospital admin. First sign-in uses <strong>email</strong> and the temporary password below.
            </p>
          )}
          <div className="sa-credential-row">
            <span className="sa-credential-label">Email</span>
            <code className="sa-credential-value">{email}</code>
            <button type="button" className="btn btn-sm" onClick={() => copyText('email', email)}>
              {copied === 'email' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="sa-credential-row sa-credential-row--highlight">
            <span className="sa-credential-label">Temporary password</span>
            <code className="sa-credential-value">{tempPassword}</code>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => copyText('password', tempPassword)}>
              {copied === 'password' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="order-info-banner sa-credentials-note">
            Save this password now. It will not be shown again after you close this dialog.
          </p>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
