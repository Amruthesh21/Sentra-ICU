import { useEffect, useMemo, useState } from 'react';
import { fetchProfilePhotoBlob } from '../api/auth';
import './AccountHoverCard.css';

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '—';
}

function roleLabel(user) {
  const type = String(user?.userType || '').toUpperCase();
  const role = String(user?.role || '').trim();
  if (type === 'SUPER_ADMIN' || role === 'SUPER_ADMIN') return 'Platform administrator';
  if (role === 'HOSPITAL_ADMIN' || role === 'ADMIN') return 'Hospital admin';
  return role || 'Clinician';
}

function AvatarMark({ letters, photoUrl, className }) {
  return (
    <span className={className} aria-hidden="true">
      {photoUrl ? <img src={photoUrl} alt="" /> : <em>{letters}</em>}
    </span>
  );
}

export default function AccountHoverCard({ user, variant = 'avatar' }) {
  const name = user?.displayName || user?.email || 'Signed in';
  const letters = useMemo(() => initials(name), [name]);
  const specialty = String(user?.specialty || '').trim();
  const username = String(user?.username || '').trim();
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await fetchProfilePhotoBlob();
        if (cancelled) return;
        if (!blob) {
          setPhotoUrl(null);
          return;
        }
        url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      } catch {
        if (!cancelled) setPhotoUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [user?.hasPhoto, user?.id]);

  return (
    <div className="account-hover">
      {variant === 'name' ? (
        <button type="button" className="account-hover-name" aria-describedby="account-hover-card">
          {name}
        </button>
      ) : (
        <button type="button" className="account-hover-avatar" aria-describedby="account-hover-card">
          <AvatarMark letters={letters} photoUrl={photoUrl} className="account-hover-face" />
        </button>
      )}
      <div id="account-hover-card" className="account-hover-card" role="tooltip">
        <div className="account-hover-card-head">
          <AvatarMark letters={letters} photoUrl={photoUrl} className="account-hover-card-mark" />
          <div>
            <strong>{name}</strong>
            <span className="account-hover-role">{roleLabel(user)}</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Email</dt>
            <dd>{user?.email || '—'}</dd>
          </div>
          {username ? (
            <div>
              <dt>Username</dt>
              <dd>{username}</dd>
            </div>
          ) : null}
          {specialty ? (
            <div>
              <dt>Specialty</dt>
              <dd>{specialty}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
