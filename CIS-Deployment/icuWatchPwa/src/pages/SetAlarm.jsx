import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  VITAL_PARAMS,
  getAlarmConfig,
  saveAlarmConfig,
  defaultThresholds,
  demoThresholds,
  mergeThresholds,
  canonicalAlarmBedId,
  findBedAlarmConfig,
  validateThresholds,
} from '../api/alarmConfig';
import { fetchPatientByBed } from '../api/patients';

export default function SetAlarm() {
  const { bedId } = useParams();
  const doctorId = localStorage.getItem('doctorId') || 'doctor-001';
  const canonicalBedId = canonicalAlarmBedId(bedId);
  const [alarms, setAlarms] = useState(defaultThresholds());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [patient, setPatient] = useState({ patientName: 'Patient', patientMRN: '--' });
  const dirtyRef = useRef(false);

  const loadConfig = useCallback(async ({ force = false } = {}) => {
    if (!force && dirtyRef.current) {
      return;
    }
    try {
      const [configs, patientInfo] = await Promise.all([
        getAlarmConfig(doctorId),
        fetchPatientByBed(canonicalBedId),
      ]);
      if (!force && dirtyRef.current) {
        return;
      }
      setPatient({
        patientName: patientInfo.patientName || 'Patient',
        patientMRN: patientInfo.patientMRN || '--',
      });
      const bedConfig = findBedAlarmConfig(configs, canonicalBedId);
      setAlarms(bedConfig?.alarms?.length ? mergeThresholds(bedConfig.alarms) : demoThresholds());
    } catch {
      if (!dirtyRef.current) {
        setAlarms(demoThresholds());
      }
    } finally {
      setLoading(false);
    }
  }, [doctorId, canonicalBedId]);

  useEffect(() => {
    dirtyRef.current = false;
    setLoading(true);
    loadConfig({ force: true });
  }, [loadConfig]);

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
        doctorId,
        bedId: canonicalBedId,
        patientMRN: patient.patientMRN,
        patientName: patient.patientName,
        alarms: alarms.map((a) => ({
          paramName: a.paramName,
          highThreshold: a.highThreshold === '' || a.highThreshold == null ? null : Number(a.highThreshold),
          lowThreshold: a.lowThreshold === '' || a.lowThreshold == null ? null : Number(a.lowThreshold),
          enabled: !!a.enabled,
        })),
      });
      dirtyRef.current = false;
      setMessage({
        type: 'success',
        text: 'Thresholds saved and alarms re-armed. You will be alerted if limits are crossed again.',
      });
      await loadConfig({ force: true });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: '#888' }}>Loading...</p>;

  return (
    <div>
      <h1 className="page-title">Set Alarms</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: '0.9rem' }}>
        {canonicalBedId} · {patient.patientName} (MRN {patient.patientMRN})
      </p>

      {message && (
        <div className={`status-message ${message.type}`}>{message.text}</div>
      )}

      <div className="card">
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

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Thresholds'}
      </button>
    </div>
  );
}
