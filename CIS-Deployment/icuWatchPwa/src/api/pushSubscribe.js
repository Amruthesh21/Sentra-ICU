import { apiFetch, readJsonResponse } from './apiFetch';
import { fetchCenter } from './center';

export async function getAllBedIds() {
  try {
    const center = await fetchCenter();
    const beds = Array.isArray(center.beds) ? center.beds : [];
    const ids = beds.map((b) => b.alarmBedId || `ICU-1-${b.bedLabel}`);
    return ids.length > 0 ? ids : ['ICU-1-BED-01'];
  } catch {
    return ['ICU-1-BED-01', 'ICU-1-BED-02'];
  }
}

export async function getConfig() {
  const res = await apiFetch('/api/notification/config');
  if (!res.ok) throw new Error('Could not fetch push config');
  return res.json();
}

export async function getSubscriptionStatus(doctorId) {
  const res = await apiFetch(`/api/notification/subscription-status/${doctorId}`);
  if (!res.ok) return { subscribed: false };
  return res.json();
}

export async function verifySubscription(doctorId) {
  if (!('serviceWorker' in navigator)) {
    return { matches: false, reason: 'no_service_worker' };
  }
  const registration = await navigator.serviceWorker.ready;
  const phoneSub = await registration.pushManager.getSubscription();
  if (!phoneSub) {
    return { matches: false, reason: 'no_phone_subscription' };
  }

  const res = await apiFetch('/api/notification/verify-subscription', {
    method: 'POST',
    body: JSON.stringify({ doctorId, subscription: phoneSub.toJSON() }),
  });
  if (!res.ok) return { matches: false, reason: 'verify_failed' };
  return res.json();
}

export async function refreshBedSubscriptions(doctorId) {
  const bedIds = await getAllBedIds();
  const res = await apiFetch('/api/notification/refresh-beds', {
    method: 'POST',
    body: JSON.stringify({ doctorId, bedIds }),
  });
  if (!res.ok) return { updated: false, bedIds };
  const data = await readJsonResponse(res);
  return { updated: true, bedIds: data.bedIds || bedIds };
}

export async function sendTestPush(doctorId) {
  const res = await apiFetch('/api/notification/test-push', {
    method: 'POST',
    body: JSON.stringify({ doctorId }),
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data.error || `Server error (${res.status})`);
  }

  return data;
}

function resolvePublicUrl(configPublicUrl) {
  const origin = window.location.origin;
  if (origin.startsWith('https://')) return origin;
  return configPublicUrl || origin;
}

export async function subscribeToPush(doctorId, { renewEndpoint = false } = {}) {
  const registration = await navigator.serviceWorker.ready;
  const { vapidPublicKey, publicUrl: configPublicUrl } = await getConfig();
  const bedIds = await getAllBedIds();
  const publicUrl = resolvePublicUrl(configPublicUrl);

  let subscription = await registration.pushManager.getSubscription();

  if (renewEndpoint && subscription) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const res = await apiFetch('/api/notification/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      doctorId,
      bedIds,
      publicUrl,
    }),
  });

  const data = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save subscription');
  }
  return { success: true, publicUrl, bedIds };
}

export async function unsubscribeFromPush(doctorId) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  await apiFetch(`/api/notification/subscribe/${doctorId}`, { method: 'DELETE' });
  localStorage.removeItem('pushSubscribed');
}

export function isPushSubscribed() {
  return localStorage.getItem('pushSubscribed') === 'true';
}

export function setPushSubscribed(value) {
  if (value) {
    localStorage.setItem('pushSubscribed', 'true');
  } else {
    localStorage.removeItem('pushSubscribed');
  }
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
