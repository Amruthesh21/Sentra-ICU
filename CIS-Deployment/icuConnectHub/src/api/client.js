import { authFetch } from './auth';

export function apiFetch(url, options = {}) {
  return authFetch(url, options);
}

export async function readJson(res) {
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    if (text.trimStart().startsWith('<')) {
      msg = `Request failed (${res.status}) — server returned HTML instead of JSON`;
    } else {
      try {
        const j = JSON.parse(text);
        msg = j.error || j.message || text;
      } catch { /* keep text */ }
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  if (!text) return {};
  if (text.trimStart().startsWith('<')) {
    throw new Error('Server returned HTML instead of JSON — API route may be missing');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from server');
  }
}
