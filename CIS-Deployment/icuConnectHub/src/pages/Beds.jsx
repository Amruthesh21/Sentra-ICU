import { Link } from 'react-router-dom';
import { useLiveWard } from '../hooks/useLiveWard';

export default function Beds() {
  const { beds, loading, error, statusLabel } = useLiveWard();

  if (loading && beds.length === 0) {
    return <p className="pulse-muted">Loading beds…</p>;
  }

  if (error && beds.length === 0) {
    return (
      <div className="pulse-panel">
        <p style={{ color: '#b91c1c' }}>{error}</p>
        <p className="pulse-muted">Create units/beds in Hospital Admin, then admit patients.</p>
      </div>
    );
  }

  if (beds.length === 0) {
    return (
      <div className="pulse-panel">
        <p className="pulse-muted" style={{ margin: 0 }}>No beds configured yet.</p>
        <Link to="/admin/units" className="pulse-btn-dark" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
          Manage units
        </Link>
      </div>
    );
  }

  return (
    <div className="pulse-beds-grid">
      {beds.map((bed) => (
        <Link
          key={bed.id}
          to={bed.free ? `/admissions?bed=${encodeURIComponent(bed.id)}` : `/bed/${bed.alarmBedId}`}
          className="pulse-bed-card"
        >
          <div className="pulse-bed-top">
            <span className="pulse-bed-id">{bed.id}</span>
            {bed.free ? (
              <span className="pulse-bed-free">Free</span>
            ) : (
              <span className={`pulse-dot is-${bed.status}`} />
            )}
          </div>
          <h3 className={`pulse-bed-patient${bed.free ? ' is-empty' : ''}`}>
            {bed.free ? 'Available' : bed.patient}
          </h3>
          <div className={`pulse-status-text is-${bed.status}`} style={{ marginTop: '0.35rem' }}>
            {bed.free ? 'Available' : statusLabel(bed.status)}
          </div>
          <div className="pulse-bed-unit">{bed.unit}</div>
        </Link>
      ))}
    </div>
  );
}
