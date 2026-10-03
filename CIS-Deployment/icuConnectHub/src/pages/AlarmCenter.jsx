import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { acknowledgeAlarm, getAlarmFeed } from '../api/hub';
import { canonicalAlarmBedId } from '../api/alarmConfig';
import { listCenters } from '../api/hospitalAdmin';
import { getUnit, listUnits } from '../api/units';
import { bedDetailPath } from '../constants/bedDetailTabs';

const MUTE_KEY = 'icuHub.alarmCenterMuted';
const ALL_UNITS_ID = 'all';
const SCOPE_CENTER = 'center';
const SCOPE_ALL_CENTERS = 'all-centers';
const SCOPE_ALL_UNITS = 'all-units';
const SCOPE_UNIT = 'unit';

function unitOptionLabel(unit) {
  const code = unit.code || unit.name;
  if (unit.blockName && !unit.blockName.toUpperCase().includes('SENTRA')) {
    return `${code} · ${unit.blockName}`;
  }
  return unit.name && unit.name !== code ? `${code} — ${unit.name}` : code;
}

function formatAlarmTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function bedLabelFromId(bedId) {
  if (!bedId) return '—';
  return bedId.replace(/^ICU-1-/, '');
}

function alarmTitle(alarm) {
  if (alarm.title) return alarm.title;
  const param = alarm.paramName || 'Alarm';
  if (alarm.threshold === 'LOW') return `${param} below limit`;
  if (alarm.threshold === 'HIGH') return `${param} above limit`;
  return `${param} alarm`;
}

function AlarmCard({ alarm, unitLabel, onAcknowledge, hospitalAdmin = false }) {
  const navigate = useNavigate();
  const waveformsPath = bedDetailPath(alarm.bedId, 'waveforms');
  const label = bedLabelFromId(alarm.bedId);

  return (
    <article
      className={`alarm-center-card ${alarm.acknowledged ? 'is-acked' : 'is-active'}${hospitalAdmin ? '' : ' is-clickable'}`}
      role={hospitalAdmin ? undefined : 'link'}
      tabIndex={hospitalAdmin ? undefined : 0}
      title={hospitalAdmin ? undefined : 'Open live waveforms'}
      onClick={hospitalAdmin ? undefined : () => navigate(waveformsPath)}
      onKeyDown={hospitalAdmin ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(waveformsPath);
        }
      }}
    >
      <div className="alarm-center-card-head">
        <div>
          <div className="alarm-center-patient">{alarm.patientName || 'Unknown patient'}</div>
          <div className="alarm-center-bed">
            {unitLabel && <span className="alarm-center-unit">{unitLabel}</span>}
            Bed {label}
          </div>
        </div>
        <div className="alarm-center-card-actions">
          {!alarm.acknowledged && (
            <button
              type="button"
              className="alarm-icon-btn"
              title="Acknowledge"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(alarm);
              }}
            >
              ✓
            </button>
          )}
          {!hospitalAdmin && (
          <Link
            to={waveformsPath}
            className="alarm-icon-btn"
            title="Open waveforms"
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </Link>
          )}
        </div>
      </div>
      <p className="alarm-center-card-title">{alarmTitle(alarm)}</p>
      {alarm.currentValue != null && (
        <p className="alarm-center-card-value muted">
          {alarm.paramName}: {alarm.currentValue}
          {alarm.thresholdValue != null ? ` (limit ${alarm.thresholdValue})` : ''}
        </p>
      )}
      <div className="alarm-center-card-foot">
        <time>{formatAlarmTime(alarm.timestamp)}</time>
        <span className={`alarm-status-pill ${alarm.acknowledged ? 'is-acked' : 'is-live'}`}>
          {alarm.acknowledged ? 'Acknowledged' : 'Active'}
        </span>
      </div>
    </article>
  );
}

export default function AlarmCenter({ centerId: centerIdProp, hospitalAdmin = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const unitId = searchParams.get('unitId') || '';
  const scopeParam = searchParams.get('scope') || (hospitalAdmin && centerIdProp ? SCOPE_CENTER : SCOPE_ALL_UNITS);
  const filterCenterId = searchParams.get('filterCenter') || centerIdProp || '';
  const [units, setUnits] = useState([]);
  const [centers, setCenters] = useState([]);
  const [bedUnitMap, setBedUnitMap] = useState({});
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    if (hospitalAdmin || units.length === 0) return;
    const valid = unitId === ALL_UNITS_ID || units.some((u) => u.unitId === unitId);
    if (!valid) {
      navigate(`/alarms?unitId=${encodeURIComponent(units[0].unitId)}`, { replace: true });
    }
  }, [units, unitId, navigate, hospitalAdmin]);

  const load = useCallback(async () => {
    try {
      const [unitList, feed, centerList] = await Promise.all([
        listUnits().catch(() => []),
        getAlarmFeed().catch(() => []),
        hospitalAdmin ? listCenters().catch(() => []) : Promise.resolve([]),
      ]);
      const filteredUnits = unitList.filter((u) => (u.bedCount ?? 0) > 0);
      setUnits(filteredUnits);
      setCenters(centerList);

      const map = {};
      await Promise.all(filteredUnits.map(async (u) => {
        const detail = await getUnit(u.unitId).catch(() => null);
        for (const bed of detail?.beds || []) {
          const canonical = canonicalAlarmBedId(`ICU-1-${bed.bedLabel}`);
          map[canonical] = u;
          map[bed.bedLabel] = u;
          map[`ICU-1-${bed.bedLabel}`] = u;
        }
      }));
      setBedUnitMap(map);
      setAlarms(Array.isArray(feed) ? feed : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [hospitalAdmin]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const isAllUnits = scopeParam === SCOPE_ALL_UNITS || unitId === ALL_UNITS_ID;
  const isAllCenters = scopeParam === SCOPE_ALL_CENTERS;
  const isCenterScope = scopeParam === SCOPE_CENTER;

  const scopedUnits = useMemo(() => {
    if (!hospitalAdmin || isAllCenters) return units;
    if (isCenterScope && filterCenterId) {
      return units.filter((u) => u.centerId === filterCenterId || !u.centerId);
    }
    if (centerIdProp && scopeParam === SCOPE_CENTER) {
      return units.filter((u) => u.centerId === centerIdProp || !u.centerId);
    }
    return units;
  }, [units, hospitalAdmin, isAllCenters, isCenterScope, filterCenterId, centerIdProp, scopeParam]);

  const selectedUnit = useMemo(
    () => (scopeParam === SCOPE_UNIT && unitId ? scopedUnits.find((u) => u.unitId === unitId) : null),
    [scopedUnits, unitId, scopeParam],
  );

  const unitAlarms = useMemo(() => {
    if (isAllCenters) return alarms;
    if (isCenterScope && filterCenterId) {
      return alarms.filter((a) => {
        const unit = bedUnitMap[canonicalAlarmBedId(a.bedId)] || bedUnitMap[a.bedId];
        return unit?.centerId === filterCenterId || !unit?.centerId;
      });
    }
    if (isAllUnits) return alarms;
    return alarms.filter((a) => {
      const unit = bedUnitMap[canonicalAlarmBedId(a.bedId)] || bedUnitMap[a.bedId];
      return unit?.unitId === unitId;
    });
  }, [alarms, bedUnitMap, unitId, isAllUnits, isAllCenters, isCenterScope, filterCenterId]);

  const activeCount = unitAlarms.filter((a) => !a.acknowledged).length;
  const ackedCount = unitAlarms.filter((a) => a.acknowledged).length;

  async function handleAcknowledge(alarm) {
    setAcking(true);
    try {
      await acknowledgeAlarm({
        bedId: alarm.bedId,
        paramName: alarm.paramName,
        threshold: alarm.threshold,
        currentValue: alarm.currentValue,
      });
      await load();
    } finally {
      setAcking(false);
    }
  }

  async function handleAcknowledgeAll() {
    const pending = unitAlarms.filter((a) => !a.acknowledged);
    if (!pending.length) return;
    setAcking(true);
    try {
      await Promise.all(pending.map((a) => acknowledgeAlarm({
        bedId: a.bedId,
        paramName: a.paramName,
        threshold: a.threshold,
        currentValue: a.currentValue,
      })));
      await load();
    } finally {
      setAcking(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    window.dispatchEvent(new CustomEvent('icu-hub-alarm-mute', { detail: { muted: next } }));
  }

  function updateScope(next) {
    const params = new URLSearchParams(searchParams);
    params.set('scope', next.scope);
    if (next.unitId) params.set('unitId', next.unitId);
    else params.delete('unitId');
    if (next.filterCenter) params.set('filterCenter', next.filterCenter);
    else params.delete('filterCenter');
    setSearchParams(params, { replace: true });
  }

  function handleUnitChange(e) {
    const next = e.target.value;
    if (hospitalAdmin) {
      updateScope({ scope: SCOPE_UNIT, unitId: next, filterCenter: filterCenterId });
    } else if (next) {
      navigate(`/alarms?unitId=${encodeURIComponent(next)}`, { replace: true });
    }
  }

  function handleScopeChange(e) {
    const scope = e.target.value;
    if (scope === SCOPE_UNIT) {
      updateScope({ scope, unitId: scopedUnits[0]?.unitId || units[0]?.unitId || '', filterCenter: filterCenterId });
    } else if (scope === SCOPE_CENTER) {
      updateScope({ scope, filterCenter: centerIdProp || centers[0]?.centerId || '' });
    } else {
      updateScope({ scope });
    }
  }

  function handleCenterFilterChange(e) {
    updateScope({ scope: SCOPE_CENTER, filterCenter: e.target.value });
  }

  function unitLabelForAlarm(alarm) {
    const unit = bedUnitMap[alarm.bedId];
    return unit ? unitOptionLabel(unit) : null;
  }

  if (loading && units.length === 0) {
    return <div className="empty-state"><h2>Loading alarm center…</h2></div>;
  }

  return (
    <div className={`alarm-center-page${hospitalAdmin ? ' alarm-center-page--ha' : ''}`}>
      {!hospitalAdmin && (
      <div className="alarm-center-intro glass-card">
        <div>
          <h2 className="alarm-center-heading">Alarm Center</h2>
          <p className="muted alarm-center-sub">
            Hospital-wide physiological and device alarms for rapid triage.
            Acknowledge here to silence the hub alert while monitoring continues on the bed.
          </p>
        </div>
        <div className="alarm-center-stats">
          <div className="alarm-stat-pill is-live">{activeCount} active</div>
          <div className="alarm-stat-pill is-acked">{ackedCount} acknowledged</div>
        </div>
      </div>
      )}

      <div className="alarm-center-toolbar glass-card">
        {hospitalAdmin ? (
          <div className="ha-alarm-scope-bar">
            <div className="form-group">
              <label htmlFor="alarm-scope">View by</label>
              <select id="alarm-scope" className="unit-filter-select" value={scopeParam} onChange={handleScopeChange}>
                <option value={SCOPE_ALL_CENTERS}>All centers</option>
                <option value={SCOPE_CENTER}>Center</option>
                <option value={SCOPE_ALL_UNITS}>All units</option>
                <option value={SCOPE_UNIT}>Unit</option>
              </select>
            </div>
            {isCenterScope && (
              <div className="form-group">
                <label htmlFor="alarm-center-filter">Center</label>
                <select
                  id="alarm-center-filter"
                  className="unit-filter-select"
                  value={filterCenterId}
                  onChange={handleCenterFilterChange}
                >
                  {centers.map((c) => (
                    <option key={c.centerId} value={c.centerId}>{c.name || c.centerId}</option>
                  ))}
                </select>
              </div>
            )}
            {scopeParam === SCOPE_UNIT && (
              <div className="form-group">
                <label htmlFor="alarm-unit-select">Unit</label>
                <select
                  id="alarm-unit-select"
                  className="unit-filter-select"
                  value={unitId || scopedUnits[0]?.unitId || units[0]?.unitId || ''}
                  onChange={handleUnitChange}
                  disabled={scopedUnits.length === 0}
                >
                  {scopedUnits.map((u) => (
                    <option key={u.unitId} value={u.unitId}>{unitOptionLabel(u)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
        <div className="form-group">
          <label htmlFor="alarm-unit-select">Unit</label>
          <select
            id="alarm-unit-select"
            className="unit-filter-select"
            value={isAllUnits ? ALL_UNITS_ID : (unitId || units[0]?.unitId || '')}
            onChange={handleUnitChange}
            disabled={units.length === 0}
          >
            <option value={ALL_UNITS_ID}>All units</option>
            {units.map((u) => (
              <option key={u.unitId} value={u.unitId}>{unitOptionLabel(u)}</option>
            ))}
          </select>
        </div>
        )}
        <div className="alarm-center-toolbar-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={!activeCount || acking}
            onClick={handleAcknowledgeAll}
          >
            {acking ? 'Working…' : 'Acknowledge All'}
          </button>
          <button
            type="button"
            className={`btn btn-outline btn-sm ${muted ? 'is-muted' : ''}`}
            onClick={toggleMute}
          >
            {muted ? 'Unmute' : 'Mute Notifications'}
          </button>
        </div>
      </div>

      {unitAlarms.length === 0 ? (
        <div className="empty-state glass-card">
          <h2>
            No alarms
            {isAllCenters ? ' across all centers' : isCenterScope ? ` for ${filterCenterId}` : isAllUnits ? ' across all units' : ` for ${selectedUnit ? unitOptionLabel(selectedUnit) : 'this unit'}`}
          </h2>
          <p className="muted">All beds are within configured limits in the last 30 minutes.</p>
        </div>
      ) : (
        <div className="alarm-center-grid">
          {unitAlarms.map((alarm, idx) => (
            <AlarmCard
              key={`${alarm.bedId}-${alarm.paramName}-${alarm.threshold}-${idx}`}
              alarm={alarm}
              unitLabel={isAllUnits || isAllCenters || isCenterScope ? unitLabelForAlarm(alarm) : null}
              hospitalAdmin={hospitalAdmin}
              onAcknowledge={handleAcknowledge}
            />
          ))}
        </div>
      )}
    </div>
  );
}
