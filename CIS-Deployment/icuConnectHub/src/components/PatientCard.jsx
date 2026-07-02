import { Link } from 'react-router-dom';
import { formatVitalValue } from '../api/hub';

const VITAL_DISPLAY = [
  { key: 'SpO2', label: 'SpO2', unit: '%', criticalLow: 90 },
  { key: 'HeartRate', label: 'HR', unit: 'bpm', aliases: ['Pulse', 'Heart Rate'] },
  { key: 'Temp1', label: 'Temp', unit: '°C', warningHigh: 38, warningLow: 30, aliases: ['Temp', 'Temperature'] },
  { key: 'Resp.Rate', label: 'RR', unit: 'bpm', aliases: ['RR', 'Resp Rate'] },
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
  if (spec.warningLow != null && v < spec.warningLow) return 'warning';
  return '';
}

function admitPatientUrl(bedLabel, unitId) {
  const params = new URLSearchParams();
  if (unitId) params.set('unitId', unitId);
  if (bedLabel) params.set('bedLabel', bedLabel);
  const q = params.toString();
  return q ? `/patients?${q}` : '/patients';
}

export default function PatientCard({ bed, vitals = {}, alarmCount = 0, cardClass, unitId }) {
  const bedRoute = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
  const patient = bed.patient;
  const occupied = bed.occupied && patient?.name;
  const bedTitle = /^BED[\s-]/i.test(bed.bedLabel || '') ? bed.bedLabel : `Bed ${bed.bedLabel}`;
  const cardTo = occupied
    ? `/bed/${encodeURIComponent(bedRoute)}`
    : admitPatientUrl(bed.bedLabel, unitId);

  return (
    <Link to={cardTo} className={`patient-card ${cardClass || ''}${alarmCount > 0 ? ' has-alarm' : ''}`}>
      <div className="card-header">
        <div>
          <div className="bed-label">{bedTitle}</div>
          <div className="patient-name">{occupied ? patient.name : 'No Patient'}</div>
        </div>
        {alarmCount > 0 ? (
          <div className="alarm-badge alarm-badge--live" title={`${alarmCount} active alarm${alarmCount > 1 ? 's' : ''}`}>
            <span className="alarm-badge-icon" aria-hidden>!</span>
            <span>{alarmCount}</span>
          </div>
        ) : null}
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
        <div className="patient-card-admit-hint">Tap to admit patient</div>
      )}
    </Link>
  );
}
