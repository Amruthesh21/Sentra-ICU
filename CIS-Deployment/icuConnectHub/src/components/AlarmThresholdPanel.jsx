import { useEffect, useState } from 'react';
import {
  VITAL_PARAMS,
  getAlarmConfig,
  saveAlarmConfig,
  getDoctorId,
  mergeThresholds,
  demoThresholds,
} from '../api/alarmConfig';

export default function AlarmThresholdPanel({ bedId, patientName, patientMRN }) {
  const [alarms, setAlarms] = useState(demoThresholds());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const configs = await getAlarmConfig();
        if (cancelled) return;
        const bedConfig = configs.find((c) => c.bedId === bedId);
        setAlarms(bedConfig?.alarms?.length ? mergeThresholds(bedConfig.alarms) : demoThresholds());
      } catch {
        if (!cancelled) setAlarms(demoThresholds());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bedId]);

  function updateAlarm(index, field, value) {
    setAlarms((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await saveAlarmConfig({
        doctorId: getDoctorId(),
        bedId,
        patientMRN: patientMRN || '--',
        patientName: patientName || 'Patient',
        alarms: alarms.map((a) => ({
          paramName: a.paramName,
          highThreshold: a.highThreshold === '' || a.highThreshold == null ? null : Number(a.highThreshold),
          lowThreshold: a.lowThreshold === '' || a.lowThreshold == null ? null : Number(a.lowThreshold),
          enabled: !!a.enabled,
        })),
      });
      setMessage({ type: 'success', text: 'Thresholds saved — synced with mobile PWA instantly.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading alarm config…</p>;

  return (
    <div className="alarm-panel">
      <h3>Alarm Thresholds</h3>
      <p className="param-hint">Same settings as mobile PWA — changes sync live to both apps.</p>

      {message && (
        <div className={`message ${message.type}`} style={{ marginBottom: 12 }}>
          {message.text}
        </div>
      )}

      <div className="threshold-grid">
        <div className="threshold-row header">
          <span>Parameter</span>
          <span>High</span>
          <span>Low</span>
          <span>On</span>
        </div>
        {alarms.map((alarm, index) => {
          const param = VITAL_PARAMS.find((p) => p.paramName === alarm.paramName);
          return (
            <div key={alarm.paramName} className="threshold-row">
              <span>{param?.label || alarm.paramName}</span>
              <input
                type="number"
                step="any"
                placeholder="—"
                value={alarm.highThreshold ?? ''}
                onChange={(e) => updateAlarm(index, 'highThreshold', e.target.value === '' ? null : e.target.value)}
              />
              <input
                type="number"
                step="any"
                placeholder="—"
                value={alarm.lowThreshold ?? ''}
                onChange={(e) => updateAlarm(index, 'lowThreshold', e.target.value === '' ? null : e.target.value)}
              />
              <input
                type="checkbox"
                checked={!!alarm.enabled}
                onChange={(e) => updateAlarm(index, 'enabled', e.target.checked)}
              />
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? 'Saving…' : 'Save Thresholds'}
      </button>
    </div>
  );
}
