import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCenterAnalytics } from '../api/analytics';
import { BRAND_NAME, brandCenterLabel } from '../utils/brand';

function statusClass(status) {
  if (status === 'critical') return 'is-critical';
  if (status === 'warning') return 'is-warning';
  if (status === 'good') return 'is-good';
  return 'is-neutral';
}

function riskTierClass(tier) {
  if (tier === 'CRITICAL') return 'risk-critical';
  if (tier === 'HIGH') return 'risk-high';
  if (tier === 'MODERATE') return 'risk-moderate';
  return 'risk-low';
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function displayText(value) {
  if (!value || !String(value).trim()) return '—';
  return String(value);
}

function KpiCard({ kpi }) {
  return (
    <div className={`ax-kpi ${statusClass(kpi.status)}`}>
      <span className="ax-kpi-label">{kpi.label}</span>
      <div className="ax-kpi-value-row">
        <strong className="ax-kpi-value">{kpi.value ?? '—'}</strong>
        {kpi.unit ? <span className="ax-kpi-unit">{kpi.unit}</span> : null}
      </div>
    </div>
  );
}

function RingGauge({ value, max = 100, label, sublabel, tone = 'primary' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className={`ax-ring ax-ring--${tone}`}>
      <svg viewBox="0 0 100 100" className="ax-ring-svg">
        <circle cx="50" cy="50" r={r} className="ax-ring-bg" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="ax-ring-fill"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ax-ring-center">
        <strong>{value}</strong>
        <span>{pct}%</span>
      </div>
      <div className="ax-ring-label">{label}</div>
      {sublabel ? <div className="ax-ring-sub">{sublabel}</div> : null}
    </div>
  );
}

function MiniBarChart({ data, color = '#0ea5e9', height = 100 }) {
  const canvasRef = useRef(null);
  const items = data || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = height;
    const pad = { top: 8, right: 8, bottom: 22, left: 8 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const max = Math.max(...items.map((d) => d.value), 1);
    const barW = plotW / items.length - 4;

    ctx.clearRect(0, 0, w, h);
    items.forEach((d, i) => {
      const barH = (d.value / max) * plotH;
      const x = pad.left + i * (barW + 4);
      const y = pad.top + plotH - barH;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 3);
      ctx.fill();
      if (items.length <= 12) {
        ctx.fillStyle = '#64748b';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(d.label?.slice(0, 6) || '', x + barW / 2, h - 6);
      }
    });
  }, [items, color, height]);

  return <canvas ref={canvasRef} className="ax-mini-chart" style={{ height }} />;
}

function Sparkline({ data, color = '#6366f1', height = 48 }) {
  const canvasRef = useRef(null);
  const points = data || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = height;
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * (w - 16) + 8;
      const y = h - 8 - ((p.value - min) / range) * (h - 16);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    const last = points[points.length - 1];
    const lx = w - 8;
    const ly = h - 8 - ((last.value - min) / range) * (h - 16);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [points, color, height]);

  return <canvas ref={canvasRef} className="ax-sparkline" style={{ height }} />;
}

export default function Analytics({ centerId, hospitalAdmin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await getCenterAnalytics();
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const ops = data?.operations || {};
  const scoring = data?.clinicalQuality || {};
  const throughput = data?.throughput || {};
  const alarms = data?.alarms || {};
  const devices = data?.devices || {};
  const discharges = data?.discharges || {};

  const scoreBars = useMemo(() => {
    const dist = data?.scoreDistribution || {};
    return ['NEWS2', 'SOFA', 'APACHE_II'].map((type) => ({
      label: type.replace('_', ' '),
      value: (dist[type]?.HIGH || 0) + (dist[type]?.MEDIUM || 0) + (dist[type]?.LOW || 0),
      high: dist[type]?.HIGH || 0,
    }));
  }, [data]);

  if (loading && !data) {
    return <div className="ax-page ax-loading">Loading command center analytics…</div>;
  }

  return (
    <div className="ax-page">
      <header className="ax-hero">
        <div className="ax-hero-text">
          <p className="ax-hero-eyebrow">ICU Command Center · Executive Analytics</p>
          <h1>{brandCenterLabel(data?.center?.displayName || data?.center?.centerName) || BRAND_NAME} — Complete Center Intelligence</h1>
          <p className="ax-hero-sub">
            Real-time fusion of occupancy, acuity, alarms, clinical scores, orders, fluids, and device fleet
          </p>
        </div>
        <div className="ax-hero-meta">
          <span className="ax-live-pill"><span className="ax-live-dot" /> Live</span>
          {lastRefresh ? (
            <span className="ax-refresh-time">Updated {lastRefresh.toLocaleTimeString()}</span>
          ) : null}
          <button type="button" className="btn btn-outline btn-sm" onClick={load}>Refresh</button>
        </div>
      </header>

      {error ? <div className="ax-error">{error}</div> : null}

      <section className="ax-kpi-grid">
        {(data?.executiveKpis || []).map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <div className="ax-grid ax-grid--2">
        <section className="ax-panel ax-insights">
          <h2>Command insights</h2>
          <ul className="ax-insight-list">
            {(data?.insights || []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="ax-panel ax-gauges">
          <h2>Operations pulse</h2>
          <div className="ax-gauge-row">
            <RingGauge
              value={ops.occupancyPct ?? 0}
              max={100}
              label="Occupancy"
              sublabel={ops.capacityStatus}
              tone={ops.capacityStatus === 'CRITICAL' ? 'critical' : 'primary'}
            />
            <RingGauge
              value={throughput.activeCensus ?? 0}
              max={ops.bedCount || 1}
              label="Census"
              sublabel={`${throughput.admissions24h ?? 0} admits / 24h`}
              tone="accent"
            />
            <RingGauge
              value={devices?.ventilators?.inUse ?? 0}
              max={devices?.ventilators?.total || 1}
              label="Ventilators"
              sublabel={`${devices?.ventilators?.utilizationPct ?? 0}% util`}
              tone="warning"
            />
            <RingGauge
              value={scoring.coveragePct ?? 0}
              max={100}
              label="Score coverage"
              sublabel={`${scoring.scoredPatients ?? 0} scored`}
              tone="good"
            />
          </div>
          <div className="ax-spark-block">
            <h3>24h census trend</h3>
            <Sparkline data={data?.hourlyTrends?.occupancy} color="#0ea5e9" />
          </div>
        </section>
      </div>

      <div className="ax-grid ax-grid--3">
        <section className="ax-panel">
          <h2>Unit performance</h2>
          <div className="ax-table-wrap">
            <table className="ax-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Occ.</th>
                  <th>Alarms</th>
                  <th>High risk</th>
                  <th>Avg LOS</th>
                  <th>Load</th>
                </tr>
              </thead>
              <tbody>
                {(data?.units || []).map((u) => (
                  <tr key={u.unitId}>
                    <td>
                      {hospitalAdmin ? (u.code || u.name) : (
                      <Link to={`/overview`} className="ax-unit-link">
                        {u.code || u.name}
                      </Link>
                      )}
                    </td>
                    <td>{u.occupancyPct}%</td>
                    <td className={u.criticalCount > 0 ? 'ax-num-critical' : ''}>{u.activeAlarmCount}</td>
                    <td>{u.highRiskCount}</td>
                    <td>{u.avgLosDays}d</td>
                    <td>
                      <div className="ax-load-bar">
                        <div className="ax-load-fill" style={{ width: `${Math.min(100, u.compositeScore)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ax-panel">
          <h2>Alarm breakdown</h2>
          <MiniBarChart data={alarms.byParam} color="#ef4444" height={120} />
          <div className="ax-stat-row">
            <div><strong>{alarms.critical ?? 0}</strong><span>Critical</span></div>
            <div><strong>{alarms.warning ?? 0}</strong><span>Warning</span></div>
            <div><strong>{alarms.active ?? 0}</strong><span>Total live</span></div>
          </div>
        </section>

        <section className="ax-panel">
          <h2>Clinical scores</h2>
          <MiniBarChart data={scoreBars} color="#6366f1" height={120} />
          <div className="ax-stat-row">
            <div><strong>{scoring.avgNews2 ?? '—'}</strong><span>Avg NEWS2</span></div>
            <div><strong>{scoring.avgSofa ?? '—'}</strong><span>Avg SOFA</span></div>
            <div><strong>{scoring.highRiskPatients ?? 0}</strong><span>High risk</span></div>
          </div>
        </section>
      </div>

      <section className="ax-panel ax-risk-panel">
        <div className="ax-panel-head">
          <h2>Patient risk matrix</h2>
          <span className="ax-panel-hint">Composite acuity from scores, ventilation &amp; deterioration signals</span>
        </div>
        <div className="ax-table-wrap">
          <table className="ax-table ax-risk-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Bed</th>
                <th>Unit</th>
                <th>LOS</th>
                <th>NEWS2</th>
                <th>SOFA</th>
                <th>Vent</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {(data?.riskMatrix || []).map((row) => (
                <tr key={row.mrn} className={row.deteriorating ? 'is-deteriorating' : ''}>
                  <td>{row.patientName}</td>
                  <td>{row.bedLabel}</td>
                  <td>{row.unitName}</td>
                  <td>{row.losDays}d</td>
                  <td>{row.latestScores?.NEWS2?.totalScore ?? '—'}</td>
                  <td>{row.latestScores?.SOFA?.totalScore ?? '—'}</td>
                  <td>{row.ventilated ? 'Yes' : '—'}</td>
                  <td>
                    <span className={`ax-risk-badge ${riskTierClass(row.riskTier)}`}>
                      {row.riskTier} ({row.compositeRisk})
                    </span>
                  </td>
                </tr>
              ))}
              {!data?.riskMatrix?.length ? (
                <tr><td colSpan={8}>No occupied patients</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ax-panel ax-discharge-panel">
        <div className="ax-panel-head">
          <h2>Discharge intelligence</h2>
          <span className="ax-panel-hint">
            Recent discharges · destinations · length of stay at discharge
          </span>
        </div>

        <div className="ax-stat-row ax-discharge-stats">
          <div><strong>{discharges.discharges24h ?? 0}</strong><span>Last 24h</span></div>
          <div><strong>{discharges.discharges7d ?? 0}</strong><span>Last 7 days</span></div>
          <div><strong>{discharges.totalDischarged ?? 0}</strong><span>All time</span></div>
          <div><strong>{discharges.avgLosAtDischargeDays ?? '—'}</strong><span>Avg LOS at discharge (30d)</span></div>
        </div>

        <div className="ax-grid ax-grid--2 ax-discharge-charts">
          <div>
            <h3 className="ax-subhead">Discharges — last 7 days</h3>
            <MiniBarChart data={discharges.dailyTrend} color="#0ea5e9" height={110} />
          </div>
          <div>
            <h3 className="ax-subhead">By destination</h3>
            <MiniBarChart data={discharges.byDestination} color="#6366f1" height={110} />
          </div>
        </div>

        <div className="ax-table-wrap">
          <table className="ax-table ax-discharge-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>MRN</th>
                <th>Unit / bed</th>
                <th>Admitted</th>
                <th>Discharged</th>
                <th>LOS</th>
                <th>Diagnosis</th>
                <th>Destination</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {(discharges.recent || []).map((row) => (
                <tr key={row.visitId}>
                  <td>{row.patientName}</td>
                  <td>{row.mrn}</td>
                  <td>{row.unitCode || row.unitName}{row.bedLabel ? ` / ${row.bedLabel}` : ''}</td>
                  <td>{formatDateTime(row.admittedAt)}</td>
                  <td>{formatDateTime(row.dischargedAt)}</td>
                  <td>{row.losDays != null ? `${row.losDays}d` : '—'}</td>
                  <td>{displayText(row.primaryDiagnosis)}</td>
                  <td>{displayText(row.dischargeDestination)}</td>
                  <td className="ax-cell-wrap">{displayText(row.dischargeReason)}</td>
                </tr>
              ))}
              {!discharges.recent?.length ? (
                <tr><td colSpan={9}>No discharged patients recorded yet</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ax-grid ax-grid--4 ax-ops-strip">
        <section className="ax-panel ax-ops-card">
          <h3>Orders</h3>
          <div className="ax-ops-metric">{data?.orders?.activeCount ?? 0}</div>
          <p>{data?.orders?.statCount ?? 0} STAT · {data?.orders?.routineCount ?? 0} routine</p>
        </section>
        <section className="ax-panel ax-ops-card">
          <h3>Fluids (24h)</h3>
          <div className="ax-ops-metric">{data?.fluids?.netBalanceMl ?? 0} ml</div>
          <p>Net balance · {data?.fluids?.runningInfusions ?? 0} running lines</p>
        </section>
        <section className="ax-panel ax-ops-card">
          <h3>Labs (24h)</h3>
          <div className="ax-ops-metric">{data?.labs?.results24h ?? 0}</div>
          <p>{data?.labs?.abnormal24h ?? 0} abnormal flags</p>
        </section>
        <section className="ax-panel ax-ops-card">
          <h3>Discharges (24h)</h3>
          <div className="ax-ops-metric">{discharges.discharges24h ?? 0}</div>
          <p>{discharges.discharges7d ?? 0} in last 7 days · avg LOS {discharges.avgLosAtDischargeDays ?? '—'}d</p>
        </section>
      </div>
    </div>
  );
}
