import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VITAL_PARAMS,
  getAlarmConfig,
  saveAlarmConfig,
  getDoctorId,
  mergeThresholds,
  demoThresholds,
  canonicalAlarmBedId,
  findBedAlarmConfig,
  validateThresholds,
} from '../api/alarmConfig';

export default function AlarmThresholdPanel({ bedId, patientName, patientMRN }) {
  const [alarms, setAlarms] = useState(demoThresholds());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const dirtyRef = useRef(false);
  const canonicalBedId = canonicalAlarmBedId(bedId);

  const loadConfig = useCallback(async ({ force = false } = {}) => {
    if (!force && dirtyRef.current) {
      return;
    }
    try {
      const configs = await getAlarmConfig();
      if (!force && dirtyRef.current) {
        return;
      }
      const bedConfig = findBedAlarmConfig(configs, canonicalBedId);
      setAlarms(bedConfig?.alarms?.length ? mergeThresholds(bedConfig.alarms) : demoThresholds());
    } catch {
      if (!dirtyRef.current) {
        setAlarms(demoThresholds());
      }
    } finally {
      setLoading(false);
    }
  }, [canonicalBedId]);

  useEffect(() => {
    dirtyRef.current = false;
    setLoading(true);
    loadConfig({ force: true });
  }, [canonicalBedId, loadConfig]);

  function updateAlarm(index, field, value) {
    dirtyRef.current = true;
    setMessage(null);
    setAlarms((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  async function handleSave() {
    const validationError = validateThresholds(alarms);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await saveAlarmConfig({
        doctorId: getDoctorId(),
        bedId: canonicalBedId,
        patientMRN: patientMRN || '--',
        patientName: patientName || 'Patient',
        alarms: alarms.map((a) => ({
          paramName: a.paramName,
          highThreshold: a.highThreshold === '' || a.highThreshold == null ? null : Number(a.highThreshold),
          lowThreshold: a.lowThreshold === '' || a.lowThreshold == null ? null : Number(a.lowThreshold),
          enabled: !!a.enabled,
        })),
      });
      dirtyRef.current = false;
      setMessage({ type: 'success', text: 'Thresholds saved — alarms re-armed and synced with mobile PWA.' });
      await loadConfig({ force: true });
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
      <p className="param-hint">Same settings as mobile PWA — save to apply and re-arm alarms for this bed.</p>

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
