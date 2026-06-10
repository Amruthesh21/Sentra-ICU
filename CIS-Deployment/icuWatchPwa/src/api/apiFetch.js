const NGROK_HOSTS = ['ngrok-free.dev', 'ngrok.io', 'ngrok.app'];

function isNgrokHost(hostname) {
  return NGROK_HOSTS.some((suffix) => hostname.includes(suffix));
}

export function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});

  if (isNgrokHost(window.location.hostname)) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers, cache: 'no-store' });
}

export async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('ngrok') || text.includes('<!DOCTYPE')) {
      throw new Error('Ngrok blocked the request. Close and reopen the app, then try again.');
    }
    throw new Error(`Server error (${res.status})`);
  }
}
