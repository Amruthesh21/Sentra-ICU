import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteHospital,
  getHospital,
  listAuditLogs,
  resetHospitalAdminTempPassword,
  updateHospital,
} from '../api/superAdmin';
import AdminCredentialsModal from '../components/AdminCredentialsModal';
import AuditLogViewer from '../components/AuditLogViewer';

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

function RoleChip({ label, count }) {
  if (!count) return null;
  return (
    <span className="sa-role-chip">
      <span className="sa-role-chip-label">{label}</span>
      <strong>{count}</strong>
    </span>
  );
}

export default function SuperAdminHospitalDetail({ hospitalId, onBack }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const refresh = useCallback(async () => {
    const [hospital, audit] = await Promise.all([
      getHospital(hospitalId),
      listAuditLogs({ hospitalId, limit: 100 }),
    ]);
    setDetail(hospital);
    setAuditLogs(Array.isArray(audit) ? audit : []);
  }, [hospitalId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAuditLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setAuditLoading(false);
      }
    })();
  }, [refresh]);

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

  if (loading && !detail) {
    return <div className="empty-state glass-card"><h2>Loading hospital profile…</h2></div>;
  }

  if (!detail) {
    return (
      <div className="platform-admin">
        <div className="message error">{error || 'Hospital not found'}</div>
        <button type="button" className="sa-back-link" onClick={onBack}>← Back to hospitals</button>
      </div>
    );
  }

  const active = isActiveStatus(detail.status);

  return (
    <div className="platform-admin sa-hospital-detail-page">
      <div className="sa-detail-toolbar">
        <button type="button" className="sa-back-link" onClick={onBack}>
          ← All hospitals
        </button>
      </div>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <div className="form-card glass-card sa-hospital-detail-hero-card">
        <div className="sa-hospital-detail-hero">
          <div className="sa-hospital-detail-hero-left">
            <h2 className="sa-hospital-detail-name">{detail.name}</h2>
            <p className="sa-mono muted sa-detail-code">{detail.code}</p>
            <StatusPill active={active} />
            <p className="muted sa-detail-tagline">
              {detail.centerCount ?? 0} centers · {detail.userCount ?? 0} staff · {detail.admins?.length ?? 0} admins
            </p>
          </div>
          <div className="sa-hospital-detail-kpis">
            <div><span>Centers</span><strong>{detail.centerCount ?? 0}</strong></div>
            <div><span>Staff</span><strong>{detail.userCount ?? 0}</strong></div>
            <div><span>Admins</span><strong>{detail.admins?.length ?? 0}</strong></div>
          </div>
        </div>

        <div className="sa-hospital-detail-actions sa-hospital-detail-actions--hero">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(`/centers-admins?hospitalId=${detail.id}`)}
          >
            Manage centers &amp; admins
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => navigate(`/audit-logs?hospitalId=${detail.id}`)}
          >
            Full audit log
          </button>
          <button
            type="button"
            className={`sa-table-btn${active ? ' sa-table-btn--on' : ''}`}
            disabled={busyKey === detail.id}
            onClick={() => runAction(
              detail.id,
              () => updateHospital(detail.id, { status: active ? 'INACTIVE' : 'ACTIVE' }),
              `Hospital ${detail.name} updated`,
            )}
          >
            {active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="sa-table-btn sa-table-btn--danger"
            disabled={busyKey === `${detail.id}-del`}
            onClick={() => {
              if (!window.confirm(`Deactivate hospital "${detail.name}"?`)) return;
              runAction(
                `${detail.id}-del`,
                async () => {
                  await deleteHospital(detail.id);
                  onBack();
                },
                `Hospital ${detail.name} deactivated`,
              );
            }}
          >
            Deactivate hospital
          </button>
        </div>
      </div>

      <div className="sa-hospital-detail-grid sa-hospital-detail-grid--page">
        <section className="sa-detail-section">
          <h4>Staff by role</h4>
          <div className="sa-role-chip-row sa-role-chip-row--wrap">
            {Object.entries(detail.roleCounts || {}).map(([role, count]) => (
              <RoleChip key={role} label={role} count={count} />
            ))}
            {!Object.keys(detail.roleCounts || {}).length && <p className="muted">No clinical users yet.</p>}
          </div>
        </section>
        <section className="sa-detail-section">
          <h4>Hospital admins</h4>
          <ul className="sa-detail-list sa-detail-list--admins">
            {(detail.admins || []).map((a) => (
              <li key={a.id} className="sa-detail-admin-item">
                <div>
                  <strong>{a.displayName}</strong>
                  <span className="muted">{a.email}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busyKey === `reset-${a.id}`}
                  onClick={() => runAction(`reset-${a.id}`, async () => {
                    const result = await resetHospitalAdminTempPassword(detail.id, a.id, {});
                    setCredentials({
                      email: a.email,
                      tempPassword: result.tempPassword,
                      hospitalName: detail.name,
                    });
                  }, 'Temporary password reset.')}
                >
                  Reset temp password
                </button>
              </li>
            ))}
            {!detail.admins?.length && <li className="muted">No hospital admin assigned.</li>}
          </ul>
        </section>
        <section className="sa-detail-section">
          <h4>Linked centers</h4>
          <ul className="sa-detail-list">
            {(detail.centers || []).map((c) => (
              <li key={c.centerId}>
                <strong>{c.name}</strong>
                <span className="muted sa-mono">{c.centerId} · {c.location || '—'}</span>
              </li>
            ))}
            {!detail.centers?.length && <li className="muted">No centers linked.</li>}
          </ul>
        </section>
      </div>

      <div className="sa-hospital-detail-audit-panel">
        <AuditLogViewer
          logs={auditLogs}
          loading={auditLoading}
          error={null}
          showHospitalColumn={false}
          onRefresh={refresh}
          title="Hospital audit log"
          subtitle={`Administration and sign-in events for ${detail.name}`}
        />
      </div>

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
