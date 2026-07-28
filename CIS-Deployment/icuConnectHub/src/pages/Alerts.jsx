import { useNavigate } from 'react-router-dom';
import { useLiveWard } from '../hooks/useLiveWard';
import { formatVitalValue } from '../api/hub';
import { bedDetailPath } from '../constants/bedDetailTabs';

export default function Alerts() {
  const navigate = useNavigate();
  const { alerts, loading, error, ackAlert } = useLiveWard();

  function openWaveforms(alert) {
    navigate(bedDetailPath(alert, 'waveforms'));
  }

  if (loading && alerts.length === 0) {
    return <p className="pulse-muted">Loading alerts…</p>;
  }

  return (
    <div className="pulse-panel" style={{ paddingTop: '0.85rem' }}>
      <h2 className="pulse-feed-title" style={{ marginBottom: '0.35rem' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 18.5c.5 1.3 1.6 2 3 2s2.5-.7 3-2" strokeLinecap="round" />
          <path d="M6 9.5a6 6 0 1 1 12 0c0 4 1.4 5.3 1.4 5.3H4.6S6 13.5 6 9.5Z" />
        </svg>
        Alert Feed
      </h2>
      <p className="pulse-muted" style={{ margin: '0 0 1rem', fontSize: '0.85rem' }}>
        Click an alert to open live waveforms for that patient. Use ACK to silence after review.
      </p>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      {alerts.length === 0 ? (
        <p className="pulse-muted" style={{ padding: '1.5rem 0' }}>No active physiological alerts.</p>
      ) : (
        alerts.map((a) => (
          <div
            key={a.id}
            className={`pulse-feed-item is-clickable is-${a.severity}`}
            role="link"
            tabIndex={0}
            title={`Open ${a.patient} waveforms`}
            onClick={() => openWaveforms(a)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openWaveforms(a);
              }
            }}
          >
            <span className={`pulse-dot is-${a.severity}`} style={{ marginTop: 6 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`bed-alarm-sev is-${a.severity}`}>
                  {(a.severityLabel || a.severity || '').toUpperCase()}
                </span>
                <h4 style={{ margin: 0 }}>{a.title}</h4>
              </div>
              <p style={{ margin: '0.25rem 0 0' }}>
                {a.patient} · {a.bed}
                {a.currentValue != null ? ` · ${a.paramName} ${formatVitalValue(a.paramName, a.currentValue)}` : ''}
                {a.thresholdValue != null ? ` (limit ${a.thresholdValue})` : ''}
                <span className="pulse-feed-open-hint"> · Open waveforms</span>
              </p>
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
    </div>
  );
}
