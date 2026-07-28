/**
 * Overview KPI strip with calm “liquid level” fills.
 * Suitable for clinical UI: purposeful magnitude cue, soft status colors,
 * slow surface motion, respects prefers-reduced-motion.
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function levelPatients(patients, bedCount) {
  const beds = Math.max(1, bedCount || 12);
  return clamp(Math.round((patients / beds) * 100), 0, 100);
}

function levelCritical(critical, patients) {
  if (!patients) return critical > 0 ? 100 : 0;
  return clamp(Math.round((critical / patients) * 100), 0, 100);
}

function levelAlerts(activeAlerts) {
  // Soft scale: ~8 active alerts ≈ full (busy ward), never theatrical
  return clamp(Math.round((activeAlerts / 8) * 100), 0, 100);
}

function KpiCell({ label, value, tone, level, valueClass }) {
  return (
    <div
      className={`pulse-kpi pulse-kpi--liquid pulse-kpi--${tone}`}
      style={{ '--kpi-level': `${clamp(level, 0, 100)}%` }}
    >
      <div className="pulse-kpi-liquid" aria-hidden="true">
        <div className="pulse-kpi-liquid-fill" />
        <div className="pulse-kpi-liquid-surface" />
      </div>
      <div className="pulse-kpi-content">
        <div className="pulse-kpi-label">{label}</div>
        <div className={`pulse-kpi-value${valueClass ? ` ${valueClass}` : ''}`}>{value}</div>
      </div>
    </div>
  );
}

export default function PulseKpiStrip({ stats }) {
  const patients = stats?.patients ?? 0;
  const critical = stats?.critical ?? 0;
  const occupancy = stats?.occupancy ?? 0;
  const activeAlerts = stats?.activeAlerts ?? 0;
  const bedCount = stats?.bedCount ?? 0;

  return (
    <div className="pulse-kpis pulse-kpis--liquid" role="group" aria-label="Ward summary">
      <KpiCell
        label="Patients"
        value={patients}
        tone="patients"
        level={levelPatients(patients, bedCount)}
      />
      <KpiCell
        label="Critical"
        value={critical}
        tone="critical"
        level={levelCritical(critical, patients)}
        valueClass="is-critical"
      />
      <KpiCell
        label="Occupancy"
        value={`${occupancy}%`}
        tone="occupancy"
        level={clamp(occupancy, 0, 100)}
      />
      <KpiCell
        label="Active Alerts"
        value={activeAlerts}
        tone="alerts"
        level={levelAlerts(activeAlerts)}
        valueClass="is-warn"
      />
    </div>
  );
}
