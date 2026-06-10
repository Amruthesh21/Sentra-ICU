import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  VITAL_PARAMS,
  getAlarmConfig,
  saveAlarmConfig,
  defaultThresholds,
  demoThresholds,
} from '../api/alarmConfig';
import { fetchPatientByBed } from '../api/patients';

export default function SetAlarm() {
  const { bedId } = useParams();
  const doctorId = localStorage.getItem('doctorId') || 'doctor-001';
  const [alarms, setAlarms] = useState(defaultThresholds());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [patient, setPatient] = useState({ patientName: 'Patient', patientMRN: '--' });

  useEffect(() => {
    async function load() {
      try {
        const [configs, patientInfo] = await Promise.all([
          getAlarmConfig(doctorId),
          fetchPatientByBed(bedId),
        ]);
        setPatient({
          patientName: patientInfo.patientName || 'Patient',
          patientMRN: patientInfo.patientMRN || '--',
        });
        const bedConfig = configs.find((c) => c.bedId === bedId);
        if (bedConfig?.alarms?.length) {
          setAlarms(mergeThresholds(bedConfig.alarms));
        } else {
          setAlarms(demoThresholds());
        }
      } catch {
        setAlarms(demoThresholds());
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [doctorId, bedId]);

  function mergeThresholds(saved) {
    return VITAL_PARAMS.map((param) => {
      const existing = saved.find((a) => a.paramName === param.paramName);
      return existing || {
        paramName: param.paramName,
        highThreshold: null,
        lowThreshold: null,
        enabled: false,
      };
    });
  }

  function updateAlarm(index, field, value) {
    setAlarms((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await saveAlarmConfig({
        doctorId,
        bedId,
        patientMRN: patient.patientMRN,
        patientName: patient.patientName,
        alarms: alarms.map((a) => ({
          paramName: a.paramName,
          highThreshold: a.highThreshold === '' || a.highThreshold == null ? null : Number(a.highThreshold),
          lowThreshold: a.lowThreshold === '' || a.lowThreshold == null ? null : Number(a.lowThreshold),
          enabled: !!a.enabled,
        })),
      });
      setMessage({
        type: 'success',
        text: 'Thresholds saved and alarms re-armed. You will be alerted if limits are crossed again.',
      });
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
        {bedId} · {patient.patientName} (MRN {patient.patientMRN})
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
