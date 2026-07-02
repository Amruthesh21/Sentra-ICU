import { useMemo } from 'react';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function cell(value) {
  if (value == null || String(value).trim() === '') return '—';
  return value;
}

export default function AuditLogMiniTable({ logs = [], loading, emptyMessage = 'No audit events for this hospital yet.' }) {
  const rows = useMemo(() => (Array.isArray(logs) ? logs.slice(0, 12) : []), [logs]);

  if (loading) {
    return <p className="muted sa-detail-audit-loading">Loading audit events…</p>;
  }

  if (!rows.length) {
    return <p className="muted sa-detail-audit-empty">{emptyMessage}</p>;
  }

  return (
    <div className="sa-audit-embedded">
      <div className="sa-audit-embedded-head" aria-hidden="true">
        <span>When</span>
        <span>Actor</span>
        <span>Hospital</span>
        <span>Detail</span>
        <span>IP</span>
      </div>
      <ul className="sa-audit-embedded-list">
        {rows.map((row) => {
          const name = row.actorName?.trim();
          const email = row.actorEmail?.trim();
          return (
            <li key={row.id} className="sa-audit-embedded-row">
              <div className="sa-audit-embedded-cell sa-audit-embedded-cell--when">
                <span className="sa-audit-embedded-label">When</span>
                <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
              </div>
              <div className="sa-audit-embedded-cell sa-audit-embedded-cell--actor">
                <span className="sa-audit-embedded-label">Actor</span>
                {name || email ? (
                  <>
                    <strong>{name || email}</strong>
                    {name && email && <span className="muted sa-audit-embedded-email">{email}</span>}
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
              <div className="sa-audit-embedded-cell sa-audit-embedded-cell--hospital">
                <span className="sa-audit-embedded-label">Hospital</span>
                <span>{cell(row.hospitalName)}</span>
              </div>
              <div className="sa-audit-embedded-cell sa-audit-embedded-cell--detail">
                <span className="sa-audit-embedded-label">Detail</span>
                <span>{cell(row.detail)}</span>
              </div>
              <div className="sa-audit-embedded-cell sa-audit-embedded-cell--ip">
                <span className="sa-audit-embedded-label">IP</span>
                <span className="sa-mono">{cell(row.ipAddress)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
