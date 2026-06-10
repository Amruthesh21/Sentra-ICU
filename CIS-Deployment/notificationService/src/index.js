require('dotenv').config();
const express = require('express');
const cors = require('cors');
const subscriptionModel = require('./models/PushSubscription');
const pushService = require('./pushService');
const rabbitmq = require('./rabbitmq');

const PORT = process.env.PORT || 9030;

const app = express();
app.use(cors());
app.use(express.json());

async function sendPushToDoctor(doctorId, payload) {
  const sub = await subscriptionModel.findByDoctorId(doctorId);
  if (!sub?.subscription?.endpoint) {
    throw new Error(`No push subscription found for doctor ${doctorId}`);
  }
  await pushService.sendRawPush(sub, payload);
  return { sent: true, webPush: true };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.get('/api/config', async (req, res) => {
  let publicUrl = process.env.PUBLIC_URL || 'http://localhost:7031';
  const ngrokUrls = [
    'http://host.docker.internal:4040/api/tunnels',
    'http://localhost:4040/api/tunnels',
  ];
  for (const ngrokUrl of ngrokUrls) {
    try {
      const response = await fetch(ngrokUrl);
      const data = await response.json();
      const tunnel = data.tunnels?.find((t) => t.proto === 'https');
      if (tunnel) {
        publicUrl = tunnel.public_url;
        break;
      }
    } catch (e) {
      // try next URL
    }
  }
  res.json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    publicUrl,
    watchBridge: true,
  });
});

const TEST_ALARM_PAYLOAD = {
  title: '⚠ ICU Alarm — BED-01',
  body: 'SpO2 dropped to 85% (threshold: low 90%)',
  badge: '/icon-192.png',
  silent: false,
  requireInteraction: true,
  data: {
    bedId: 'ICU-1-BED-01',
    severity: 'CRITICAL',
    paramName: 'SpO2',
    value: 85,
    threshold: 90,
  },
  vibrate: [200, 100, 200, 100, 200],
};

app.get('/api/subscription-status/:doctorId', async (req, res) => {
  try {
    const sub = await subscriptionModel.findByDoctorId(req.params.doctorId);
    const endpoint = sub?.subscription?.endpoint || '';
    res.json({
      doctorId: req.params.doctorId,
      subscribed: Boolean(endpoint),
      bedIds: sub?.bedIds || [],
      publicUrl: sub?.publicUrl || null,
      endpointPreview: endpoint ? `${endpoint.slice(0, 48)}...` : null,
      updatedAt: sub?.updatedAt || null,
    });
  } catch (err) {
    res.status(500).json({ subscribed: false, error: err.message });
  }
});

app.post('/api/verify-subscription', async (req, res) => {
  try {
    const { doctorId = 'doctor-001', subscription } = req.body;
    const stored = await subscriptionModel.findByDoctorId(doctorId);
    if (!stored?.subscription?.endpoint) {
      return res.json({ matches: false, reason: 'no_server_subscription' });
    }
    if (!subscription?.endpoint) {
      return res.json({ matches: false, reason: 'no_phone_subscription' });
    }
    const matches = stored.subscription.endpoint === subscription.endpoint;
    res.json({
      matches,
      reason: matches ? 'ok' : 'endpoint_mismatch',
      serverUpdatedAt: stored.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ matches: false, error: err.message });
  }
});

app.post('/api/test-push', async (req, res) => {
  const { doctorId = 'doctor-001', async = true } = req.body;
  const payload = TEST_ALARM_PAYLOAD;

  if (async !== false) {
    const sub = await subscriptionModel.findByDoctorId(doctorId);
    if (!sub?.subscription?.endpoint) {
      return res.status(400).json({
        sent: false,
        error: 'No push subscription found — tap Enable Notifications first',
      });
    }

    res.json({
      sent: true,
      queued: true,
      doctorId,
      message: 'Alarm queued — lock iPhone now. Apple Watch should buzz within 3 seconds.',
    });

    sendPushToDoctor(doctorId, payload)
      .then((result) => console.log(`Test push for ${doctorId}:`, result))
      .catch((err) => console.error(`Test push failed for ${doctorId}:`, err.message));
    return;
  }

  try {
    const result = await sendPushToDoctor(doctorId, payload);
    res.json({ ...result, doctorId });
  } catch (err) {
    console.error('Test push failed:', err.message);
    res.status(500).json({ sent: false, error: err.message || 'Push delivery failed' });
  }
});

app.post('/api/push-alarm', async (req, res) => {
  const { doctorId = 'doctor-001', alarm, async = true } = req.body;

  if (!alarm?.bedId || !alarm?.paramName) {
    return res.status(400).json({ sent: false, error: 'alarm with bedId and paramName is required' });
  }

  const payload = pushService.buildNotificationPayload(alarm);

  if (async !== false) {
    res.json({
      sent: true,
      queued: true,
      doctorId,
      message: 'Vital alarm queued — lock iPhone for Apple Watch alert',
    });

    sendPushToDoctor(doctorId, payload)
      .then((result) => console.log(`Alarm push for ${doctorId}:`, result))
      .catch((err) => console.error(`Alarm push failed for ${doctorId}:`, err.message));
    return;
  }

  try {
    const result = await sendPushToDoctor(doctorId, payload);
    res.json({ ...result, doctorId });
  } catch (err) {
    res.status(500).json({ sent: false, error: err.message || 'Push delivery failed' });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { doctorId, doctorName, bedIds, subscription, publicUrl } = req.body;
    if (!doctorId || !subscription) {
      return res.status(400).json({ error: 'doctorId and subscription are required' });
    }

    const resolvedBeds = Array.isArray(bedIds) && bedIds.length > 0
      ? bedIds
      : ['ICU-1-BED-01', 'ICU-1-BED-02', 'ICU-1-BED-03', 'ICU-1-BED-04', 'ICU-1-BED-05'];

    const saved = await subscriptionModel.saveSubscription({
      doctorId,
      doctorName,
      bedIds: resolvedBeds,
      subscription,
      publicUrl,
    });

    console.log(`Push subscription saved for ${doctorId} (${subscription.endpoint?.slice(0, 40)}...)`);
    res.status(201).json({ message: 'Subscribed', doctorId: saved.doctorId, bedIds: saved.bedIds, publicUrl: saved.publicUrl });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refresh-beds', async (req, res) => {
  try {
    const { doctorId, bedIds } = req.body;
    if (!doctorId || !Array.isArray(bedIds) || bedIds.length === 0) {
      return res.status(400).json({ error: 'doctorId and bedIds are required' });
    }
    const updated = await subscriptionModel.updateBedIds(doctorId, bedIds);
    if (!updated) {
      return res.status(404).json({ error: 'Subscription not found — enable notifications first' });
    }
    res.json({ doctorId, bedIds: updated.bedIds, status: 'updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subscribe/:doctorId', async (req, res) => {
  try {
    await subscriptionModel.removeSubscription(req.params.doctorId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscriptions', async (req, res) => {
  try {
    const subs = await subscriptionModel.listSubscriptions();
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  const rabbitUrl = process.env.RABBITMQ_URL;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:poc@rtwo.com';

  if (!mongoUri || !rabbitUrl || !vapidPublic || !vapidPrivate) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  pushService.configure(vapidPublic, vapidPrivate, vapidEmail);
  await subscriptionModel.connect(mongoUri);
  await rabbitmq.startConsumer(rabbitUrl);

  app.listen(PORT, () => {
    console.log(`Notification service running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await rabbitmq.close();
  process.exit(0);
});
