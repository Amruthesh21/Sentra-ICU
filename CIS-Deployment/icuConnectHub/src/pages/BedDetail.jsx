import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TrendChart from '../components/TrendChart';
import WaveformCanvas from '../components/WaveformCanvas';
import AlarmThresholdPanel from '../components/AlarmThresholdPanel';
import {
  getPatient,
  getLatestVitals,
  getVitalsHistory,
  getActiveAlarms,
  getBedDevices,
  vitalsToMap,
  hasTrendData,
  normalizeParamName,
  trendParamNames,
  formatVitalValue,
} from '../api/hub';

const PARAM_COLORS = {
  SpO2: '#f59e0b',
  Pulse: '#ef4444',
  HeartRate: '#ef4444',
  Temp1: '#10b981',
  'Resp.Rate': '#0ea5e9',
  PEEP: '#8b5cf6',
  MV: '#6366f1',
  Peak: '#ec4899',
  'Inf Rate': '#6366f1',
  'Inf Vol': '#8b5cf6',
  'Bolus Vol': '#a855f7',
  'Bolus Rate': '#a855f7',
};

const PARAM_UNITS = {
  SpO2: '%',
  HeartRate: 'bpm',
  Pulse: 'bpm',
  Temp1: '°C',
  'Resp.Rate': 'bpm',
  PEEP: 'cmH2O',
  MV: 'L/min',
  Peak: 'cmH2O',
  VT: 'ml',
  'Inf Rate': 'ml/h',
  'Inf Vol': 'ml',
  'Bolus Vol': 'ml',
  'Bolus Rate': 'ml/h',
};

const ALIASES = {
  HeartRate: ['Pulse', 'Heart Rate'],
  'Inf Rate': ['Inf Rate'],
  'Inf Vol': ['Inf Vol'],
  'Resp.Rate': ['Resp.Rate'],
};

const OVERVIEW_ORDER = [
  { key: 'Inf Vol', unit: 'ml', aliases: [] },
  { key: 'Inf Rate', unit: 'ml/h', aliases: [] },
  { key: 'HeartRate', unit: 'bpm', aliases: ['Pulse', 'Heart Rate'] },
  { key: 'Resp.Rate', unit: 'bpm', aliases: [] },
  { key: 'SpO2', unit: '%', aliases: [] },
  { key: 'Temp1', unit: '°C', aliases: ['Temp2'] },
  { key: 'Bolus Vol', unit: 'ml', aliases: [] },
  { key: 'Bolus Rate', unit: 'ml/h', aliases: [] },
];

function resolve(vitals, key, aliases = []) {
  if (vitals[key] != null) return vitals[key];
  for (const a of aliases) {
    if (vitals[a] != null) return vitals[a];
  }
  return null;
}

function getHistorySeries(history, param) {
  return history.find(
    (s) => s.paramName === param || normalizeParamName(s.paramName) === param
  )?.points || [];
}

function paramLabel(key) {
  if (key === 'HeartRate') return 'Heart Rate';
  return key;
}

export default function BedDetail() {
  const { bedId } = useParams();
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState({});
  const [history, setHistory] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [tab, setTab] = useState('overview');
  const [selectedParams, setSelectedParams] = useState([]);
  const [paramWarning, setParamWarning] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const localTrendRef = useRef({});

  const availableParams = useMemo(
    () => deviceStatus?.availableParameters || [],
    [deviceStatus]
  );

  const unavailableParams = useMemo(
    () => deviceStatus?.unavailableParameters || [],
    [deviceStatus]
  );

  const trendParams = useMemo(() => trendParamNames(history), [history]);

  const liveParams = useMemo(() => {
    const names = new Set();
    Object.entries(vitals).forEach(([key, val]) => {
      if (val != null && !Number.isNaN(val)) names.add(normalizeParamName(key));
    });
    return [...names];
  }, [vitals]);

  const selectableParams = useMemo(() => {
    const keys = new Set([
      ...trendParams.map(normalizeParamName),
      ...liveParams,
    ]);
    return [...keys];
  }, [trendParams, liveParams]);

  const overviewParams = useMemo(() => {
    const fromVitals = OVERVIEW_ORDER.filter(
      (p) => resolve(vitals, p.key, p.aliases) != null
    );
    if (fromVitals.length > 0) return fromVitals;

    return selectableParams.map((key) => ({
      key,
      unit: PARAM_UNITS[key] || '',
      aliases: ALIASES[key] || [],
    }));
  }, [selectableParams, vitals]);

  const noDataParams = useMemo(() => {
    return availableParams.filter((name) => {
      const key = normalizeParamName(name);
      return !selectableParams.includes(key) && !selectableParams.includes(name);
    });
  }, [availableParams, selectableParams]);

  function mergeSeries(param) {
    const server = getHistorySeries(history, param);
    const local = localTrendRef.current[param] || [];
    const merged = [...server];
    const seen = new Set(server.map((p) => p.timestamp));
    for (const p of local) {
      if (!seen.has(p.timestamp)) merged.push(p);
    }
    return merged.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  }

  const load = useCallback(async () => {
    try {
      const [patientInfo, vitalsData, historyData, activeAlarms, devices] = await Promise.all([
        getPatient(bedId),
        getLatestVitals(bedId),
        getVitalsHistory(bedId, 60).catch(() => ({ series: [] })),
        getActiveAlarms().catch(() => []),
        getBedDevices(bedId).catch(() => null),
      ]);

      const series = historyData.series || [];
      const vitalsMap = vitalsToMap(vitalsData);
      const now = new Date().toISOString();

      Object.entries(vitalsMap).forEach(([key, val]) => {
        if (val == null || Number.isNaN(val)) return;
        const normalized = normalizeParamName(key);
        if (!localTrendRef.current[normalized]) localTrendRef.current[normalized] = [];
        const points = localTrendRef.current[normalized];
        const last = points[points.length - 1];
        // Append every poll so trends build even when values are unchanged.
        if (!last || last.timestamp !== now) {
          points.push({ timestamp: now, value: val });
          if (points.length > 120) points.shift();
        } else if (last.value !== val) {
          last.value = val;
        }
      });

      setPatient(patientInfo);
      setVitals(vitalsMap);
      setHistory(series);
      setAlarms(activeAlarms.filter((a) => a.bedId === bedId));
      setDeviceStatus(devices);
      setLastUpdate(new Date());

      const withData = trendParamNames(series).map(normalizeParamName);
      const live = Object.keys(vitalsMap)
        .filter((k) => vitalsMap[k] != null)
        .map(normalizeParamName);
      const defaults = [...new Set([...withData, ...live])].slice(0, 8);

      setSelectedParams((prev) => {
        const valid = prev.filter((p) => defaults.includes(normalizeParamName(p)));
        return valid.length ? valid : defaults;
      });
    } catch (err) {
      console.error(err);
    }
  }, [bedId]);

  useEffect(() => {
    localTrendRef.current = {};
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  function toggleParam(nameOrKey) {
    const normalized = normalizeParamName(nameOrKey);

    const unavailable = unavailableParams.find(
      (p) => normalizeParamName(p.name) === normalized || p.name === nameOrKey
    );
    if (unavailable) {
      setParamWarning(`"${nameOrKey}" requires ${unavailable.deviceName} — not connected to this bed.`);
      return;
    }

    const hasLive = liveParams.includes(normalized);
    const hasTrend = hasTrendData(history, nameOrKey) || hasTrendData(history, normalized);

    if (!hasLive && !hasTrend) {
      setParamWarning(`"${nameOrKey}" has no data — cannot select.`);
      return;
    }

    setParamWarning(null);
    setSelectedParams((prev) =>
      prev.includes(normalized) ? prev.filter((x) => x !== normalized) : [...prev, normalized]
    );
  }

  const hr = resolve(vitals, 'HeartRate', ['Pulse', 'Heart Rate']) || 72;
  const rr = resolve(vitals, 'Resp.Rate', ['Resp.Rate']) || 16;
  const bedShort = bedId.replace('ICU-1-', '');

  const liveOnlyParams = selectableParams.filter(
    (k) => liveParams.includes(k) && !trendParams.some((t) => normalizeParamName(t) === k)
  );

  const trendCharts = selectedParams.filter((param) => mergeSeries(param).length > 0);

  return (
    <div>
      <Link to="/" style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 16, display: 'inline-block' }}>
        ← Back to Dashboard
      </Link>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="patient-banner">
            <div>
              <h2>{patient?.patientName || 'No Patient'}</h2>
              <div className="meta">
                {bedShort} · {patient?.patientMRN ? `MRN ${patient.patientMRN}` : 'Unassigned'}
                {patient?.patientAge && ` · ${patient.patientAge} yr`}
                {patient?.patientGender && ` · ${patient.patientGender}`}
              </div>
            </div>
            <div className="live-dot">Live</div>
          </div>

          {deviceStatus?.virtualSimulatorActive && (
            <div className="message info">
              Virtual simulation active — unique vitals generated for this bed (no physical device at {deviceStatus.deviceIp || 'virtual IP'}).
            </div>
          )}

          {deviceStatus && !deviceStatus.simulatorConnected && !deviceStatus.virtualSimulatorActive && (
            <div className="message error">
              Device simulator not connected on this bed ({deviceStatus.deviceIp || 'no IP'}). Admit patient to enable virtual simulation.
            </div>
          )}

          {alarms.length > 0 && (
            <div className="message error">
              {alarms.map((a) => (
                <div key={`${a.paramName}-${a.threshold}`}>
                  {a.paramName}: {formatVitalValue(a.paramName, a.currentValue)} ({a.threshold} threshold)
                </div>
              ))}
            </div>
          )}

          <div className="tabs">
            {['overview', 'trends', 'waveforms', 'alarms'].map((t) => (
              <button key={t} type="button" className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="vitals-grid-large">
              {overviewParams.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <p>No live vitals yet — admit patient and connect devices in Admin.</p>
                </div>
              ) : (
                overviewParams.map((p) => {
                  const val = resolve(vitals, p.key, p.aliases);
                  return (
                    <div key={p.key} className="vital-tile">
                      <div className="v-label">{paramLabel(p.key)}</div>
                      <div className="v-value">{val != null ? formatVitalValue(p.key, val) : '--'}</div>
                      <div className="v-unit">{p.unit}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'trends' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {trendCharts.length === 0 ? (
                <div className="empty-state">
                  <p>Select parameters with live or trend data from the sidebar. Charts build automatically as vitals stream.</p>
                </div>
              ) : (
                trendCharts.map((param) => {
                  const series = mergeSeries(param);
                  const building = series.length < 3;
                  return (
                    <div key={param} className="chart-panel">
                      <h3>
                        {paramLabel(param)}
                        {building && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>
                            building trend…
                          </span>
                        )}
                      </h3>
                      <TrendChart
                        series={series}
                        paramName={param}
                        color={PARAM_COLORS[param] || '#0ea5e9'}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'waveforms' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <WaveformCanvas heartRate={hr} color="#22c55e" label="ECG II" mode="ecg" />
              <WaveformCanvas heartRate={hr} color="#eab308" label="PLETH" mode="pleth" />
              <WaveformCanvas respiratoryRate={rr} color="#06b6d4" label="Resp.Wave" mode="resp" />
            </div>
          )}

          {tab === 'alarms' && (
            <AlarmThresholdPanel
              bedId={bedId}
              patientName={patient?.patientName}
              patientMRN={patient?.patientMRN}
            />
          )}

          {lastUpdate && (
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Updated {lastUpdate.toLocaleTimeString()} · cis-live
            </div>
          )}
        </div>

        <div className="param-list">
          <h3>Parameters · Trends</h3>
          <p className="param-hint">Select any parameter with live or trend data.</p>

          {paramWarning && (
            <div className="message error" style={{ marginBottom: 12, fontSize: '0.8rem' }}>
              {paramWarning}
            </div>
          )}

          {trendParams.length > 0 && (
            <div className="param-section">
              <div className="param-section-title">Has trend history</div>
              {trendParams.map((name) => {
                const key = normalizeParamName(name);
                return (
                  <label key={name} className="param-item param-available">
                    <input
                      type="checkbox"
                      checked={selectedParams.includes(key) || selectedParams.includes(name)}
                      onChange={() => toggleParam(name)}
                    />
                    {name}
                  </label>
                );
              })}
            </div>
          )}

          {liveOnlyParams.length > 0 && (
            <div className="param-section">
              <div className="param-section-title">Live now — trend building</div>
              {liveOnlyParams.map((key) => (
                <label key={key} className="param-item param-available">
                  <input
                    type="checkbox"
                    checked={selectedParams.includes(key)}
                    onChange={() => toggleParam(key)}
                  />
                  {paramLabel(key)}
                </label>
              ))}
            </div>
          )}

          {selectableParams.length === 0 && (
            <p className="param-empty">Waiting for vitals…</p>
          )}

          {noDataParams.length > 0 && (
            <div className="param-section param-section-muted">
              <div className="param-section-title">No data — cannot select</div>
              {noDataParams.map((name) => (
                <div key={name} className="param-item param-disabled" title="No data">
                  <span className="param-x">✕</span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          )}

          {unavailableParams.length > 0 && (
            <div className="param-section param-section-muted">
              <div className="param-section-title">Device not connected</div>
              {unavailableParams.map((p) => (
                <div key={p.name} className="param-item param-unavailable" title={`Requires ${p.deviceName}`}>
                  <span className="param-x">✕</span>
                  <span>
                    {p.name}
                    <small>{p.deviceName}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
