const webpush = require('web-push');

let configured = false;

function configure(vapidPublicKey, vapidPrivateKey, vapidEmail) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  configured = true;
}

function buildNotificationPayload(alarm) {
  const bedShort = (alarm.bedId || '').replace('ICU-1-', '');
  const direction = alarm.threshold === 'LOW' ? 'dropped to' : 'rose to';
  const unit = getUnit(alarm.paramName);
  const thresholdLabel = alarm.threshold === 'LOW' ? 'low' : 'high';

  const patientLabel = alarm.patientName ? `${alarm.patientName} · ` : '';
  const title = `⚠ ICU Alarm — ${bedShort}`;
  const body = `${patientLabel}${alarm.paramName} ${direction} ${alarm.currentValue}${unit} (${thresholdLabel} ${alarm.threshold === 'LOW' ? '<' : '>'} ${alarm.thresholdValue}${unit})`;

  const severity = alarm.severity || 'CRITICAL';

  return {
    title,
    body,
    badge: '/icon-192.png',
    silent: false,
    requireInteraction: severity === 'CRITICAL',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      bedId: alarm.bedId,
      severity,
      paramName: alarm.paramName,
      threshold: alarm.threshold,
      value: alarm.currentValue,
      thresholdValue: alarm.thresholdValue,
      timestamp: alarm.timestamp,
    },
  };
}

function getUnit(paramName) {
  const units = {
    SpO2: '%',
    HeartRate: ' bpm',
    Pulse: ' bpm',
    Temp1: '°C',
    'Resp.Rate': ' bpm',
    PEEP: ' cmH2O',
    MV: ' L/min',
    Peak: ' cmH2O',
    VT: ' ml',
  };
  return units[paramName] || '';
}

async function sendPush(subscriptionDoc, alarm) {
  if (!configured) {
    throw new Error('Web push not configured');
  }

  const payload = buildNotificationPayload(alarm);
  return sendRawPush(subscriptionDoc, payload);
}

async function sendRawPush(subscriptionDoc, payload) {
  if (!configured) {
    throw new Error('Web push not configured');
  }

  if (!subscriptionDoc?.subscription?.endpoint) {
    throw new Error('Invalid push subscription — re-enable notifications on your phone');
  }

  const pushPayload = JSON.stringify(payload);
  const options = {
    TTL: 60,
    urgency: 'high',
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await webpush.sendNotification(subscriptionDoc.subscription, pushPayload, options);
      const endpoint = subscriptionDoc.subscription?.endpoint || '';
      console.log(`Web push accepted by ${endpoint.includes('apple.com') ? 'Apple' : 'push service'} (status ${response?.statusCode || 201})`);
      return payload;
    } catch (err) {
      lastError = err;
      const dnsFailure = /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(err.message || '');
      const retryable = dnsFailure || !err.statusCode || err.statusCode >= 500;
      if (!retryable || attempt === 2) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, dnsFailure ? 800 * (attempt + 1) : 400 * (attempt + 1)));
    }
  }

  const message = formatPushError(lastError);
  const enriched = new Error(message);
  enriched.statusCode = lastError?.statusCode;
  enriched.body = lastError?.body;
  throw enriched;
}

function formatPushError(err) {
  if (!err) return 'Web push delivery failed';
  if (err.body) {
    try {
      const parsed = JSON.parse(err.body);
      if (parsed.reason) return parsed.reason;
    } catch {
      return err.body;
    }
  }
  if (err.message) return err.message;
  if (err.statusCode === 410) return 'Push subscription expired — disable and re-enable notifications';
  if (err.statusCode === 404) return 'Push endpoint not found — disable and re-enable notifications';
  if (err.statusCode === 403) return 'Push rejected — disable and re-enable notifications';
  if (err.statusCode) return `Push failed with status ${err.statusCode}`;
  if (/ENOTFOUND|getaddrinfo/i.test(err.message || '')) {
    return 'Cannot reach Apple push servers (DNS) — notification-service needs internet/DNS fix';
  }
  return 'Web push delivery failed — check network and try again';
}

module.exports = {
  configure,
  sendPush,
  sendRawPush,
  buildNotificationPayload,
};
