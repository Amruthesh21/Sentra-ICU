import { useEffect, useRef, useState } from 'react';
import {
  acknowledgeAlarm,
  alarmConditionKey,
  getActiveAlarms,
} from '../api/alarms';
import { startAlarmSound, stopAlarmSound, vibrateAlarm } from '../utils/alarmSound';

const POLL_MS = 2000;

export default function InAppAlarmMonitor() {
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [dismissing, setDismissing] = useState(false);
  const alertedRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const alarms = await getActiveAlarms();
        if (cancelled) return;

        const critical = alarms.find((a) => a.severity === 'CRITICAL') || alarms[0];
        if (!critical) {
          setActiveAlarm(null);
          stopAlarmSound();
          return;
        }

        const key = alarmConditionKey(critical);
        if (!alertedRef.current.has(key)) {
          alertedRef.current.add(key);
          if (alertedRef.current.size > 50) {
            alertedRef.current = new Set([key]);
          }
          startAlarmSound();
          vibrateAlarm();
        }
        setActiveAlarm(critical);
      } catch {
        // ignore polling errors
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      stopAlarmSound();
    };
  }, []);

  async function dismiss() {
    if (!activeAlarm || dismissing) return;

    setDismissing(true);
    stopAlarmSound();

    const key = alarmConditionKey(activeAlarm);
    alertedRef.current.delete(key);
    setActiveAlarm(null);

    try {
      await acknowledgeAlarm({
        bedId: activeAlarm.bedId,
        paramName: activeAlarm.paramName,
        threshold: activeAlarm.threshold,
        currentValue: activeAlarm.currentValue,
      });
    } catch {
      // Keep dismissed locally even if network fails
    } finally {
      setDismissing(false);
    }
  }

  if (!activeAlarm) return null;

  const bedShort = (activeAlarm.bedId || '').replace('ICU-1-', '');

  return (
    <div className="alarm-overlay" role="alert">
      <div className="alarm-overlay-card">
        <div className="alarm-overlay-title">ICU ALARM</div>
        <div className="alarm-overlay-bed">
          {activeAlarm.patientName ? `${activeAlarm.patientName} · ` : ''}
          Bed {bedShort || activeAlarm.bedId}
        </div>
        <div className="alarm-overlay-detail">
          {activeAlarm.paramName}: {activeAlarm.currentValue}
          {activeAlarm.threshold === 'LOW' ? ' (below threshold)' : ' (above threshold)'}
        </div>
        <p style={{ color: '#ffb4b4', fontSize: 13, margin: '12px 0 0', lineHeight: 1.5 }}>
          Lock your iPhone now — the watch bridge sends ICU ALARM to your Apple Watch with sound.
        </p>
        <button
          type="button"
          className="btn btn-primary alarm-overlay-btn"
          onClick={dismiss}
          disabled={dismissing}
        >
          {dismissing ? 'Acknowledging...' : 'Acknowledge'}
        </button>
      </div>
    </div>
  );
}
