import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCenters } from '../api/hospitalAdmin';

function isActiveStatus(status) {
  return String(status || 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function StatusPill({ active }) {
  return (
    <span className={`status-pill ${active ? 'status-pill--vacant' : 'status-pill--occupied'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function HospitalAdminCenters() {
  const navigate = useNavigate();
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCenters(await listCenters());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return centers;
    const q = search.toLowerCase();
    return centers.filter((c) =>
      String(c.centerId || '').toLowerCase().includes(q)
      || String(c.name || '').toLowerCase().includes(q)
      || String(c.location || '').toLowerCase().includes(q));
  }, [centers, search]);

  if (loading) {
    return <div className="empty-state glass-card"><h2>Loading centers…</h2></div>;
  }

  return (
    <div className="order-mgmt">
      {error && <div className="message error">{error}</div>}

      <div className="form-card glass-card sa-table-panel">
        <div className="order-mgmt-head">
          <h3 className="order-mgmt-title">Your centers</h3>
          <span className="muted">{filtered.length} center{filtered.length === 1 ? '' : 's'}</span>
        </div>

        <p className="order-info-banner">
          Click a center to manage users &amp; roles, universal dashboard, analytics, and alarms for that site.
        </p>

        <div className="sa-filter-row sa-filter-row--3 sa-hospitals-filter">
          <div className="sa-filter-field sa-filter-field--grow">
            <label htmlFor="ha-center-search">Search</label>
            <input
              id="ha-center-search"
              type="search"
              placeholder="Center ID, name, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="clinical-table-wrap order-table-wrap">
          <table className="clinical-table order-table sa-platform-table sa-platform-table--hospitals">
            <thead>
              <tr>
                <th>Center ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th className="col-manage">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted order-empty">
                    No centers linked to your hospital yet. Contact platform admin to link Connect Engine centers.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.centerId} className={!isActiveStatus(c.status) ? 'sa-table-row--muted' : ''}>
                  <td className="sa-mono">
                    <button
                      type="button"
                      className="sa-table-link"
                      onClick={() => navigate(`/center/${encodeURIComponent(c.centerId)}/users`)}
                    >
                      {c.centerId}
                    </button>
                  </td>
                  <td>{c.name || '—'}</td>
                  <td>{c.location || '—'}</td>
                  <td><StatusPill active={isActiveStatus(c.status)} /></td>
                  <td className="col-manage">
                    <button
                      type="button"
                      className="sa-table-btn sa-table-btn--manage"
                      onClick={() => navigate(`/center/${encodeURIComponent(c.centerId)}/users`)}
                    >
                      Manage →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
