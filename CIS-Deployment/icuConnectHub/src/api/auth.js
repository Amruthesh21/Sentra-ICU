const STORAGE_KEY = 'icu_hub_auth';
const MFA_KEY = 'icu_mfa_pending';

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(MFA_KEY);
  sessionStorage.removeItem('icu_setup_pending');
}

export function getAccessToken() {
  return getStoredAuth()?.accessToken || null;
}

export async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...options, headers, cache: 'no-store' });
  if (res.status === 401) {
    clearStoredAuth();
    if (!window.location.pathname.startsWith('/login')
      && !window.location.pathname.startsWith('/mfa')
      && window.location.pathname !== '/') {
      window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
    }
  }
  return res;
}

async function readAuthJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

/**
 * Login against alarm-engine's real auth API. No demo/offline fallback —
 * a failed or unreachable backend is a real error, not a silent bypass.
 */
export async function login(username, password, portal) {
  const email = String(username || '').trim().toLowerCase();
  const pass = String(password || '');
  const area = String(portal || '').trim().toLowerCase();
  if (!area) {
    throw new Error('Select Super Admin, Hospital Admin, or Clinical staff first');
  }

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password: pass, portal: area }),
  });
  const data = await readAuthJson(res);

  if (data.setupRequired && data.setupToken) {
    return {
      setupRequired: true,
      setupToken: data.setupToken,
      maskedEmail: data.maskedEmail || null,
    };
  }

  if (data.mfaRequired !== false && data.mfaToken) {
    return {
      mfaRequired: true,
      mfaToken: data.mfaToken,
      method: data.method || 'email',
      email: data.email || email,
      maskedEmail: data.maskedEmail || null,
      emailSent: !!data.emailSent,
      emailDeliveryFailed: !!data.emailDeliveryFailed,
      // Only present when the server exposes it (dev flag, or email failed).
      devOtp: data.devOtp || null,
    };
  }

  // MFA already trusted for this device/session window — the server
  // skipped straight to a real, full session (accessToken + user).
  if (data.accessToken) {
    return { authenticated: true, session: data };
  }

  throw new Error('Unexpected login response');
}

/** Completes first-time account setup for a user with a temporary password
 * (e.g. a newly-created hospital admin), using the setupToken from login(). */
export async function completeAccountSetup({ setupToken, username, displayName, specialty, password, confirmPassword }) {
  const res = await fetch('/api/auth/setup/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setupToken, username, displayName, specialty, password, confirmPassword }),
  });
  return readAuthJson(res);
}

export async function verifyMfa(mfaToken, code) {
  const otp = String(code || '').trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new Error('Enter the 6-digit verification code');
  }

  const res = await fetch('/api/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code: otp, method: 'email' }),
  });
  return readAuthJson(res);
}

export async function forgotPassword(email) {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return readAuthJson(res);
}

export async function resetPassword({ resetToken, code, password, confirmPassword }) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetToken, code, password, confirmPassword }),
  });
  return readAuthJson(res);
}

export async function resendMfa(mfaToken) {
  const res = await fetch('/api/auth/mfa/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken }),
  });
  return readAuthJson(res);
}

export async function fetchProfilePhotoBlob() {
  const res = await authFetch('/api/profile/photo');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load photo');
  return res.blob();
}

export async function logout() {
  const auth = getStoredAuth();
  try {
    if (auth?.sessionId) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: auth.sessionId }),
      });
    }
  } finally {
    clearStoredAuth();
  }
}
