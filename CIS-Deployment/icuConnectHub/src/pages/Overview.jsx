import { Link, useNavigate } from 'react-router-dom';
import PulseWave from '../components/PulseWave';
import PulseKpiStrip from '../components/PulseKpiStrip';
import { useLiveWard } from '../hooks/useLiveWard';
import { bedDetailPath } from '../constants/bedDetailTabs';

export default function Overview() {
  const navigate = useNavigate();
  const { occupied, alerts, stats, loading, error, ackAlert, statusLabel, refresh } = useLiveWard();
  const monitors = occupied.slice(0, 8);
  const feed = alerts.slice(0, 8);

  if (loading && occupied.length === 0 && alerts.length === 0) {
    return <p className="pulse-muted">Loading live ward…</p>;
  }

  return (
    <>
      {error && (
        <div className="pulse-panel" style={{ marginBottom: '1rem', borderColor: '#fecaca' }}>
          <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p>
          <p className="pulse-muted" style={{ margin: '0.4rem 0 0' }}>
            Start the app stack, then admit a patient under Admissions.
            {' '}<button type="button" className="pulse-ack" onClick={refresh}>Retry</button>
          </p>
        </div>
      )}

      <PulseKpiStrip stats={stats} />

      {monitors.length === 0 ? (
        <div className="pulse-panel">
          <h2 style={{ marginTop: 0 }}>No occupied beds yet</h2>
          <p className="pulse-muted">
            Admit a patient to see live bedside monitors. Device vitals flow through Connect Engine → RabbitMQ → Alarm Engine.
          </p>
          <Link to="/admissions" className="pulse-btn-dark" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
            + Admit patient
          </Link>
        </div>
      ) : (
        <div className="pulse-overview-grid">
          <div className="pulse-monitor-grid">
            {monitors.map((bed) => (
              <Link key={bed.id} to={`/bed/${bed.alarmBedId}`} className="pulse-monitor">
                <div className="pulse-monitor-head">
                  <span className="pulse-monitor-bed">
                    <span className={`pulse-dot is-${bed.status}`} />
                    {bed.id}
                  </span>
                  <span className={`pulse-status-text is-${bed.status}`}>
                    {statusLabel(bed.status)}
                  </span>
                </div>
                <h3 className="pulse-monitor-name">{bed.patient}</h3>
                <p className="pulse-monitor-dx">{bed.diagnosis}</p>
                <PulseWave status={bed.status} live={bed.hasVitals} />
                <div className="pulse-vitals-row">
                  <div className="pulse-vital">
                    <span>HR</span>
                    <strong className={bed.status === 'critical' ? 'is-bad' : ''}>{bed.hr ?? '—'}</strong>
                  </div>
                  <div className="pulse-vital">
                    <span>SpO2</span>
                    <strong className={bed.status === 'critical' ? 'is-bad' : ''}>
                      {bed.spo2 != null ? `${bed.spo2}%` : '—'}
                    </strong>
                  </div>
                  <div className="pulse-vital">
                    <span>BP</span>
                    <strong className={bed.status === 'critical' ? 'is-bad' : ''}>{bed.bp}</strong>
                  </div>
                  <div className="pulse-vital">
                    <span>RR</span>
                    <strong className={bed.status === 'critical' ? 'is-bad' : ''}>{bed.rr ?? '—'}</strong>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <aside className="pulse-feed">
            <h2 className="pulse-feed-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 18.5c.5 1.3 1.6 2 3 2s2.5-.7 3-2" strokeLinecap="round" />
                <path d="M6 9.5a6 6 0 1 1 12 0c0 4 1.4 5.3 1.4 5.3H4.6S6 13.5 6 9.5Z" />
              </svg>
              Alert Feed
            </h2>
            {feed.length === 0 ? (
              <p className="pulse-muted">No active alerts.</p>
            ) : (
              feed.map((a) => (
                <div
                  key={a.id}
                  className={`pulse-feed-item is-clickable is-${a.severity}`}
                  role="link"
                  tabIndex={0}
                  title={`Open ${a.patient} waveforms`}
                  onClick={() => navigate(bedDetailPath(a, 'waveforms'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(bedDetailPath(a, 'waveforms'));
                    }
                  }}
                >
                  <span className={`pulse-dot is-${a.severity}`} style={{ marginTop: 6 }} />
                  <div>
                    <h4>{a.title}</h4>
                    <p>{a.patient} · {a.bed}<span className="pulse-feed-open-hint"> · Waveforms</span></p>
                  </div>
                  <button
                    type="button"
                    className="pulse-ack"
                    onClick={(e) => {
                      e.stopPropagation();
                      ackAlert(a);
                    }}
                  >
                    ACK
                  </button>
                </div>
              ))
            )}
            <p style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
              <Link to="/alerts" style={{ color: '#6b7280' }}>View all alerts →</Link>
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
