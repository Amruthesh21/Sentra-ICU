import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActiveAlarms, acknowledgeAlarm } from '../api/hub';
import { startAlarmSound, stopAlarmSound, unlockAlarmAudio } from '../utils/alarmSound';

const POLL_MS = 2000;
const MUTE_KEY = 'icuHub.alarmCenterMuted';

export default function HubAlarmMonitor() {
  const [topAlarm, setTopAlarm] = useState(null);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const [dismissing, setDismissing] = useState(false);
  const activeCountRef = useRef(0);

  useEffect(() => {
    const unlock = () => unlockAlarmAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    function onMute(e) {
      setMuted(e.detail?.muted ?? localStorage.getItem(MUTE_KEY) === '1');
    }
    window.addEventListener('icu-hub-alarm-mute', onMute);
    return () => window.removeEventListener('icu-hub-alarm-mute', onMute);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const alarms = await getActiveAlarms();
        if (cancelled) return;

        const list = Array.isArray(alarms) ? alarms : [];
        activeCountRef.current = list.length;

        if (!list.length) {
          setTopAlarm(null);
          stopAlarmSound();
          return;
        }

        const priority = list.find((a) => a.severity === 'CRITICAL') || list[0];
        setTopAlarm(priority);

        const isMuted = localStorage.getItem(MUTE_KEY) === '1';
        if (!isMuted) {
          startAlarmSound();
        } else {
          stopAlarmSound();
        }
      } catch {
        // ignore transient network errors
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      stopAlarmSound();
    };
  }, [muted]);

  useEffect(() => {
    if (muted) {
      stopAlarmSound();
    } else if (activeCountRef.current > 0) {
      startAlarmSound();
    }
  }, [muted]);

  async function dismiss() {
    if (!topAlarm || dismissing) return;
    setDismissing(true);
    stopAlarmSound();
    const dismissed = topAlarm;
    setTopAlarm(null);

    try {
      await acknowledgeAlarm({
        bedId: dismissed.bedId,
        paramName: dismissed.paramName,
        threshold: dismissed.threshold,
        currentValue: dismissed.currentValue,
      });
    } catch {
      // keep local dismiss
    } finally {
      setDismissing(false);
    }
  }

  if (!topAlarm) return null;

  const bedShort = (topAlarm.bedId || '').replace(/^ICU-1-/, '');
  const detail = topAlarm.threshold === 'LOW'
    ? `${topAlarm.paramName} below limit (${topAlarm.currentValue})`
    : `${topAlarm.paramName} above limit (${topAlarm.currentValue})`;

  return (
    <div className="hub-alarm-banner" role="alert">
      <div className="hub-alarm-banner-body">
        <span className="hub-alarm-banner-pulse" aria-hidden />
        <div>
          <strong>ICU Alarm — {topAlarm.patientName || 'Patient'} · Bed {bedShort}</strong>
          <p>{detail}</p>
        </div>
      </div>
      <div className="hub-alarm-banner-actions">
        <Link to={`/bed/${encodeURIComponent(topAlarm.bedId)}`} className="btn btn-outline btn-sm">
          Open bed
        </Link>
        <button type="button" className="btn btn-primary btn-sm" onClick={dismiss} disabled={dismissing}>
          {dismissing ? 'Ack…' : 'Acknowledge'}
        </button>
      </div>
    </div>
  );
}

export { MUTE_KEY as HUB_ALARM_MUTE_KEY };
