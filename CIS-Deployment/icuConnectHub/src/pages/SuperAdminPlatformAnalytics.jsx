import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlatformAnalytics } from '../api/superAdmin';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tenants', label: 'Tenant adoption' },
  { id: 'governance', label: 'Governance & audit' },
];

function statusClass(status) {
  if (status === 'critical') return 'is-critical';
  if (status === 'warning') return 'is-warning';
  if (status === 'good') return 'is-good';
  return 'is-neutral';
}

function KpiCard({ label, value, unit, status = 'neutral' }) {
  return (
    <div className={`ax-kpi ${statusClass(status)}`}>
      <span className="ax-kpi-label">{label}</span>
      <div className="ax-kpi-value-row">
        <strong className="ax-kpi-value">{value ?? '—'}</strong>
        {unit ? <span className="ax-kpi-unit">{unit}</span> : null}
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
        <circle cx="50" cy="50" r={r} className="ax-ring-fill" strokeDasharray={c} strokeDashoffset={offset} />
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

function TrendChart({ data, color = '#0a3d62', height = 120 }) {
  const canvasRef = useRef(null);
  const items = useMemo(
    () => (data || []).map((row) => ({
      label: String(row.day || '').slice(5),
      value: row.count || 0,
    })),
    [data],
  );

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
    const pad = { top: 10, right: 10, bottom: 26, left: 10 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const max = Math.max(...items.map((d) => d.value), 1);
    const barW = Math.max(8, plotW / items.length - 6);

    ctx.clearRect(0, 0, w, h);
    items.forEach((d, i) => {
      const barH = (d.value / max) * plotH;
      const x = pad.left + i * (barW + 6);
      const y = pad.top + plotH - barH;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 4);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, h - 8);
    });
  }, [items, color, height]);

  if (!items.length) {
    return <p className="muted pax-empty-chart">No platform events in the last 14 days.</p>;
  }

  return <canvas ref={canvasRef} className="ax-mini-chart" style={{ height }} />;
}

function buildInsights(platform, totals) {
  const lines = [];
  const hospitals = platform.hospitals ?? 0;
  const active = platform.activeHospitals ?? 0;
  if (hospitals > 0) {
    lines.push(`${active} of ${hospitals} hospital tenant${hospitals === 1 ? '' : 's'} are active on the platform.`);
  } else {
    lines.push('No hospitals onboarded yet — start from the Hospitals registry.');
  }
  if ((platform.centers ?? 0) > 0) {
    lines.push(`${platform.centers} ICU center${platform.centers === 1 ? '' : 's'} linked across tenants.`);
  }
  if ((platform.clinicalStaff ?? 0) > 0) {
    lines.push(`${platform.clinicalStaff} clinical staff account${platform.clinicalStaff === 1 ? '' : 's'} provisioned hospital-wide.`);
  }
  const adminActions = (totals.platformActions30d ?? 0) + (totals.hospitalActions30d ?? 0);
  if (adminActions > 0) {
    lines.push(`${adminActions} hospital & platform administration action${adminActions === 1 ? '' : 's'} recorded in the last 30 days.`);
  } else {
    lines.push('No hospital or platform admin mutations logged in the last 30 days.');
  }
  return lines;
}

export default function SuperAdminPlatformAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await getPlatformAnalytics());
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const platform = data?.platform || {};
  const insights = useMemo(() => buildInsights(platform, totals), [platform, totals]);

  const adminActions = useMemo(
    () => (data?.topActions || []).filter((row) => !String(row.action).startsWith('LOGIN')),
    [data],
  );

  const categoryRows = data?.byCategory || [];
  const hospitalRows = data?.hospitalActivity || [];

  if (loading && !data) {
    return <div className="ax-page ax-loading">Loading platform analytics…</div>;
  }

  const activePct = platform.hospitals
    ? Math.round(((platform.activeHospitals ?? 0) / platform.hospitals) * 100)
    : 0;

  return (
    <div className="ax-page pax-page">
      <header className="ax-hero pax-hero">
        <div className="ax-hero-text">
          <p className="ax-hero-eyebrow">Super Admin · Platform intelligence</p>
          <h1>Sentra ICU — Multi-tenant operations</h1>
          <p className="ax-hero-sub">
            Hospital adoption, center footprint, staff provisioning, and governance audit — not bedside clinical analytics.
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

      <nav className="pax-tabs" aria-label="Platform analytics sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pax-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <section className="ax-kpi-grid">
            <KpiCard label="Hospitals" value={platform.hospitals ?? 0} unit={`${platform.activeHospitals ?? 0} active`} status="neutral" />
            <KpiCard label="Centers linked" value={platform.centers ?? 0} status="good" />
            <KpiCard label="Clinical staff" value={platform.clinicalStaff ?? 0} status="neutral" />
            <KpiCard label="Platform actions" value={totals.platformActions30d ?? 0} unit="30d" status="warning" />
            <KpiCard label="Hospital admin actions" value={totals.hospitalActions30d ?? 0} unit="30d" status="warning" />
            <KpiCard label="Audit events" value={totals.events30d ?? 0} unit="30d" status="neutral" />
          </section>

          <div className="ax-grid ax-grid--2">
            <section className="ax-panel ax-insights">
              <h2>Platform insights</h2>
              <ul className="ax-insight-list">
                {insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="pax-quick-links">
                <Link to="/" className="pax-quick-link">Hospital registry →</Link>
                <Link to="/audit-logs" className="pax-quick-link">Audit logs →</Link>
                <Link to="/centers-admins" className="pax-quick-link">Centers &amp; admins →</Link>
              </div>
            </section>

            <section className="ax-panel">
              <div className="ax-panel-head">
                <h2>Audit volume</h2>
                <span className="ax-panel-hint">Governance events per day — last 14 days</span>
              </div>
              <TrendChart data={data?.eventsByDay} color="#0a3d62" height={140} />
            </section>
          </div>
        </>
      )}

      {tab === 'tenants' && (
        <>
          <section className="ax-panel ax-gauges">
            <h2>Tenant footprint</h2>
            <div className="ax-gauge-row">
              <RingGauge
                value={platform.activeHospitals ?? 0}
                max={platform.hospitals || 1}
                label="Active hospitals"
                sublabel={`${activePct}% of fleet`}
                tone={activePct < 100 ? 'warning' : 'good'}
              />
              <RingGauge
                value={platform.centers ?? 0}
                max={Math.max(platform.centers ?? 0, platform.hospitals ?? 1)}
                label="Linked centers"
                sublabel="Across tenants"
                tone="primary"
              />
              <RingGauge
                value={platform.clinicalStaff ?? 0}
                max={Math.max(platform.clinicalStaff ?? 0, 10)}
                label="Clinical staff"
                sublabel="Provisioned users"
                tone="accent"
              />
            </div>
          </section>

          <section className="ax-panel">
            <div className="ax-panel-head">
              <h2>Hospital activity ranking</h2>
              <span className="ax-panel-hint">Audit events per hospital — last 30 days</span>
            </div>
            <div className="ax-table-wrap">
              <table className="ax-table">
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Events (30d)</th>
                    <th>Share</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {hospitalRows.length === 0 && (
                    <tr><td colSpan={4} className="muted">No hospital-scoped audit activity in the last 30 days.</td></tr>
                  )}
                  {hospitalRows.map((row) => {
                    const total = hospitalRows.reduce((s, r) => s + r.eventCount, 0) || 1;
                    const pct = Math.round((row.eventCount / total) * 100);
                    return (
                      <tr key={row.hospitalId}>
                        <td><strong>{row.hospitalName}</strong></td>
                        <td>{row.eventCount}</td>
                        <td>
                          <div className="ax-load-bar">
                            <div className="ax-load-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td>
                          <Link to={`/hospitals?hospitalId=${row.hospitalId}`} className="pax-table-link">Open →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'governance' && (
        <div className="ax-grid ax-grid--2">
          <section className="ax-panel">
            <div className="ax-panel-head">
              <h2>Events by category</h2>
              <span className="ax-panel-hint">Last 30 days — AUTH, PLATFORM, HOSPITAL</span>
            </div>
            <div className="ax-table-wrap">
              <table className="ax-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Count</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.length === 0 && (
                    <tr><td colSpan={3} className="muted">No categorized events yet.</td></tr>
                  )}
                  {categoryRows.map((row) => {
                    const total = categoryRows.reduce((s, r) => s + r.count, 0) || 1;
                    const pct = Math.round((row.count / total) * 100);
                    return (
                      <tr key={row.category}>
                        <td><span className={`pax-cat pax-cat--${String(row.category).toLowerCase()}`}>{row.category}</span></td>
                        <td>{row.count}</td>
                        <td>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ax-panel">
            <div className="ax-panel-head">
              <h2>Administration actions</h2>
              <span className="ax-panel-hint">Provisioning &amp; config changes — excludes sign-in noise</span>
            </div>
            <div className="ax-table-wrap">
              <table className="ax-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {adminActions.length === 0 && (
                    <tr><td colSpan={2} className="muted">No administration actions recorded yet.</td></tr>
                  )}
                  {adminActions.map((row) => (
                    <tr key={row.action}>
                      <td className="sa-mono">{row.action}</td>
                      <td><strong>{row.count}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
