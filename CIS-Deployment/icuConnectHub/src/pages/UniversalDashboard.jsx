import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHospitalOverview } from '../api/overview';
import { acknowledgeAlarm } from '../api/hub';
import { BRAND_NAME, brandCenterLabel } from '../utils/brand';

function timeAgo(iso) {
  if (!iso) return '';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function riskMeta(level) {
  if (level === 'HIGH') return { label: 'High Risk', className: 'is-high' };
  if (level === 'MODERATE') return { label: 'Moderate Risk', className: 'is-moderate' };
  return { label: 'Low Risk', className: 'is-low' };
}

function SummaryCard({ tone, title, value, detail, linkTo, linkLabel }) {
  return (
    <div className={`ud-summary-card ud-summary-card--${tone}`}>
      <div className="ud-summary-top">
        <span className="ud-summary-title">{title}</span>
        <span className="ud-summary-value">{value}</span>
      </div>
      <p className="ud-summary-detail">{detail}</p>
      {linkTo && <Link to={linkTo} className="ud-summary-link">{linkLabel}</Link>}
    </div>
  );
}

function UnitCard({ unit, centerName, lastUpdated, readOnly }) {
  const risk = riskMeta(unit.riskLevel);
  const pct = unit.occupancyPct ?? 0;
  const title = unit.code || unit.name;

  const inner = (
    <>
      <div className="ud-unit-head">
        <div>
          <h4 className="ud-unit-code">{title}</h4>
          <p className="ud-unit-block">{centerName}</p>
        </div>
        <span className={`ud-risk-badge ${risk.className}`}>
          <span className="ud-risk-dot" /> {risk.label}
        </span>
      </div>

      <div className="ud-occupancy">
        <div className="ud-occupancy-labels">
          <span>Bed occupancy</span>
          <strong>{unit.occupiedCount} / {unit.bedCount} ({pct}%)</strong>
        </div>
        <div className="ud-occupancy-bar">
          <div className="ud-occupancy-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {unit.staffStrained && (
        <div className="ud-staff-strained">Staff strained : {unit.staffRatio}</div>
      )}

      <div className="ud-unit-metrics">
        <div><span className="metric-critical">{unit.criticalCount}</span><small>Critical</small></div>
        <div><span className="metric-warning">{unit.warningCount}</span><small>Warning</small></div>
        <div><span className="metric-vent">{unit.ventilatorCount}</span><small>Ventilator</small></div>
        <div><span className="metric-infusion">{unit.infusionCount}</span><small>Infusion</small></div>
      </div>

      <div className="ud-unit-footer">Updated {lastUpdated}</div>
    </>
  );

  if (readOnly) {
    return <div className="ud-unit-card ud-unit-card--static">{inner}</div>;
  }

  return (
    <Link to={`/overview`} className="ud-unit-card">
      {inner}
    </Link>
  );
}

export default function UniversalDashboard({ centerId, compact = false, hospitalAdmin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [acking, setAcking] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getHospitalOverview());
      setError(null);
      setLastRefresh(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleAcknowledgeAll() {
    if (!data?.activeAlarms?.length) return;
    setAcking(true);
    try {
      await Promise.all(
        data.activeAlarms.map((a) => acknowledgeAlarm({
          bedId: a.bedId,
          paramName: a.paramName,
          threshold: a.threshold,
          currentValue: a.currentValue,
        })),
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAcking(false);
    }
  }

  if (loading && !data) {
    return <div className="empty-state"><h2>Loading hospital overview…</h2></div>;
  }

  if (error && !data) {
    return (
      <div className="empty-state glass-card" style={{ maxWidth: 640, margin: '1.5rem auto' }}>
        <h2>Hospital overview unavailable</h2>
        <p className="muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
          {error}
        </p>
        <p className="muted" style={{ marginTop: 12, lineHeight: 1.55 }}>
          Create ICU units and beds under Administration (when available), or connect hospital live/history
          data from the <Link to="/connectivity">Connectivity</Link> tab (HL7 / FHIR / adapters).
          This Hub no longer depends on Connect Engine.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Link to="/connectivity" className="btn btn-primary">Open Connectivity</Link>
          <Link to="/overview" className="btn btn-outline">Overview</Link>
          <button type="button" className="btn btn-outline" onClick={() => { setLoading(true); load(); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totals = data?.totals || {};
  const blocks = data?.blocks || [];
  const center = data?.center
    ? { ...data.center, displayName: brandCenterLabel(data.center.displayName, data.center.centerName) }
    : { displayName: BRAND_NAME };
  const deteriorating = data?.deterioratingPatients || [];
  const alarms = data?.activeAlarms || [];
  const unitCount = data?.unitCount ?? blocks.reduce((n, b) => n + (b.units?.length || 0), 0);
  const secondsSince = Math.max(1, Math.floor((Date.now() - lastRefresh) / 1000));
  const visibleBlocks = blocks.filter((b) => b.blockName !== 'General' || (b.units?.length > 0));
  const allUnits = visibleBlocks.flatMap((block) => (block.units || []).map((unit) => ({
    ...unit,
    blockName: block.blockName,
  })));

  return (
    <div className={`universal-dashboard${hospitalAdmin ? ' universal-dashboard--ha' : ''}${compact && !hospitalAdmin ? ' ha-embed' : ''}`}>
      <div className="universal-main">
        {!hospitalAdmin && !compact && <h2 className="ud-page-title">Universal Dashboard</h2>}

        {(!compact || hospitalAdmin) && (
        <div className="ud-summary-row">
          <SummaryCard
            tone="critical"
            title="Patients — immediate"
            value={totals.ventilatedCount ?? 0}
            detail="Ventilated patients across all ICUs"
            linkTo={hospitalAdmin ? '/analytics' : '/overview'}
            linkLabel={hospitalAdmin ? 'View analytics →' : 'View patients →'}
          />
          <SummaryCard
            tone="alarm"
            title="Active alarms"
            value={totals.activeAlarmCount ?? 0}
            detail={`${totals.physiologicalAlarmCount ?? 0} physiological · ${totals.deviceAlarmCount ?? 0} device`}
            linkTo="/alerts"
            linkLabel="Open alarm center →"
          />
        </div>
        )}

        <section className="ud-center-panel glass-card">
          <div className="ud-center-head">
            <h3>{center.displayName}</h3>
            <span className="muted">{unitCount} unit{unitCount !== 1 ? 's' : ''}</span>
          </div>

          {visibleBlocks.length === 0 ? (
            <div className="ud-empty-block">
              <p>
                No ICU units configured yet. Connect hospital live/history from{' '}
                <Link to="/connectivity">Connectivity</Link>
                {' '}(HL7 / FHIR / adapters), or create units under Administration when available.
              </p>
            </div>
          ) : hospitalAdmin ? (
            <div className="ud-ha-unit-grid">
              {allUnits.map((unit) => (
                <UnitCard
                  key={unit.unitId}
                  unit={unit}
                  centerName={unit.blockName !== 'General' ? unit.blockName : center.displayName}
                  lastUpdated={`${secondsSince}s ago`}
                  readOnly
                />
              ))}
            </div>
          ) : (
            <div className="ud-blocks-row">
              {visibleBlocks.map((block) => (
                <div key={block.blockName} className="ud-block-column">
                  {block.blockName !== 'General' && (
                    <h4 className="ud-block-label">{block.blockName}</h4>
                  )}
                  <div className="ud-unit-grid">
                    {(block.units || []).map((unit) => (
                      <UnitCard
                        key={unit.unitId}
                        unit={unit}
                        centerName={center.displayName}
                        lastUpdated={`${secondsSince}s ago`}
                        readOnly={hospitalAdmin}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ud-deteriorating glass-card">
          <div className="ud-block-head">
            <h3>Critical &amp; Deteriorating Patients</h3>
            <span className="muted">sorted by severity</span>
          </div>
          {deteriorating.length === 0 ? (
            <p className="ud-deteriorating-empty">No active alarms — all beds within normal range.</p>
          ) : (
            <div className="clinical-table-wrap">
            <table className="clinical-table ud-deteriorating-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>MRN</th>
                  <th>Unit</th>
                  <th>Bed</th>
                  <th>Alert</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {deteriorating.map((p) => (
                  <tr key={p.bedLabel}>
                    <td>{p.patientName || '—'}</td>
                    <td>{p.patientMRN || '—'}</td>
                    <td>{p.unitCode || '—'}</td>
                    <td>
                      {hospitalAdmin ? (p.bedLabel) : (
                        <Link to={`/bed/${p.bedLabel}`}>{p.bedLabel}</Link>
                      )}
                    </td>
                    <td>{p.topAlarm}</td>
                    <td>
                      <span className={`ud-severity ud-severity--${p.severity}`}>{p.severity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>

        {hospitalAdmin && alarms.length > 0 && (
        <section className="ud-ha-alert-strip glass-card">
          <div className="ud-block-head">
            <h3>Live alarm feed</h3>
            <Link to="/alerts" className="ud-summary-link">Open alerts →</Link>
          </div>
          <div className="ud-ha-alert-grid">
            {alarms.slice(0, 6).map((a, idx) => (
              <div key={`${a.bedId}-${a.paramName}-${idx}`} className="ud-ha-alert-item">
                <strong>{a.title || a.paramName}</strong>
                <span>{a.bedLabel} · {a.alarmType}</span>
                <small>{timeAgo(a.timestamp)}</small>
              </div>
            ))}
          </div>
        </section>
        )}
      </div>

      {!compact && !hospitalAdmin && (
      <aside className="alert-center">
        <button
          type="button"
          className="btn btn-outline btn-sm alert-ack-all"
          disabled={!alarms.length || acking}
          onClick={handleAcknowledgeAll}
        >
          {acking ? 'Acknowledging…' : 'Acknowledge All'}
        </button>

        <div className="alert-quick-stats">
          <div className="alert-stat alert-stat--critical">
            <span>Critical Alarms</span>
            <strong>{totals.criticalCount ?? 0}</strong>
          </div>
          <div className="alert-stat alert-stat--vent">
            <span>Ventilated</span>
            <strong>{totals.ventilatedCount ?? 0}</strong>
          </div>
        </div>

        <div className="alert-center-head">
          <h3>Alert Center</h3>
          <p>{alarms.length} active · {alarms.filter((a) => !a.acknowledged).length} unacknowledged</p>
        </div>

        <div className="alert-feed">
          {alarms.length === 0 && (
            <p className="muted alert-feed-empty">No active alarms hospital-wide.</p>
          )}
          {alarms.map((a, idx) => (
            <div key={`${a.bedId}-${a.paramName}-${idx}`} className="alert-feed-item">
              <div className="alert-feed-title">{a.title || a.paramName}</div>
              <div className="alert-feed-meta">
                {a.bedLabel} · {a.alarmType}
              </div>
              <div className="alert-feed-time">{timeAgo(a.timestamp)}</div>
            </div>
          ))}
        </div>
      </aside>
      )}
    </div>
  );
}
