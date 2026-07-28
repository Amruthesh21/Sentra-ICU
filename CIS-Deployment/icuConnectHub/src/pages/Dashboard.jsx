import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PatientCard from '../components/PatientCard';
import { getCenter, getLatestVitals, getActiveAlarms, vitalsToMap } from '../api/hub';
import { canonicalAlarmBedId } from '../api/alarmConfig';
import { listUnits, getUnit } from '../api/units';
import { BRAND_NAME, brandCenterLabel } from '../utils/brand';

function unitOptionLabel(unit) {
  const code = unit.code || unit.name;
  if (unit.blockName && !unit.blockName.toUpperCase().includes('SENTRA') && !unit.blockName.toUpperCase().includes('RTWO')) {
    return `${code} · ${unit.blockName}`;
  }
  return unit.name && unit.name !== code ? `${code} — ${unit.name}` : code;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get('unitId') || '';
  const [beds, setBeds] = useState([]);
  const [units, setUnits] = useState([]);
  const [centerLabel, setCenterLabel] = useState('Loading…');
  const [centerId, setCenterId] = useState('');
  const [vitalsMap, setVitalsMap] = useState({});
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedUnit = useMemo(
    () => units.find((u) => u.unitId === unitId),
    [units, unitId],
  );

  useEffect(() => {
    if (units.length === 0) return;
    const valid = unitId && units.some((u) => u.unitId === unitId);
    if (!valid) {
      navigate(`/unit?unitId=${encodeURIComponent(units[0].unitId)}`, { replace: true });
    }
  }, [units, unitId, navigate]);

  const load = useCallback(async () => {
    try {
      const [center, activeAlarms, unitList] = await Promise.all([
        getCenter(),
        getActiveAlarms().catch(() => []),
        listUnits().catch(() => []),
      ]);

      setCenterLabel(
        brandCenterLabel(center.centerName, center.centerLocation)
          || brandCenterLabel(center.centerId)
          || BRAND_NAME,
      );
      setCenterId(center.centerId || '');

      const filteredUnits = unitList.filter((u) => (u.bedCount ?? 0) > 0);
      setUnits(filteredUnits);

      let bedList = [];
      if (unitId && filteredUnits.some((u) => u.unitId === unitId)) {
        const detail = await getUnit(unitId).catch(() => null);
        if (detail?.beds) {
          const labels = new Set(detail.beds.map((b) => b.bedLabel));
          bedList = (center.beds || []).filter((b) => labels.has(b.bedLabel));
        }
      }

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
        }),
      );
      setVitalsMap(Object.fromEntries(vitalsResults));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const bedAlarmIds = useMemo(
    () => new Set(beds.map((b) => canonicalAlarmBedId(b.alarmBedId || `ICU-1-${b.bedLabel}`))),
    [beds],
  );

  const unitAlarms = useMemo(
    () => (alarms || []).filter((a) => bedAlarmIds.has(canonicalAlarmBedId(a.bedId))),
    [alarms, bedAlarmIds],
  );

  const occupied = beds.filter((b) => b.occupied).length;
  const criticalCount = beds.filter((b) => {
    const bedAlarms = alarmsForBed(b);
    if (bedAlarms.some((a) => a.severity === 'CRITICAL')) return true;
    const v = vitalsMap[b.bedLabel] || {};
    return (v.SpO2 != null && v.SpO2 < 90) || (v.Temp1 != null && v.Temp1 < 30);
  }).length;

  function alarmsForBed(bed) {
    const bedId = canonicalAlarmBedId(bed.alarmBedId || `ICU-1-${bed.bedLabel}`);
    return unitAlarms.filter((a) => canonicalAlarmBedId(a.bedId) === bedId);
  }

  function alarmCountFor(bed) {
    return alarmsForBed(bed).length;
  }

  function cardClass(bed) {
    const bedAlarms = alarmsForBed(bed);
    if (bedAlarms.some((a) => a.severity === 'CRITICAL')) return 'critical has-alarm';
    if (bedAlarms.length > 0) return 'warning has-alarm';

    const v = vitalsMap[bed.bedLabel] || {};
    if (v.SpO2 != null && v.SpO2 < 90) return 'critical';
    if (v.Temp1 != null && (v.Temp1 < 30 || v.Temp1 > 38)) return 'warning';
    return '';
  }

  function handleUnitChange(e) {
    const next = e.target.value;
    if (next) navigate(`/unit?unitId=${encodeURIComponent(next)}`, { replace: true });
  }

  if (loading && beds.length === 0 && units.length === 0) {
    return <div className="empty-state"><h2>Loading unit data...</h2></div>;
  }

  const heading = selectedUnit
    ? `${selectedUnit.code || selectedUnit.name} — Beds`
    : 'Unit — Beds';

  return (
    <div className="unit-dashboard">
      <div className="unit-dashboard-toolbar glass-card">
        <div className="unit-dashboard-toolbar-main">
          <div className="unit-view-filters">
            <div className="form-group">
              <label htmlFor="center-select">Center</label>
              <select id="center-select" value={centerId || 'center'} disabled className="unit-filter-select">
                <option value={centerId || 'center'}>{centerLabel}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="unit-select">Unit</label>
              <select
                id="unit-select"
                className="unit-filter-select"
                value={unitId || units[0]?.unitId || ''}
                onChange={handleUnitChange}
                disabled={units.length === 0}
              >
                {units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>
                    {unitOptionLabel(u)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="unit-dashboard-heading">
            <h2>{heading}</h2>
            <p className="muted">Live bed board · vitals refresh every 3s</p>
          </div>
        </div>
        <div className="unit-dashboard-stats">
          <div className="unit-stat-pill">
            <span className="muted">Occupied</span>
            <strong>{occupied}/{beds.length}</strong>
          </div>
          <div className="unit-stat-pill">
            <span className="muted">Alarms</span>
            <strong className={unitAlarms.length ? 'text-critical' : 'text-success'}>
              {unitAlarms.length}
            </strong>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
      <div>
        {beds.length === 0 ? (
          <div className="empty-state glass-card">
            <h2>No beds in this unit</h2>
            <p>Select another unit or add beds in Admin.</p>
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
                unitId={unitId || selectedUnit?.unitId}
              />
            ))}
          </div>
        )}
      </div>

      <div className="kpi-panel">
        <div className="kpi-card glass-card">
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

        <div className="kpi-card glass-card">
          <h3>Unit Summary</h3>
          <div className="kpi-rows">
            <div className="kpi-row">
              <span>Scope</span>
              <strong>{selectedUnit ? unitOptionLabel(selectedUnit) : '—'}</strong>
            </div>
            <div className="kpi-row">
              <span>Bed Utilization</span>
              <strong>{beds.length ? Math.round((occupied / beds.length) * 100) : 0}%</strong>
            </div>
            <div className="kpi-row">
              <span>Active Alarms</span>
              <strong style={{ color: unitAlarms.length ? '#ef4444' : '#10b981' }}>
                {unitAlarms.length}
              </strong>
            </div>
            <div className="kpi-row">
              <span>Data Source</span>
              <strong>Hospital connectivity</strong>
            </div>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <h3>Mobile & Watch</h3>
          <p className="kpi-note">
            Alarms sync to the doctor PWA and Apple Watch via the notification service.
          </p>
          <a href="http://localhost:7031" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ width: '100%' }}>
            Open Mobile PWA
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}
