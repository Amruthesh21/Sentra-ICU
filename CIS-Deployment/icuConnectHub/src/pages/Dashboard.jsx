import { useCallback, useEffect, useState } from 'react';
import PatientCard from '../components/PatientCard';
import { getCenter, getLatestVitals, getActiveAlarms, vitalsToMap } from '../api/hub';

export default function Dashboard() {
  const [beds, setBeds] = useState([]);
  const [vitalsMap, setVitalsMap] = useState({});
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [center, activeAlarms] = await Promise.all([
        getCenter(),
        getActiveAlarms().catch(() => []),
      ]);
      const bedList = center.beds || [];
      setBeds(bedList);
      setAlarms(activeAlarms);

      const vitalsResults = await Promise.all(
        bedList.map(async (bed) => {
          const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
          try {
            const data = await getLatestVitals(bedId);
            return [bed.bedLabel, vitalsToMap(data)];
          } catch {
            return [bed.bedLabel, {}];
          }
        })
      );
      setVitalsMap(Object.fromEntries(vitalsResults));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const occupied = beds.filter((b) => b.occupied).length;
  const criticalCount = beds.filter((b) => {
    const v = vitalsMap[b.bedLabel] || {};
    return (v.SpO2 != null && v.SpO2 < 90) || (v.Temp1 != null && v.Temp1 < 30);
  }).length;

  function alarmCountFor(bed) {
    const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
    return alarms.filter((a) => a.bedId === bedId).length;
  }

  function cardClass(bed) {
    const v = vitalsMap[bed.bedLabel] || {};
    if (v.SpO2 != null && v.SpO2 < 90) return 'critical';
    if (v.Temp1 != null && v.Temp1 < 30) return 'warning';
    return '';
  }

  if (loading) {
    return <div className="empty-state"><h2>Loading unit data...</h2></div>;
  }

  return (
    <div className="dashboard-grid">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Beds in ICU</h2>
          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{occupied}/{beds.length} occupied</span>
        </div>

        {beds.length === 0 ? (
          <div className="empty-state">
            <h2>No beds configured</h2>
            <p>Go to Admin to add your first bed.</p>
          </div>
        ) : (
          <div className="cards-grid">
            {beds.map((bed) => (
              <PatientCard
                key={bed.bedLabel}
                bed={bed}
                vitals={vitalsMap[bed.bedLabel] || {}}
                alarmCount={alarmCountFor(bed)}
                cardClass={cardClass(bed)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="kpi-panel">
        <div className="kpi-card">
          <h3>Patient Acuity</h3>
          <div className="acuity-grid">
            <div className="acuity-box critical">
              <div className="num">{criticalCount}</div>
              <div className="lbl">Critical</div>
            </div>
            <div className="acuity-box moderate">
              <div className="num">0</div>
              <div className="lbl">Moderate</div>
            </div>
            <div className="acuity-box stable">
              <div className="num">{Math.max(occupied - criticalCount, 0)}</div>
              <div className="lbl">Stable</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <h3>Unit Summary</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Bed Utilization</span>
              <strong>{beds.length ? Math.round((occupied / beds.length) * 100) : 0}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Active Alarms</span>
              <strong style={{ color: alarms.length ? '#ef4444' : '#10b981' }}>{alarms.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Data Source</span>
              <strong>Connect Engine</strong>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <h3>Mobile & Watch</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 12 }}>
            Alarms sync to the doctor PWA and Apple Watch via the notification service.
          </p>
          <a href="http://localhost:7031" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ width: '100%' }}>
            Open Mobile PWA
          </a>
        </div>
      </div>
    </div>
  );
}
