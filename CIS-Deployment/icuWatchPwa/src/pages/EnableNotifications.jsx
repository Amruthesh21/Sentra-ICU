import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToPush,
  sendTestPush,
  getConfig,
  getSubscriptionStatus,
  verifySubscription,
  unsubscribeFromPush,
  isPushSubscribed,
  setPushSubscribed,
  getNotificationPermission,
  refreshBedSubscriptions,
} from '../api/pushSubscribe';
import { unlockAlarmAudio } from '../utils/alarmSound';

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function pushSupported() {
  return isStandalonePwa() && 'serviceWorker' in navigator && 'PushManager' in window;
}

export default function EnableNotifications() {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [publicUrl, setPublicUrl] = useState('');
  const [subscribed, setSubscribed] = useState(isPushSubscribed());
  const [serverSubscribed, setServerSubscribed] = useState(false);
  const [phoneSynced, setPhoneSynced] = useState(true);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [standalone, setStandalone] = useState(isStandalonePwa());

  const doctorId = localStorage.getItem('doctorId') || 'doctor-001';

  const refreshStatus = useCallback(async () => {
    setPermission(getNotificationPermission());
    setStandalone(isStandalonePwa());

    try {
      const [config, status] = await Promise.all([
        getConfig(),
        getSubscriptionStatus(doctorId),
      ]);
      setPublicUrl(config.publicUrl);
      setServerSubscribed(Boolean(status.subscribed));

      let synced = true;
      if (status.subscribed && pushSupported()) {
        const verify = await verifySubscription(doctorId);
        synced = Boolean(verify.matches);
        setPhoneSynced(synced);
      } else {
        setPhoneSynced(true);
      }

      const active = Boolean(status.subscribed) && synced && getNotificationPermission() === 'granted';
      setSubscribed(active);
      setPushSubscribed(active);
      if (active) {
        await refreshBedSubscriptions(doctorId);
      }
    } catch {
      setSubscribed(isPushSubscribed());
    }
  }, [doctorId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSubscribe = async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (!standalone) {
        throw new Error('Install the app to Home Screen first, then open it from the home screen icon.');
      }
      if (!pushSupported()) {
        throw new Error('Push requires iOS 16.4+ and opening the installed app (not Safari tab).');
      }

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        throw new Error('Notification permission denied');
      }
      setPermission('granted');
      await unlockAlarmAudio();

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const result = await subscribeToPush(doctorId, { renewEndpoint: !existing });
      setPublicUrl(result.publicUrl);
      setSubscribed(true);
      setServerSubscribed(true);
      setPhoneSynced(true);
      setPushSubscribed(true);
      setMessage({
        type: 'success',
        text: 'Registered. Lock iPhone, then run test push — watch should buzz within 3 seconds.',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setPermission(getNotificationPermission());
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!existing) {
        throw new Error('No iPhone push on this device. Tap Enable Notifications.');
      }
      await subscribeToPush(doctorId, { renewEndpoint: false });
      setServerSubscribed(true);
      setPhoneSynced(true);
      setSubscribed(true);
      setPushSubscribed(true);
      setMessage({ type: 'success', text: 'Phone and server synced. Lock iPhone, then test.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await unsubscribeFromPush(doctorId);
      await subscribeToPush(doctorId, { renewEndpoint: true });
      setSubscribed(true);
      setServerSubscribed(true);
      setPhoneSynced(true);
      setPushSubscribed(true);
      setMessage({
        type: 'success',
        text: 'Push reset complete. Lock iPhone, then test with PowerShell or the button below.',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      if (!serverSubscribed) {
        throw new Error('No server subscription. Tap Enable Notifications first.');
      }
      if (!phoneSynced) {
        throw new Error('iPhone push is out of sync with server. Tap Reset push, then test again.');
      }

      const result = await sendTestPush(doctorId);
      if (result.error) throw new Error(result.error);
      if (!result.sent && !result.queued) {
        throw new Error('Push failed — tap Reset push and try again');
      }

      setMessage({
        type: 'success',
        text: result.message || 'Alarm queued. Lock iPhone now — watch should buzz within 3 seconds.',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await unsubscribeFromPush(doctorId);
      setSubscribed(false);
      setServerSubscribed(false);
      setPhoneSynced(true);
      setMessage({ type: 'info', text: 'Push notifications disabled.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const canTest = serverSubscribed && phoneSynced && permission === 'granted';

  return (
    <div>
      <h1 className="page-title">Watch Notifications</h1>

      <div className="notification-status">
        <span className={`status-dot ${canTest ? 'active' : 'inactive'}`} />
        <div>
          <div style={{ fontWeight: 600 }}>
            {canTest ? 'Ready for watch alerts' : 'Setup required'}
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem', marginTop: 2 }}>
            Mode: {standalone ? 'Installed App' : 'Browser Tab'} | Permission: {permission}
            {serverSubscribed ? ' | Server: yes' : ' | Server: no'}
            {serverSubscribed && (phoneSynced ? ' | iPhone: synced' : ' | iPhone: OUT OF SYNC')}
          </div>
        </div>
      </div>

      {message && (
        <div className={`status-message ${message.type}`}>{message.text}</div>
      )}

      {standalone && serverSubscribed && !phoneSynced && (
        <div className="status-message error" style={{ lineHeight: 1.6 }}>
          iPhone push does not match the server (broken by earlier re-register).
          Tap <strong>Reset push</strong> below — do not use Sync.
        </div>
      )}

      {!standalone && isIOS() && (
        <div className="status-message info" style={{ lineHeight: 1.6 }}>
          <strong>Install on iPhone (required):</strong>
          <ol style={{ paddingLeft: 18, marginTop: 8, marginBottom: 0 }}>
            <li>Safari → ngrok HTTPS URL → Share → <strong>Add to Home Screen</strong></li>
            <li>Open <strong>ICU Alerts</strong> from home screen (not Safari)</li>
            <li>Notifications tab → <strong>Enable Notifications</strong></li>
          </ol>
        </div>
      )}

      {standalone && (
        <div className="status-message info" style={{ lineHeight: 1.6, marginTop: 12 }}>
          <strong>Demo steps (original working flow):</strong>
          <ol style={{ paddingLeft: 18, marginTop: 8, marginBottom: 0 }}>
            <li>iPhone Settings → Notifications → <strong>ICU Alerts</strong> → Allow + Sounds ON</li>
            <li>Watch app → Notifications → <strong>Mirror my iPhone</strong> ON</li>
            <li><strong>Lock iPhone</strong> (side button)</li>
            <li>
              PC command:{' '}
              <code style={{ fontSize: '0.68rem', wordBreak: 'break-all', display: 'block', marginTop: 4 }}>
                {'Invoke-RestMethod -Uri "http://localhost:7030/api/test-push" -Method POST -ContentType "application/json" -Body \'{"doctorId":"doctor-001"}\''}
              </code>
            </li>
          </ol>
          {publicUrl && (
            <p style={{ color: '#7eb8f7', fontFamily: 'monospace', fontSize: 11, marginTop: 8, wordBreak: 'break-all' }}>
              {publicUrl}
            </p>
          )}
        </div>
      )}

      {standalone && !canTest && !serverSubscribed && (
        <button className="btn btn-primary" onClick={handleSubscribe} disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Enabling...' : 'Enable Notifications'}
        </button>
      )}

      {(serverSubscribed || canTest) && (
        <div style={{ background: '#0a1628', borderRadius: 12, padding: 16, marginTop: 16, border: '1px solid #1a3a5c' }}>
          {canTest && (
            <p style={{ color: '#4CAF50', fontWeight: 600, margin: '0 0 12px' }}>Ready — lock iPhone then test</p>
          )}
          <button
            onClick={handleTest}
            disabled={testing || !canTest}
            style={{
              background: canTest ? '#c62828' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              cursor: canTest ? 'pointer' : 'not-allowed',
              fontSize: 14,
              marginRight: 8,
              fontWeight: 600,
            }}
          >
            {testing ? 'Sending...' : 'Send test alarm to watch'}
          </button>
          <button
            onClick={handleSync}
            disabled={loading || testing}
            style={{
              background: '#1a3a5c',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 14,
              marginRight: 8,
            }}
          >
            Sync to server
          </button>
          <button
            onClick={handleReset}
            disabled={loading || testing}
            style={{
              background: '#5c3d1a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 14,
              marginRight: 8,
            }}
          >
            Reset push
          </button>
          <button
            onClick={handleDisable}
            disabled={loading || testing}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid #333',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Disable
          </button>
        </div>
      )}
    </div>
  );
}
