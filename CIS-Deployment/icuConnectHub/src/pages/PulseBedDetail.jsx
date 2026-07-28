import { Link } from 'react-router-dom';
import PulseWave from '../components/PulseWave';
import { ALERTS, statusLabel } from '../data/pulseWard';

export default function PulseBedDetail({ bed }) {
  const alerts = ALERTS.filter((a) => a.bed === bed.id);

  return (
    <div className="pulse-bed-detail">
      <div className="pulse-bed-detail-top">
        <Link to="/beds" className="pulse-back">← Beds</Link>
        <div className="pulse-monitor-head" style={{ margin: 0 }}>
          <span className="pulse-monitor-bed">
            <span className={`pulse-dot is-${bed.status}`} />
            {bed.id}
          </span>
          <span className={`pulse-status-text is-${bed.status}`}>{statusLabel(bed.status)}</span>
        </div>
      </div>

      <div className="pulse-bed-detail-grid">
        <section className="pulse-panel">
          <p className="pulse-kpi-label">Patient</p>
          <h2 className="pulse-monitor-name" style={{ fontSize: '1.6rem', marginTop: '0.35rem' }}>
            {bed.patient}
          </h2>
          <p className="pulse-monitor-dx">
            {bed.age} · {bed.sex} — {bed.diagnosis}
          </p>
          <p className="pulse-bed-unit" style={{ marginTop: '0.75rem' }}>{bed.unit}</p>

          <div style={{ marginTop: '1.25rem' }}>
            <PulseWave status={bed.status} height={64} />
          </div>

          <div className="pulse-vitals-row" style={{ marginTop: '1rem', gap: '0.75rem' }}>
            <div className="pulse-vital">
              <span>HR</span>
              <strong className={bed.status === 'critical' ? 'is-bad' : ''} style={{ fontSize: '1.35rem' }}>{bed.hr}</strong>
            </div>
            <div className="pulse-vital">
              <span>SpO2</span>
              <strong className={bed.status === 'critical' ? 'is-bad' : ''} style={{ fontSize: '1.35rem' }}>{bed.spo2}%</strong>
            </div>
            <div className="pulse-vital">
              <span>BP</span>
              <strong className={bed.status === 'critical' ? 'is-bad' : ''} style={{ fontSize: '1.35rem' }}>{bed.bp}</strong>
            </div>
            <div className="pulse-vital">
              <span>RR</span>
              <strong className={bed.status === 'critical' ? 'is-bad' : ''} style={{ fontSize: '1.35rem' }}>{bed.rr}</strong>
            </div>
          </div>
        </section>

        <aside className="pulse-feed">
          <h2 className="pulse-feed-title">Bed Alerts</h2>
          {alerts.length === 0 ? (
            <p className="pulse-muted">No alerts for this bed.</p>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="pulse-feed-item">
                <span className={`pulse-dot is-${a.severity}`} style={{ marginTop: 6 }} />
                <div>
                  <h4>{a.title}</h4>
                  <p>{a.patient} · {a.bed}</p>
                </div>
              </div>
            ))
          )}
          <p style={{ marginTop: '1.25rem', fontSize: '0.82rem', color: '#9aa3af' }}>
            Live device stream attaches when hospital connectors are approved.
            Use <Link to="/connectivity">Connectivity</Link> to test FHIR / HL7 ingest.
          </p>
        </aside>
      </div>
    </div>
  );
}
