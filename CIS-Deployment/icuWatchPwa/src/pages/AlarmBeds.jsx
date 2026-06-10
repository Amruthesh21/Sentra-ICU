import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCenter } from '../api/center';

export default function AlarmBeds() {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCenter()
      .then((center) => setBeds(Array.isArray(center.beds) ? center.beds : []))
      .catch(() => setBeds([]))
      .finally(() => setLoading(false));
  }, []);

  const occupied = beds.filter((b) => b.occupied);

  if (loading) {
    return <p style={{ color: '#888' }}>Loading beds...</p>;
  }

  return (
    <div>
      <h1 className="page-title">Alarm Settings</h1>
      <p className="page-subtitle">Choose a bed to configure thresholds</p>

      {occupied.length === 0 ? (
        <div className="status-message info">No admitted patients yet.</div>
      ) : (
        occupied.map((bed) => {
          const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
          return (
            <Link key={bedId} to={`/alarms/${encodeURIComponent(bedId)}`} className="card bed-picker-card">
              <div className="card-header">
                <div>
                  <div className="patient-name">{bed.patient?.name || 'Patient'}</div>
                  <div className="patient-meta">{bed.bedLabel}</div>
                </div>
                <span className="bed-badge">{bed.bedLabel}</span>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
