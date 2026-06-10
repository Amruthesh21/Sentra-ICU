import { Link } from 'react-router-dom';
import { formatVitalValue } from '../api/hub';

const VITAL_DISPLAY = [
  { key: 'SpO2', label: 'SpO2', unit: '%', criticalLow: 90 },
  { key: 'HeartRate', label: 'HR', unit: 'bpm', aliases: ['Pulse', 'Heart Rate'] },
  { key: 'Temp1', label: 'Temp', unit: '°C', warningHigh: 38 },
  { key: 'Resp.Rate', label: 'RR', unit: 'bpm' },
];

function resolve(vitals, key, aliases = []) {
  if (vitals[key] != null) return vitals[key];
  for (const a of aliases) {
    if (vitals[a] != null) return vitals[a];
  }
  return null;
}

function statusFor(v, spec) {
  if (v == null) return '';
  if (spec.criticalLow != null && v < spec.criticalLow) return 'critical';
  if (spec.warningHigh != null && v > spec.warningHigh) return 'warning';
  return '';
}

export default function PatientCard({ bed, vitals, alarmCount, cardClass }) {
  const bedRoute = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
  const patient = bed.patient;
  const occupied = bed.occupied && patient?.name;

  return (
    <Link to={`/bed/${encodeURIComponent(bedRoute)}`} className={`patient-card ${cardClass || ''}`}>
      <div className="card-header">
        <div>
          <div className="bed-label">Bed {bed.bedLabel}</div>
          <div className="patient-name">{occupied ? patient.name : 'No Patient'}</div>
        </div>
        {alarmCount > 0 && <div className="alarm-badge">{alarmCount}</div>}
      </div>

      <div className="status-tags">
        {occupied ? (
          <>
            <span className="tag tag-vent">Monitor</span>
            <span className="tag tag-infusion">Infusion</span>
          </>
        ) : (
          <span className="tag tag-vacant">Vacant</span>
        )}
      </div>

      {occupied ? (
        <div className="vitals-row">
          {VITAL_DISPLAY.map((spec) => {
            const val = resolve(vitals, spec.key, spec.aliases);
            const st = statusFor(val, spec);
            return (
              <div key={spec.key} className={`vital-chip ${st}`}>
                <div className="label">{spec.label}</div>
                <div className="value">
                  {val != null ? formatVitalValue(spec.key, val) : '--'}
                  {val != null && <span className="unit"> {spec.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Tap to admit patient</div>
      )}
    </Link>
  );
}
