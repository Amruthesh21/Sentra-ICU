import { useCallback, useEffect, useState } from 'react';
import {
  VITAL_PARAMS,
  getAlarmConfig,
  saveAlarmConfig,
  getDoctorId,
  mergeThresholds,
  emptyThresholds,
  canonicalAlarmBedId,
  findBedAlarmConfig,
  validateThresholds,
} from '../api/alarmConfig';
import { unlockAlarmAudio } from '../utils/alarmSound';

function toInputValue(v) {
  if (v === '' || v == null) return '';
  return String(v);
}

/**
 * Alarm thresholds — server is the only source of truth.
 * Load from GET /api/alarm-config/{doctor}; Save via POST; never invent cache races.
 */
export default function AlarmThresholdPanel({ bedId, patientName, patientMRN }) {
  const [alarms, setAlarms] = useState(() => emptyThresholds());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [dirty, setDirty] = useState(false);
  const canonicalBedId = canonicalAlarmBedId(bedId);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const configs = await getAlarmConfig(getDoctorId());
      const bedConfig = findBedAlarmConfig(configs, canonicalBedId);
      if (bedConfig?.alarms?.length) {
        setAlarms(mergeThresholds(bedConfig.alarms));
      } else {
        setAlarms(emptyThresholds());
      }
      setDirty(false);
    } catch (err) {
      setAlarms(emptyThresholds());
      setMessage({ type: 'error', text: err.message || 'Could not load thresholds from server' });
    } finally {
      setLoading(false);
    }
  }, [canonicalBedId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  function updateAlarm(index, field, value) {
    setDirty(true);
    setMessage(null);
    setAlarms((prev) => prev.map((a, i) => {
      if (i !== index) return a;
      const next = { ...a, [field]: value };
      if ((field === 'highThreshold' || field === 'lowThreshold') && value != null && value !== '') {
        next.enabled = true;
      }
      return next;
    }));
  }

  function toggleEnabled(index) {
    setDirty(true);
    setMessage(null);
    setAlarms((prev) => prev.map((a, i) => (i === index ? { ...a, enabled: !a.enabled } : a)));
  }

  async function handleSave() {
    const validationError = validateThresholds(alarms);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    const armed = alarms.filter((a) => a.enabled).length;
    if (armed === 0) {
      setMessage({
        type: 'error',
        text: 'Turn ON at least one parameter before saving.',
      });
      return;
    }

    unlockAlarmAudio();
    setSaving(true);
    setMessage(null);

    const payload = {
      doctorId: getDoctorId(),
      bedId: canonicalBedId,
      patientMRN: patientMRN || '--',
      patientName: patientName || 'Patient',
      alarms: alarms.map((a) => ({
        paramName: a.paramName,
        highThreshold: a.highThreshold === '' || a.highThreshold == null ? null : Number(a.highThreshold),
        lowThreshold: a.lowThreshold === '' || a.lowThreshold == null ? null : Number(a.lowThreshold),
        enabled: a.enabled === true,
      })),
    };

    try {
      const saved = await saveAlarmConfig(payload);
      if (!saved?.alarms?.length) {
        throw new Error('Server did not return saved thresholds.');
      }

      // Re-fetch so UI matches what is actually stored (no local mirrors).
      const configs = await getAlarmConfig(payload.doctorId);
      const verified = findBedAlarmConfig(configs, canonicalBedId);
      if (!verified?.alarms?.length) {
        throw new Error('Saved but could not re-load config from server.');
      }
      setAlarms(mergeThresholds(verified.alarms));
      setDirty(false);
      setMessage({
        type: 'success',
        text: `Saved on server for ${verified.bedId} (${armed} armed).`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="pulse-muted" style={{ fontSize: '0.875rem' }}>Loading alarm config…</p>;
  }

  return (
    <div className="alarm-panel bed-alarm-thresholds">
      <h3>Alarm thresholds</h3>
      <p className="param-hint">
        Set High / Low, turn <strong>On</strong>, then Save. Values load from the alarm engine only
        {dirty ? ' · unsaved changes' : ''}.
      </p>

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
            <div key={alarm.paramName} className={`threshold-row${alarm.enabled ? ' is-armed' : ''}`}>
              <span className="threshold-param">{param?.label || alarm.paramName}</span>
              <input
                type="number"
                step="any"
                placeholder="—"
                value={toInputValue(alarm.highThreshold)}
                onChange={(e) => updateAlarm(index, 'highThreshold', e.target.value === '' ? null : e.target.value)}
              />
              <input
                type="number"
                step="any"
                placeholder="—"
                value={toInputValue(alarm.lowThreshold)}
                onChange={(e) => updateAlarm(index, 'lowThreshold', e.target.value === '' ? null : e.target.value)}
              />
              <button
                type="button"
                className={`threshold-on-btn${alarm.enabled ? ' is-on' : ''}`}
                aria-pressed={alarm.enabled}
                onClick={() => toggleEnabled(index)}
              >
                {alarm.enabled ? 'On' : 'Off'}
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn-primary pulse-btn-dark" onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? 'Saving…' : 'Save Thresholds'}
      </button>
    </div>
  );
}
