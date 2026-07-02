import { useMemo, useState } from 'react';

const CATEGORY_OPTIONS = [
  { id: 'ALL', label: 'All categories' },
  { id: 'AUTH', label: 'Authentication' },
  { id: 'PLATFORM', label: 'Platform admin' },
  { id: 'HOSPITAL', label: 'Hospital admin' },
];

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function cell(value) {
  if (value == null || String(value).trim() === '') return '—';
  return value;
}

function actorCell(row) {
  const name = row.actorName?.trim();
  const email = row.actorEmail?.trim();
  if (!name && !email) return <span className="muted">—</span>;
  return (
    <div className="sa-audit-actor">
      <strong>{name || email}</strong>
      {name && email && <span className="muted sa-audit-actor-email">{email}</span>}
    </div>
  );
}

function categoryClass(category) {
  const c = String(category || '').toUpperCase();
  if (c === 'AUTH') return 'sa-audit-cat sa-audit-cat--auth';
  if (c === 'PLATFORM') return 'sa-audit-cat sa-audit-cat--platform';
  if (c === 'HOSPITAL') return 'sa-audit-cat sa-audit-cat--hospital';
  return 'sa-audit-cat';
}

export default function AuditLogViewer({
  logs = [],
  loading,
  error,
  showHospitalColumn = false,
  category,
  onCategoryChange,
  search,
  onSearchChange,
  onRefresh,
  title = 'Audit trail',
  subtitle,
}) {
  const [localSearch, setLocalSearch] = useState(search || '');
  const query = onSearchChange ? search : localSearch;
  const setQuery = onSearchChange || setLocalSearch;

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((row) => {
      const hay = [
        row.action,
        row.detail,
        row.actorEmail,
        row.actorName,
        row.hospitalName,
        row.category,
        row.ipAddress,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [logs, query]);

  const colSpan = showHospitalColumn ? 7 : 6;

  return (
    <div className="sa-audit-page">
      <div className="sa-audit-head">
        <div>
          <h2 className="sa-audit-title">{title}</h2>
          {subtitle && <p className="sa-audit-sub">{subtitle}</p>}
        </div>
        {onRefresh && (
          <button type="button" className="btn btn-primary sa-audit-refresh" onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>

      <div className="sa-audit-filters glass-card">
        {onCategoryChange && (
          <div className="sa-filter-field">
            <label htmlFor="audit-category">Category</label>
            <select
              id="audit-category"
              value={category || 'ALL'}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="sa-filter-field sa-filter-field--grow">
          <label htmlFor="audit-search">Search</label>
          <input
            id="audit-search"
            type="search"
            placeholder="Action, actor, detail, IP…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sa-filter-field sa-filter-field--count">
          <span className="muted">{filtered.length} event{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="form-card glass-card sa-audit-table-panel">
        {loading ? (
          <div className="empty-state"><p>Loading audit events…</p></div>
        ) : (
          <div className="sa-audit-scroll-wrap">
            <table className="sa-audit-table sa-audit-table--full">
              <thead>
                <tr>
                  <th className="sa-audit-col-when">When</th>
                  <th className="sa-audit-col-cat">Category</th>
                  <th className="sa-audit-col-action">Action</th>
                  <th className="sa-audit-col-actor">Actor</th>
                  {showHospitalColumn && <th className="sa-audit-col-hospital">Hospital</th>}
                  <th className="sa-audit-col-detail">Detail</th>
                  <th className="sa-audit-col-ip">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="muted sa-audit-empty-row">
                      No audit events match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="sa-audit-col-when">{formatWhen(row.createdAt)}</td>
                    <td className="sa-audit-col-cat">
                      <span className={categoryClass(row.category)}>{cell(row.category)}</span>
                    </td>
                    <td className="sa-audit-col-action sa-mono">{cell(row.action)}</td>
                    <td className="sa-audit-col-actor">{actorCell(row)}</td>
                    {showHospitalColumn && (
                      <td className="sa-audit-col-hospital">{cell(row.hospitalName)}</td>
                    )}
                    <td className="sa-audit-col-detail">{cell(row.detail)}</td>
                    <td className="sa-audit-col-ip sa-mono">{cell(row.ipAddress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
