const DEFAULT_SERVER = 'https://ntfy.sh';

function isEnabled() {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) return false;
  if (process.env.NTFY_ENABLED === 'false' || process.env.NTFY_ENABLED === '0') return false;
  return true;
}

function pulseCount() {
  const raw = process.env.NTFY_PULSES;
  const n = raw ? parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 5) : 3;
}

function topicForDoctor(doctorId) {
  const base = process.env.NTFY_TOPIC.trim();
  if (base.includes('{doctorId}')) {
    return base.replace('{doctorId}', doctorId || 'doctor-001');
  }
  return base;
}

function asciiHeader(value) {
  return String(value || '')
    .replace(/\u2014/g, '-')
    .replace(/[^\x00-\xFF]/g, '')
    .trim();
}

function reAlertEnabled() {
  const value = process.env.NTFY_RE_ALERT;
  if (value === 'false' || value === '0') return false;
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishOnce({ server, topic, title, body }) {
  const url = `${server}/${topic}`;
  const headers = {
    Title: asciiHeader(title) || 'ICU ALARM',
    Priority: 'urgent',
    'X-Priority': '5',
    Tags: 'warning,rotating_light',
    Cache: 'no',
    'Content-Type': 'text/plain; charset=utf-8',
  };
  const messageBody = asciiHeader(body) || 'Patient vital sign alert';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: messageBody,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`ntfy publish failed (${response.status})`);
    }
    return { sent: true, topic, url: `${server}/${topic}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Urgent ntfy alert for Apple Watch on-screen pop-up + sound.
 * PWA web-push mirrors to watch silently — use ntfy native app on the watch instead.
 */
async function sendNtfyAlert({ doctorId, title, body }) {
  if (!isEnabled()) return { sent: false, skipped: true };

  const topic = topicForDoctor(doctorId);
  const server = (process.env.NTFY_SERVER || DEFAULT_SERVER).replace(/\/$/, '');
  const alertTitle = asciiHeader(title) || 'ICU ALARM';
  const alertBody = asciiHeader(body) || 'Patient vital sign alert';

  const total = reAlertEnabled() ? pulseCount() : 1;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let result;
      for (let pulse = 1; pulse <= total; pulse += 1) {
        if (pulse > 1) await sleep(2000);
        result = await publishOnce({
          server,
          topic,
          title: pulse === 1 ? alertTitle : `${alertTitle} - CHECK PATIENT`,
          body: alertBody,
        });
      }
      return { ...result, pulses: total };
    } catch (err) {
      lastError = err;
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError || new Error('ntfy publish failed');
}

function subscribeUrl(doctorId) {
  const topic = topicForDoctor(doctorId || 'doctor-001');
  const server = (process.env.NTFY_SERVER || DEFAULT_SERVER).replace(/\/$/, '');
  const host = server.replace(/^https?:\/\//, '');
  return {
    web: `${server}/${topic}`,
    app: `ntfy://${host}/${topic}`,
    topic,
  };
}

module.exports = { isEnabled, sendNtfyAlert, topicForDoctor, subscribeUrl };
