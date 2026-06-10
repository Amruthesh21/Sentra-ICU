/* Original ICU Alerts service worker — proven watch bridge path */
self.addEventListener('push', (event) => {
  let payload = {
    title: '⚠ ICU Alarm',
    body: 'Patient vital sign alert',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {},
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    vibrate: payload.vibrate || [200, 100, 200, 100, 200],
    data: payload.data || {},
    tag: payload.data?.bedId
      ? `alarm-${payload.data.bedId}-${payload.data.paramName || 'alert'}`
      : 'icu-alarm',
    renotify: true,
    requireInteraction: payload.data?.severity === 'CRITICAL' || payload.requireInteraction !== false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || '⚠ ICU Alarm', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
