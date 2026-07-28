const STORAGE_KEY = 'icu_hub_auth';
const MFA_KEY = 'icu_mfa_pending';

/** Demo accounts for local / hospital pitch (works without alarm-engine) */
export const DEMO_USERS = [
  {
    email: 'admin@icu.med',
    password: 'admin123',
    user: {
      id: 'demo-clinician',
      email: 'admin@icu.med',
      displayName: 'Dr. Admin',
      role: 'CLINICIAN',
      userType: 'CLINICAL',
      hospitalId: null,
    },
  },
  {
    email: 'hospital.admin@icu.med',
    password: 'admin123',
    user: {
      id: 'demo-ha',
      email: 'hospital.admin@icu.med',
      displayName: 'Hospital Admin',
      role: 'HOSPITAL_ADMIN',
      userType: 'HOSPITAL',
      hospitalId: 'demo-hospital',
    },
  },
  {
    email: 'superadmin@icu.med',
    password: 'admin123',
    user: {
      id: 'demo-sa',
      email: 'superadmin@icu.med',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN',
      userType: 'SUPER_ADMIN',
      hospitalId: null,
    },
  },
];

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

function makeSession(user) {
  return {
    accessToken: `pulse-demo-${user.id}-${Date.now()}`,
    refreshToken: `pulse-refresh-${user.id}`,
    sessionId: `sess-${user.id}`,
    user,
  };
}

/**
 * Login — tries alarm-engine first; falls back to demo accounts.
 * Always returns MFA challenge for the Sentra ICU flow.
 */
export async function login(username, password) {
  const email = String(username || '').trim().toLowerCase();
  const pass = String(password || '');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.mfaRequired !== false && data.mfaToken) {
        return {
          mfaRequired: true,
          mfaToken: data.mfaToken,
          method: data.method || 'email',
          email: data.email || email,
          devOtp: data.devOtp || data.otp || null,
          source: 'api',
        };
      }
      if (data.accessToken) {
        return {
          mfaRequired: true,
          mfaToken: `bridge-${data.sessionId || Date.now()}`,
          method: 'email',
          email,
          pendingSession: data,
          devOtp: '123456',
          source: 'api-bridge',
        };
      }
    }
  } catch {
    /* demo fallback */
  }

  const demo = DEMO_USERS.find((u) => u.email === email && u.password === pass);
  if (!demo) {
    throw new Error('Invalid email or password');
  }

  const mfaToken = `demo-mfa-${demo.user.id}-${Date.now()}`;
  sessionStorage.setItem(`pulse_mfa_user_${mfaToken}`, JSON.stringify(demo.user));

  return {
    mfaRequired: true,
    mfaToken,
    method: 'email',
    email: demo.user.email,
    displayName: demo.user.displayName,
    devOtp: '123456',
    source: 'demo',
  };
}

export async function verifyMfa(mfaToken, code) {
  const otp = String(code || '').trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new Error('Enter the 6-digit verification code');
  }

  try {
    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken, code: otp, method: 'email' }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    /* demo fallback */
  }

  // Demo / bridge path
  if (otp !== '123456') {
    throw new Error('Invalid verification code');
  }

  const pendingRaw = sessionStorage.getItem('icu_mfa_pending');
  let pending = null;
  try {
    pending = pendingRaw ? JSON.parse(pendingRaw) : null;
  } catch {
    pending = null;
  }

  if (pending?.pendingSession?.accessToken) {
    return pending.pendingSession;
  }

  const userRaw = sessionStorage.getItem(`pulse_mfa_user_${mfaToken}`);
  if (userRaw) {
    const user = JSON.parse(userRaw);
    sessionStorage.removeItem(`pulse_mfa_user_${mfaToken}`);
    return makeSession(user);
  }

  // Recover from pending email
  const demo = DEMO_USERS.find((u) => u.email === String(pending?.email || '').toLowerCase());
  if (demo) return makeSession(demo.user);

  throw new Error('MFA session expired — sign in again');
}

export async function resendMfa() {
  return { ok: true, message: 'Code resent', devOtp: '123456' };
}

export async function logout() {
  const auth = getStoredAuth();
  try {
    if (auth?.sessionId && !String(auth.accessToken || '').startsWith('pulse-demo-')) {
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
