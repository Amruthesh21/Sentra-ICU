const STORAGE_KEY = 'icu_hub_auth';

let refreshInFlight = null;

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
  sessionStorage.removeItem('icu_mfa_pending');
}

function loginRedirectPath() {
  const path = window.location.pathname + window.location.search;
  if (path.startsWith('/login')) return '/login';
  return `/login?returnTo=${encodeURIComponent(path)}`;
}

export function getAccessToken() {
  return getStoredAuth()?.accessToken || null;
}

export async function readAuthJson(res) {
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || text;
    } catch { /* ignore */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  if (!text) return {};
  return JSON.parse(text);
}

export async function refreshSession() {
  const auth = getStoredAuth();
  if (!auth?.sessionId || !auth?.refreshToken) {
    throw new Error('Session expired');
  }
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: auth.sessionId,
      refreshToken: auth.refreshToken,
    }),
  });
  const session = await readAuthJson(res);
  setStoredAuth({
    ...auth,
    ...session,
    user: session.user || auth.user,
  });
  return session;
}

async function ensureRefreshedSession() {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function authFetch(url, options = {}, retried = false) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...options, headers, cache: 'no-store' });

  if (res.status === 401 && !url.includes('/api/auth/') && !retried) {
    try {
      await ensureRefreshedSession();
      return authFetch(url, options, true);
    } catch {
      clearStoredAuth();
      if (!window.location.pathname.startsWith('/login')
        && !window.location.pathname.startsWith('/mfa')
        && !window.location.pathname.startsWith('/forgot-password')
        && !window.location.pathname.startsWith('/reset-password')
        && !window.location.pathname.startsWith('/account-setup')) {
        window.location.href = loginRedirectPath();
      }
    }
  }

  return res;
}

export async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return readAuthJson(res);
}

export async function completeAccountSetup(payload) {
  const res = await fetch('/api/auth/setup/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

export async function resetPassword(payload) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readAuthJson(res);
}

export async function verifyMfa(mfaToken, code, method = 'email') {
  const res = await fetch('/api/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code, method }),
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

export async function fetchMe() {
  const res = await authFetch('/api/auth/me');
  return readAuthJson(res);
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
