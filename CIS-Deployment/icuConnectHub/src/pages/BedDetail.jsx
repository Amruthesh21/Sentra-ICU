import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import TrendChart from '../components/TrendChart';
import WaveformsPanel from '../components/WaveformsPanel';
import AlarmThresholdPanel from '../components/AlarmThresholdPanel';
import ClinicalNotesPanel from '../components/ClinicalNotesPanel';
import ClinicalOrdersPanel from '../components/ClinicalOrdersPanel';
import LabsImagingPanel from '../components/LabsImagingPanel';
import ClinicalFluidsPanel from '../components/ClinicalFluidsPanel';
import PatientSummaryPanel from '../components/PatientSummaryPanel';
import { getClinicalContext } from '../api/clinical';
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
import { resolveBedTab } from '../constants/bedDetailTabs';
import { canonicalAlarmBedId } from '../api/alarmConfig';

const TREND_PRESETS = [
  { id: 'live', label: 'Live (5m)', minutes: 5 },
  { id: '6h', label: '6 hours', minutes: 360 },
  { id: '12h', label: '12 hours', minutes: 720 },
  { id: '24h', label: '24 hours', minutes: 1440 },
  { id: 'custom', label: 'Custom range', minutes: null },
];

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rangeForPreset(presetId, customFrom, customTo) {
  const now = new Date();
  if (presetId === 'custom' && customFrom && customTo) {
    return { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString(), live: false };
  }
  const preset = TREND_PRESETS.find((p) => p.id === presetId) || TREND_PRESETS[0];
  const from = new Date(now.getTime() - preset.minutes * 60 * 1000);
  return { from: from.toISOString(), to: now.toISOString(), live: presetId === 'live', minutes: preset.minutes };
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveBedTab(searchParams.get('tab'));
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState({});
  const [history, setHistory] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [selectedParams, setSelectedParams] = useState([]);
  const [paramWarning, setParamWarning] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [clinicalCtx, setClinicalCtx] = useState(null);
  const [trendPreset, setTrendPreset] = useState('live');
  const [customFrom, setCustomFrom] = useState(() => toLocalInputValue(new Date(Date.now() - 3600000)));
  const [customTo, setCustomTo] = useState(() => toLocalInputValue(new Date()));
  const [historyMeta, setHistoryMeta] = useState(null);
  const localTrendRef = useRef({});

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw && raw !== tab) {
      setSearchParams({ tab }, { replace: true });
    }
  }, [searchParams, tab, setSearchParams]);

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

  function mergeSeries(param, includeLocal = true) {
    const server = getHistorySeries(history, param);
    const range = rangeForPreset(trendPreset, customFrom, customTo);
    const fromMs = new Date(range.from).getTime();
    const toMs = new Date(range.to).getTime();
    const inRange = (p) => {
      const t = new Date(p.timestamp).getTime();
      return t >= fromMs && t <= toMs;
    };
    const merged = server.filter(inRange);
    const seen = new Set(merged.map((p) => p.timestamp));
    if (includeLocal && range.live) {
      const local = localTrendRef.current[param] || [];
      for (const p of local) {
        if (!seen.has(p.timestamp) && inRange(p)) merged.push(p);
      }
    }
    return merged.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  }

  const loadHistory = useCallback(async () => {
    const range = rangeForPreset(trendPreset, customFrom, customTo);
    try {
      const historyData = await getVitalsHistory(bedId, { from: range.from, to: range.to });
      setHistory(historyData.series || []);
      setHistoryMeta({ from: historyData.from, to: historyData.to, source: historyData.source });
    } catch {
      setHistory([]);
    }
  }, [bedId, trendPreset, customFrom, customTo]);

  const load = useCallback(async () => {
    try {
      const range = rangeForPreset(trendPreset, customFrom, customTo);
      const [patientInfo, vitalsData, historyData, activeAlarms, devices, ctx] = await Promise.all([
        getPatient(bedId),
        getLatestVitals(bedId),
        getVitalsHistory(bedId, range.live
          ? { minutes: range.minutes ?? 5 }
          : { from: range.from, to: range.to }),
        getActiveAlarms().catch(() => []),
        getBedDevices(bedId).catch(() => null),
        getClinicalContext(bedId).catch(() => ({ hasPatient: false })),
      ]);

      const series = historyData.series || [];
      const vitalsMap = vitalsToMap(vitalsData);
      const now = new Date().toISOString();

      if (range.live) {
        Object.entries(vitalsMap).forEach(([key, val]) => {
          if (val == null || Number.isNaN(val)) return;
          const normalized = normalizeParamName(key);
          if (!localTrendRef.current[normalized]) localTrendRef.current[normalized] = [];
          const points = localTrendRef.current[normalized];
          const last = points[points.length - 1];
          if (!last || last.timestamp !== now) {
            points.push({ timestamp: now, value: val });
            if (points.length > 120) points.shift();
          } else if (last.value !== val) {
            last.value = val;
          }
        });
      }

      setPatient(patientInfo);
      setVitals(vitalsMap);
      setHistory(series);
      setHistoryMeta({ from: historyData.from, to: historyData.to, source: historyData.source });
      setClinicalCtx(ctx);
      setAlarms(activeAlarms.filter((a) => canonicalAlarmBedId(a.bedId) === canonicalAlarmBedId(bedId)));
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
  }, [bedId, trendPreset, customFrom, customTo]);

  useEffect(() => {
    localTrendRef.current = {};
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (tab === 'trends' && trendPreset === 'custom') {
      loadHistory();
    }
  }, [tab, trendPreset, customFrom, customTo, loadHistory]);

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

  const bedShort = bedId.replace('ICU-1-', '');

  const liveOnlyParams = selectableParams.filter(
    (k) => liveParams.includes(k) && !trendParams.some((t) => normalizeParamName(t) === k)
  );

  const trendCharts = selectedParams.filter((param) => mergeSeries(param, trendPreset === 'live').length > 0);
  const visitId = clinicalCtx?.visitId;
  const isLiveTrend = trendPreset === 'live';
  const showParamPanel = tab === 'trends';
  const patientSummary = clinicalCtx?.patientSummary;

  const paramPanel = showParamPanel ? (
    <div className="param-list param-list--sidebar">
      <h3>Parameters · Trends</h3>
      <p className="param-hint">Select any parameter with live or trend data.</p>

      {paramWarning && (
        <div className="message error param-list-message">
          {paramWarning}
        </div>
      )}

      <div className="param-list-sections">
        {trendParams.length > 0 && (
          <div className="param-section">
            <div className="param-section-title">Has trend history</div>
            <div className="param-check-grid">
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
          </div>
        )}

        {liveOnlyParams.length > 0 && (
          <div className="param-section">
            <div className="param-section-title">Live now — trend building</div>
            <div className="param-check-grid">
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
          </div>
        )}

        {selectableParams.length === 0 && (
          <p className="param-empty">Waiting for vitals…</p>
        )}

        {noDataParams.length > 0 && (
          <div className="param-section param-section-muted">
            <div className="param-section-title">No data — cannot select</div>
            <div className="param-check-grid">
              {noDataParams.map((name) => (
                <div key={name} className="param-item param-disabled" title="No data">
                  <span className="param-x">✕</span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unavailableParams.length > 0 && (
          <div className="param-section param-section-muted">
            <div className="param-section-title">Device not connected</div>
            <div className="param-check-grid">
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
          </div>
        )}
      </div>
    </div>
  ) : null;

  const patientName = patient?.patientName || patientSummary?.patientName || 'No Patient';
  const patientMrn = patient?.patientMRN || patientSummary?.mrn;
  const patientAge = patient?.patientAge ?? patientSummary?.age;
  const patientGender = patient?.patientGender || patientSummary?.gender;
  const showFullSummary = tab === 'overview';

  return (
    <div className="bed-detail-page">
      <Link to="/" className="bed-detail-back">
        ← Back to Dashboard
      </Link>

      <div className="bed-detail-chrome">
        {showFullSummary ? (
          <div className="patient-banner patient-banner--full">
            <div className="patient-banner-top">
              <div className="patient-banner-identity">
                <h2>{patientName}</h2>
                <div className="meta">
                  {clinicalCtx?.bedLabel || bedShort}
                  {patientMrn ? ` · MRN ${patientMrn}` : ' · Unassigned'}
                  {patientAge != null && ` · ${patientAge} yr`}
                  {patientGender && ` · ${patientGender}`}
                </div>
              </div>
              <div className="live-dot">Live</div>
            </div>
            {patientSummary && (
              <PatientSummaryPanel summary={patientSummary} variant="header" />
            )}
          </div>
        ) : (
          patientSummary && (
            <PatientSummaryPanel
              summary={patientSummary}
              variant="context-bar"
              bedLabel={clinicalCtx?.bedLabel || bedShort}
            />
          )
        )}

      </div>

      <div className={`detail-layout${tab === 'trends' ? ' detail-layout--with-params' : ' detail-layout--full'}`}>
        <div className="detail-main">
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
              <div className="trend-range-bar glass-card">
                <div className="trend-range-presets">
                  {TREND_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`btn btn-sm${trendPreset === p.id ? ' btn-primary' : ' btn-outline'}`}
                      onClick={() => setTrendPreset(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {trendPreset === 'custom' && (
                  <div className="trend-range-custom form-grid two-col">
                    <div className="form-group">
                      <label>From</label>
                      <input type="datetime-local" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>To</label>
                      <input type="datetime-local" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-primary" onClick={loadHistory}>Apply range</button>
                  </div>
                )}
                {historyMeta && (
                  <p className="muted trend-range-hint">
                    {isLiveTrend ? 'Live trend — updating every 3s' : 'Historical view'}
                    {' · '}
                    {new Date(historyMeta.from).toLocaleString()} — {new Date(historyMeta.to).toLocaleString()}
                    {historyMeta.source && historyMeta.source !== 'none' ? ` · ${historyMeta.source}` : ''}
                  </p>
                )}
              </div>

              {trendCharts.length === 0 ? (
                <div className="empty-state">
                  <p>Select parameters with live or trend data from the sidebar. Use the time range above to view history.</p>
                </div>
              ) : (
                trendCharts.map((param) => {
                  const series = mergeSeries(param, isLiveTrend);
                  const building = series.length < 3;
                  return (
                    <div key={param} className="chart-panel">
                      <h3>
                        {paramLabel(param)}
                        {building && isLiveTrend && (
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
            <WaveformsPanel
              vitals={vitals}
              deviceStatus={deviceStatus}
              patient={patient}
            />
          )}

          {tab === 'labs' && (
            <LabsImagingPanel visitId={visitId} />
          )}

          {tab === 'notes' && (
            <ClinicalNotesPanel
              visitId={visitId}
              patientName={patient?.patientName}
              patientMRN={patient?.patientMRN}
              bedLabel={clinicalCtx?.bedLabel}
            />
          )}

          {tab === 'orders' && (
            <ClinicalOrdersPanel visitId={visitId} bedLabel={clinicalCtx?.bedLabel} />
          )}

          {tab === 'fluids' && (
            <ClinicalFluidsPanel visitId={visitId} bedLabel={clinicalCtx?.bedLabel} />
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

        {showParamPanel && (
          <aside className="detail-sidebar detail-sidebar--params">
            {paramPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
