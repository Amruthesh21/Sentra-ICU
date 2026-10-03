import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createHospital,
  getPlatformOverview,
} from '../api/superAdmin';
import AdminCredentialsModal, { generateTempPassword } from '../components/AdminCredentialsModal';
import SuperAdminHospitalDetail from './SuperAdminHospitalDetail';

const STATUS_OPTIONS = [
  { id: 'all', label: 'Any status' },
  { id: 'active', label: 'Active only' },
  { id: 'inactive', label: 'Inactive only' },
];

const ROLE_LABELS = [
  { key: 'Intensivist', label: 'Intensivists' },
  { key: 'RMO', label: 'RMOs' },
  { key: 'CCN', label: 'CCNs' },
  { key: 'Respiratory Therapist', label: 'Respiratory' },
];

function isActiveStatus(status) {
  return String(status || 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function matchesSearch(text, query) {
  if (!query) return true;
  return String(text || '').toLowerCase().includes(query.toLowerCase());
}

function matchesStatusFilter(active, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return active;
  return !active;
}

function StatusPill({ active }) {
  return (
    <span className={`status-pill ${active ? 'status-pill--vacant' : 'status-pill--occupied'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

const EMPTY_FORM = {
  name: '',
  adminEmail: '',
  adminDisplayName: '',
  adminPassword: '',
  deviceIngestionUrl: '',
};

export default function SuperAdminHospitals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hospitalId = searchParams.get('hospitalId') || '';

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [credentials, setCredentials] = useState(null);

  const refresh = useCallback(async () => {
    setOverview(await getPlatformOverview());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  function openHospital(id) {
    const next = new URLSearchParams(searchParams);
    next.set('hospitalId', id);
    setSearchParams(next);
  }

  function closeHospital() {
    const next = new URLSearchParams(searchParams);
    next.delete('hospitalId');
    setSearchParams(next);
  }

  const hospitals = overview?.hospitals || [];
  const totals = overview?.totals || {};
  const platformRoles = overview?.roleCounts || [];

  const filteredRows = useMemo(() => hospitals.filter((row) => {
    const active = isActiveStatus(row.status);
    if (!matchesStatusFilter(active, statusFilter)) return false;
    if (!search) return true;
    return matchesSearch(row.name, search)
      || matchesSearch(row.code, search)
      || matchesSearch(row.primaryAdmin, search)
      || matchesSearch(row.primaryAdminEmail, search);
  }), [hospitals, search, statusFilter]);

  async function runAction(key, fn, successMsg) {
    setBusyKey(key);
    setMessage(null);
    setError(null);
    try {
      await fn();
      if (successMsg) setMessage(successMsg);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const hospitalName = form.name;
    const adminEmail = form.adminEmail;
    await runAction('create', async () => {
      const result = await createHospital(form);
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      setCredentials({
        email: adminEmail,
        tempPassword: result.tempPassword,
        hospitalName,
      });
      setMessage(`Hospital "${hospitalName}" created. Share the temporary password with the hospital admin.`);
    }, null);
  }

  function openCreateModal() {
    setForm({ ...EMPTY_FORM, adminPassword: generateTempPassword() });
    setCreateOpen(true);
  }

  if (loading && !overview) {
    return <div className="empty-state glass-card"><h2>Loading platform overview…</h2></div>;
  }

  if (hospitalId) {
    return (
      <SuperAdminHospitalDetail
        hospitalId={hospitalId}
        onBack={closeHospital}
      />
    );
  }

  return (
    <div className="platform-admin order-mgmt">
      <div className="sa-stat-row sa-stat-row--4">
        <div className="sa-stat-card">
          <div className="sa-stat-label">Hospitals</div>
          <div className="sa-stat-value">{totals.hospitals ?? 0}</div>
          <div className="sa-stat-sub">{totals.activeHospitals ?? 0} active</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Centers</div>
          <div className="sa-stat-value">{totals.centers ?? 0}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Hospital admins</div>
          <div className="sa-stat-value">{totals.hospitalAdmins ?? 0}</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Clinical staff</div>
          <div className="sa-stat-value">{totals.clinicalStaff ?? 0}</div>
        </div>
      </div>

      <div className="sa-stat-row sa-stat-row--4 sa-stat-row--roles">
        {ROLE_LABELS.map(({ key, label }) => {
          const count = platformRoles.find((r) => r.role === key)?.count ?? 0;
          return (
            <div key={key} className="sa-stat-card sa-stat-card--role">
              <div className="sa-stat-label">{label}</div>
              <div className="sa-stat-value">{count}</div>
            </div>
          );
        })}
      </div>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <div className="form-card glass-card sa-table-panel">
        <div className="order-mgmt-head">
          <div>
            <h3 className="order-mgmt-title">Hospital registry</h3>
            <p className="muted sa-table-sub">Click a hospital or Full info to open the profile page</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            + Add hospital
          </button>
        </div>

        <div className="sa-filter-row sa-filter-row--3 sa-hospitals-filter">
          <div className="sa-filter-field">
            <label htmlFor="hosp-status">Status</label>
            <select
              id="hosp-status"
              className="sa-hospital-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="sa-filter-field sa-filter-field--grow">
            <label htmlFor="hosp-search">Search</label>
            <input
              id="hosp-search"
              type="search"
              placeholder="Hospital, code, admin name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sa-filter-field sa-filter-field--count">
            <span className="muted">{filteredRows.length} hospital{filteredRows.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="clinical-table-wrap order-table-wrap">
          <table className="clinical-table order-table sa-platform-table sa-platform-table--registry">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Hospital</th>
                <th>Admin</th>
                <th>Centers</th>
                <th>Staff</th>
                <th>Status</th>
                <th className="col-manage">Full info</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted order-empty">
                    No hospitals yet — click &quot;+ Add hospital&quot; to onboard your first tenant.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => {
                const active = isActiveStatus(row.status);
                return (
                  <tr key={row.id} className={!active ? 'sa-table-row--muted' : ''}>
                    <td className="sa-mono">{row.sno}</td>
                    <td>
                      <button
                        type="button"
                        className="sa-table-link sa-table-link--block"
                        onClick={() => openHospital(row.id)}
                      >
                        <div className="sa-table-cell-stack">
                          <strong>{row.name}</strong>
                          <span className="muted sa-mono">{row.code}</span>
                        </div>
                      </button>
                    </td>
                    <td>
                      <div className="sa-table-cell-stack">
                        <strong>{row.primaryAdmin || '—'}</strong>
                        <span className="muted">{row.primaryAdminEmail || ''}</span>
                      </div>
                    </td>
                    <td><strong>{row.centerCount ?? 0}</strong></td>
                    <td><strong>{row.userCount ?? 0}</strong></td>
                    <td><StatusPill active={active} /></td>
                    <td className="col-manage">
                      <button
                        type="button"
                        className="sa-table-btn sa-table-btn--manage"
                        onClick={() => openHospital(row.id)}
                      >
                        Full info
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="order-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="order-modal sa-create-hospital-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-head">
              <h3>+ Add hospital</h3>
              <button type="button" className="order-modal-close" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <form className="order-form" onSubmit={handleCreate}>
              <div className="form-group">
                <label><span className="req">*</span> Hospital name</label>
                <input
                  required
                  placeholder="Apollo Hospitals"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label><span className="req">*</span> Hospital admin email</label>
                <input
                  required
                  type="email"
                  placeholder="admin@apollo.com"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Admin display name</label>
                <input
                  placeholder="Apollo Admin"
                  value={form.adminDisplayName}
                  onChange={(e) => setForm({ ...form, adminDisplayName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label><span className="req">*</span> Temporary password</label>
                <div className="sa-password-field-row">
                  <input
                    required
                    type="text"
                    minLength={8}
                    placeholder="Welcome@abc123"
                    value={form.adminPassword}
                    onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setForm({ ...form, adminPassword: generateTempPassword() })}
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Device gateway URL</label>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://gw.hospital.example:9050"
                  value={form.deviceIngestionUrl}
                  onChange={(e) => setForm({ ...form, deviceIngestionUrl: e.target.value })}
                />
                <p className="muted" style={{ marginTop: 6, fontSize: '0.8rem' }}>
                  Origin of this hospital&apos;s on-site device-ingestion service (VPN or private link).
                  Leave blank for a local all-in-one stack.
                </p>
              </div>
              <p className="order-info-banner">
                Give this temporary password to the hospital admin. On first sign-in they use their email and this password, then set username and a new password.
              </p>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busyKey === 'create'}>
                  Create hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminCredentialsModal
        open={Boolean(credentials)}
        email={credentials?.email}
        tempPassword={credentials?.tempPassword}
        hospitalName={credentials?.hospitalName}
        onClose={() => setCredentials(null)}
      />
    </div>
  );
}
