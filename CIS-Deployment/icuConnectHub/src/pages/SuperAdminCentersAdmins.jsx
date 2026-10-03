import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createHospitalAdmin,
  deleteCenter,
  deleteHospital,
  deleteHospitalAdmin,
  linkCenter,
  listCentersAndAdmins,
  listHospitals,
  resetHospitalAdminTempPassword,
  updateCenter,
  updateHospital,
  updateHospitalAdmin,
} from '../api/superAdmin';
import AdminCredentialsModal, { generateTempPassword } from '../components/AdminCredentialsModal';
import { brandCenterLabel } from '../utils/brand';

const STATUS_OPTIONS = [
  { id: 'all', label: 'Any status' },
  { id: 'active', label: 'Active only' },
  { id: 'inactive', label: 'Inactive only' },
];

function matchesSearch(text, query) {
  if (!query) return true;
  return String(text || '').toLowerCase().includes(query.toLowerCase());
}

function isActiveStatus(status) {
  return String(status || 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function matchesStatusFilter(active, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return active;
  return !active;
}

function adminSummary(admins) {
  if (!admins?.length) return '—';
  return admins.map((a) => `${a.displayName} (${a.email})`).join(', ');
}

function buildOverviewRows(hospitals, centers, admins) {
  const adminsByHospital = admins.reduce((acc, a) => {
    if (!acc[a.hospitalId]) acc[a.hospitalId] = [];
    acc[a.hospitalId].push(a);
    return acc;
  }, {});

  const rows = centers.map((c) => ({
    rowKey: `c-${c.hospitalId}-${c.centerId}`,
    hospitalId: c.hospitalId,
    hospitalName: c.hospitalName,
    hospitalCode: c.hospitalCode,
    hospitalStatus: c.hospitalStatus,
    centerId: c.centerId,
    centerName: c.name,
    location: c.location,
    centerStatus: c.status,
    admins: adminsByHospital[c.hospitalId] || [],
    adminLabel: adminSummary(adminsByHospital[c.hospitalId]),
  }));

  hospitals.forEach((h) => {
    const hasCenter = centers.some((c) => c.hospitalId === h.id);
    if (!hasCenter) {
      rows.push({
        rowKey: `h-${h.id}`,
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalCode: h.code,
        hospitalStatus: h.status,
        centerId: null,
        centerName: null,
        location: null,
        centerStatus: null,
        admins: adminsByHospital[h.id] || [],
        adminLabel: adminSummary(adminsByHospital[h.id]),
      });
    }
  });

  return rows.sort((a, b) => {
    const hn = (a.hospitalName || '').localeCompare(b.hospitalName || '');
    if (hn !== 0) return hn;
    return (a.centerId || '').localeCompare(b.centerId || '');
  });
}

function StatusPill({ active, label }) {
  return (
    <span className={`status-pill ${active ? 'status-pill--vacant' : 'status-pill--occupied'}`}>
      {label || (active ? 'Active' : 'Inactive')}
    </span>
  );
}

function TableActions({ onToggle, onDelete, onResetPassword, active, toggleLabel, deleteLabel, busy }) {
  return (
    <div className="sa-table-actions">
      {onResetPassword && (
        <button
          type="button"
          className="sa-table-btn"
          onClick={onResetPassword}
          disabled={busy}
        >
          Reset temp password
        </button>
      )}
      <button
        type="button"
        className={`sa-table-btn${active ? ' sa-table-btn--on' : ''}`}
        onClick={onToggle}
        disabled={busy}
      >
        {toggleLabel || (active ? 'Active' : 'Inactive')}
      </button>
      <button
        type="button"
        className="sa-table-btn sa-table-btn--danger"
        onClick={onDelete}
        disabled={busy}
      >
        {deleteLabel || 'Delete'}
      </button>
    </div>
  );
}

export default function SuperAdminCentersAdmins() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hospitalId = searchParams.get('hospitalId') || '';

  const [hospitals, setHospitals] = useState([]);
  const [centers, setCenters] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [linkForm, setLinkForm] = useState({ centerId: '', centerName: '', centerLocation: '' });
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', displayName: '', password: '' });
  const [credentials, setCredentials] = useState(null);

  const loadAll = useCallback(async () => {
    const [hList, catalog] = await Promise.all([listHospitals(), listCentersAndAdmins()]);
    setHospitals(hList);
    setCenters(catalog.centers || []);
    setAdmins(catalog.admins || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAll]);

  function selectHospital(id) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('hospitalId', id);
    else next.delete('hospitalId');
    setSearchParams(next);
  }

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  async function runAction(key, fn, successMsg) {
    setBusyKey(key);
    setMessage(null);
    setError(null);
    try {
      await fn();
      if (successMsg) setMessage(successMsg);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }

  const overviewRows = useMemo(
    () => buildOverviewRows(hospitals, centers, admins),
    [hospitals, centers, admins],
  );

  const filteredOverviewRows = useMemo(() => overviewRows.filter((row) => {
    if (hospitalId && row.hospitalId !== hospitalId) return false;
    const hospitalActive = isActiveStatus(row.hospitalStatus);
    const centerActive = row.centerId ? isActiveStatus(row.centerStatus) : hospitalActive;
    if (!matchesStatusFilter(centerActive, statusFilter) && !matchesStatusFilter(hospitalActive, statusFilter)) {
      return false;
    }
    if (!search) return true;
    return matchesSearch(row.hospitalName, search)
      || matchesSearch(row.hospitalCode, search)
      || matchesSearch(row.centerId, search)
      || matchesSearch(row.centerName, search)
      || matchesSearch(row.location, search)
      || matchesSearch(row.adminLabel, search);
  }), [overviewRows, hospitalId, search, statusFilter]);

  const hospitalAdmins = useMemo(() => admins.filter((a) => {
    if (hospitalId && a.hospitalId !== hospitalId) return false;
    if (!matchesStatusFilter(!!a.active, statusFilter)) return false;
    if (!search) return true;
    return matchesSearch(a.displayName, search) || matchesSearch(a.email, search);
  }), [admins, hospitalId, search, statusFilter]);

  async function handleLinkCenter(e) {
    e.preventDefault();
    if (!hospitalId) {
      setError('Select a hospital first to link a center');
      return;
    }
    await runAction('link', async () => {
      await linkCenter(hospitalId, linkForm);
      setLinkForm({ centerId: '', centerName: '', centerLocation: '' });
    }, `Center ${linkForm.centerId} linked`);
  }

  async function handleAddAdmin(e) {
    e.preventDefault();
    if (!hospitalId) return;
    const adminEmail = adminForm.email;
    await runAction('add-admin', async () => {
      const result = await createHospitalAdmin(hospitalId, adminForm);
      setAdminForm({ email: '', displayName: '', password: '' });
      setAdminModalOpen(false);
      setCredentials({
        email: adminEmail,
        tempPassword: result.tempPassword,
        hospitalName: selectedHospital?.name,
      });
    }, 'Hospital admin created. Share the temporary password.');
  }

  function openAdminModal() {
    setAdminForm({ email: '', displayName: '', password: generateTempPassword() });
    setAdminModalOpen(true);
  }

  async function handleResetAdminPassword(admin) {
    const key = `reset-${admin.id}`;
    await runAction(key, async () => {
      const result = await resetHospitalAdminTempPassword(admin.hospitalId, admin.id, {});
      setCredentials({
        email: admin.email,
        tempPassword: result.tempPassword,
        hospitalName: admin.hospitalName || selectedHospital?.name,
      });
    }, 'Temporary password reset.');
  }

  if (loading) {
    return <div className="empty-state glass-card"><h2>Loading…</h2></div>;
  }

  const hospitalActive = selectedHospital ? isActiveStatus(selectedHospital.status) : true;
  const detailMode = !!hospitalId && selectedHospital;

  return (
    <div className="platform-admin sa-centers-admins-page order-mgmt">
      <div className="form-card glass-card sa-filter-bar">
        <div className="sa-filter-row sa-filter-row--3">
          <div className="sa-filter-field">
            <label htmlFor="sa-hospital-select">Hospital</label>
            <select
              id="sa-hospital-select"
              className="sa-hospital-select"
              value={hospitalId}
              onChange={(e) => selectHospital(e.target.value)}
            >
              <option value="">All hospitals</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code}){!isActiveStatus(h.status) ? ' — Inactive' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="sa-filter-field">
            <label htmlFor="sa-status-select">Status</label>
            <select
              id="sa-status-select"
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
            <label htmlFor="sa-search">Search</label>
            <input
              id="sa-search"
              type="search"
              placeholder="Hospital, center, admin email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {detailMode && (
        <div className="sa-detail-toolbar">
          <button type="button" className="sa-back-link" onClick={() => selectHospital('')}>
            ← All hospitals
          </button>
          <div className={`sa-hospital-banner sa-hospital-banner--inline${hospitalActive ? '' : ' sa-hospital-banner--inactive'}`}>
            <div>
              <strong>{selectedHospital.name}</strong>
              <span className="muted"> · {selectedHospital.code}</span>
            </div>
            <TableActions
              active={hospitalActive}
              busy={busyKey === `hospital-${hospitalId}`}
              onToggle={() => runAction(
                `hospital-${hospitalId}`,
                () => updateHospital(hospitalId, { status: hospitalActive ? 'INACTIVE' : 'ACTIVE' }),
                `Hospital ${hospitalActive ? 'deactivated' : 'activated'}`,
              )}
              onDelete={() => {
                if (!window.confirm(`Deactivate hospital "${selectedHospital.name}"?`)) return;
                runAction(
                  `hospital-del-${hospitalId}`,
                  async () => {
                    await deleteHospital(hospitalId);
                    selectHospital('');
                  },
                  'Hospital deactivated',
                );
              }}
            />
          </div>
        </div>
      )}

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <div className="form-card glass-card sa-table-panel">
        <div className="order-mgmt-head">
          <h3 className="order-mgmt-title">
            {detailMode ? 'Centers & linkage' : 'All hospitals — centers & admins'}
          </h3>
          <span className="muted">{filteredOverviewRows.length} rows</span>
        </div>

        <div className="clinical-table-wrap order-table-wrap">
          <table className="clinical-table order-table sa-platform-table sa-platform-table--centers">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Center</th>
                <th>Location</th>
                <th>Hospital Admin</th>
                <th>Hosp. status</th>
                <th>Center status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOverviewRows.length === 0 && (
                <tr><td colSpan={7} className="muted order-empty">No records match your filters.</td></tr>
              )}
              {filteredOverviewRows.map((row) => {
                const centerActive = row.centerId ? isActiveStatus(row.centerStatus) : null;
                const hospActive = isActiveStatus(row.hospitalStatus);
                const key = row.rowKey;
                return (
                  <tr key={key} className={!hospActive || (centerActive === false) ? 'sa-table-row--muted' : ''}>
                    <td>
                      <button
                        type="button"
                        className="sa-table-link sa-table-link--block"
                        onClick={() => row.hospitalId && selectHospital(row.hospitalId)}
                      >
                        <div className="sa-table-cell-stack">
                          <strong>{row.hospitalName || '—'}</strong>
                          <span className="muted sa-mono">{row.hospitalCode || '—'}</span>
                        </div>
                      </button>
                    </td>
                    <td>
                      <div className="sa-table-cell-stack">
                        <strong>{row.centerId ? brandCenterLabel(row.centerName || row.centerId) : '—'}</strong>
                      </div>
                    </td>
                    <td>{row.location || '—'}</td>
                    <td>
                      {row.admins?.length ? row.admins.map((admin) => (
                        <div key={admin.id || admin.email} className="sa-table-cell-stack">
                          <strong>{admin.displayName || '—'}</strong>
                          <span className="muted">{admin.email}</span>
                        </div>
                      )) : '—'}
                    </td>
                    <td><StatusPill active={hospActive} /></td>
                    <td>
                      {row.centerId ? <StatusPill active={centerActive} /> : <span className="muted">—</span>}
                    </td>
                    <td className="col-actions">
                      {row.hospitalId && (
                        <TableActions
                          active={centerActive ?? hospActive}
                          busy={busyKey === key}
                          onToggle={() => {
                            if (row.centerId) {
                              runAction(
                                key,
                                () => updateCenter(row.hospitalId, row.centerId, {
                                  status: centerActive ? 'INACTIVE' : 'ACTIVE',
                                }),
                                `Center ${row.centerId} updated`,
                              );
                            } else {
                              runAction(
                                key,
                                () => updateHospital(row.hospitalId, {
                                  status: hospActive ? 'INACTIVE' : 'ACTIVE',
                                }),
                                `Hospital ${row.hospitalName} updated`,
                              );
                            }
                          }}
                          onDelete={() => {
                            if (row.centerId) {
                              if (!window.confirm(`Delete center "${row.centerId}"?`)) return;
                              runAction(
                                `${key}-del`,
                                () => deleteCenter(row.hospitalId, row.centerId),
                                `Center ${row.centerId} removed`,
                              );
                            } else if (window.confirm(`Deactivate hospital "${row.hospitalName}"?`)) {
                              runAction(
                                `${key}-del`,
                                () => deleteHospital(row.hospitalId),
                                'Hospital deactivated',
                              );
                            }
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailMode && hospitalActive && (
        <div className="form-card glass-card sa-table-panel sa-link-toolbar">
          <h4 className="sa-subheading">Link new center</h4>
          <form className="sa-link-inline-form" onSubmit={handleLinkCenter}>
            <input
              required
              placeholder="Center ID *"
              value={linkForm.centerId}
              onChange={(e) => setLinkForm({ ...linkForm, centerId: e.target.value.toUpperCase() })}
            />
            <input
              placeholder="Center name"
              value={linkForm.centerName}
              onChange={(e) => setLinkForm({ ...linkForm, centerName: e.target.value })}
            />
            <input
              placeholder="Location"
              value={linkForm.centerLocation}
              onChange={(e) => setLinkForm({ ...linkForm, centerLocation: e.target.value })}
            />
            <button type="submit" className="btn btn-primary" disabled={busyKey === 'link'}>
              Link center
            </button>
          </form>
        </div>
      )}

      {(detailMode || hospitalAdmins.length > 0) && (
        <div className="form-card glass-card sa-table-panel">
          <div className="order-mgmt-head">
            <h3 className="order-mgmt-title">Hospital admins</h3>
            {detailMode && hospitalActive && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openAdminModal}
              >
                + Add admin
              </button>
            )}
          </div>
          <p className="order-info-banner">
            Inactive admins cannot sign in or create hospital users. Additional admins get the same controls.
          </p>
          <div className="clinical-table-wrap order-table-wrap">
            <table className="clinical-table order-table sa-platform-table sa-platform-table--admins">
              <thead>
                <tr>
                  {!detailMode && <th>Hospital</th>}
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitalAdmins.length === 0 && (
                  <tr>
                    <td colSpan={detailMode ? 4 : 5} className="muted order-empty">
                      No hospital admins yet.
                      {detailMode && hospitalActive ? ' Click "+ Add admin" to create one.' : ''}
                    </td>
                  </tr>
                )}
                {hospitalAdmins.map((a) => {
                  const key = `admin-${a.id}`;
                  return (
                    <tr key={a.id} className={!a.active ? 'sa-table-row--muted' : ''}>
                      {!detailMode && (
                        <td>
                          <button
                            type="button"
                            className="sa-table-link"
                            onClick={() => selectHospital(a.hospitalId)}
                          >
                            {a.hospitalName}
                          </button>
                        </td>
                      )}
                      <td>{a.displayName}</td>
                      <td>{a.email}</td>
                      <td><StatusPill active={!!a.active} /></td>
                      <td className="col-actions">
                        <TableActions
                          active={!!a.active}
                          busy={busyKey === key || busyKey === `reset-${a.id}`}
                          onResetPassword={() => handleResetAdminPassword(a)}
                          onToggle={() => runAction(
                            key,
                            () => updateHospitalAdmin(a.hospitalId, a.id, { active: !a.active }),
                            `${a.displayName} updated`,
                          )}
                          onDelete={() => {
                            if (!window.confirm(`Delete admin "${a.displayName}"?`)) return;
                            runAction(
                              `${key}-del`,
                              () => deleteHospitalAdmin(a.hospitalId, a.id),
                              `Admin ${a.displayName} deleted`,
                            );
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminModalOpen && (
        <div className="order-modal-overlay" onClick={() => setAdminModalOpen(false)}>
          <div className="order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-head">
              <h3>+ Add hospital admin</h3>
              <button type="button" className="order-modal-close" onClick={() => setAdminModalOpen(false)}>×</button>
            </div>
            <form className="order-form" onSubmit={handleAddAdmin}>
              <div className="form-group">
                <label><span className="req">*</span> Email</label>
                <input
                  required
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="admin@hospital.com"
                />
              </div>
              <div className="form-group">
                <label>Display name</label>
                <input
                  value={adminForm.displayName}
                  onChange={(e) => setAdminForm({ ...adminForm, displayName: e.target.value })}
                  placeholder="Hospital Admin"
                />
              </div>
              <div className="form-group">
                <label><span className="req">*</span> Temporary password</label>
                <div className="sa-password-field-row">
                  <input
                    required
                    type="text"
                    minLength={8}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    placeholder="Welcome@abc123"
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setAdminForm({ ...adminForm, password: generateTempPassword() })}
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setAdminModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busyKey === 'add-admin'}>
                  Create admin
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
