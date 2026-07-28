import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useLiveWard } from '../hooks/useLiveWard';

export default function Patients() {
  const navigate = useNavigate();
  const { search = '' } = useOutletContext() || {};
  const { occupied, loading, error, statusLabel } = useLiveWard();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return occupied.filter((b) => {
      if (!q) return true;
      return (
        b.patient?.toLowerCase().includes(q)
        || b.id.toLowerCase().includes(q)
        || b.diagnosis?.toLowerCase().includes(q)
        || b.mrn?.toLowerCase().includes(q)
      );
    });
  }, [occupied, search]);

  if (loading && occupied.length === 0) {
    return <p className="pulse-muted">Loading patients…</p>;
  }

  return (
    <>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {rows.length === 0 ? (
        <div className="pulse-panel">
          <p className="pulse-muted" style={{ margin: 0 }}>No admitted patients match this view.</p>
        </div>
      ) : (
        <table className="pulse-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Bed</th>
              <th>Diagnosis</th>
              <th>HR</th>
              <th>SpO2</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} onClick={() => navigate(`/bed/${b.alarmBedId}`)}>
                <td>
                  <div className="pulse-name">{b.patient}</div>
                  <div className="pulse-sub">
                    {[b.age != null ? b.age : null, b.sex].filter(Boolean).join(' · ') || (b.mrn || '—')}
                  </div>
                </td>
                <td>{b.id}</td>
                <td>{b.diagnosis}</td>
                <td><span className={`pulse-hr is-${b.status}`}>{b.hr ?? '—'}</span></td>
                <td>{b.spo2 != null ? `${b.spo2}%` : '—'}</td>
                <td>
                  <span className="pulse-status-cell">
                    <span className={`pulse-dot is-${b.status}`} />
                    <span className={`pulse-status-text is-${b.status}`}>{statusLabel(b.status)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
