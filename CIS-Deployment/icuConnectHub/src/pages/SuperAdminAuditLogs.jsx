import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuditLogViewer from '../components/AuditLogViewer';
import { listAuditLogs, listHospitals } from '../api/superAdmin';

export default function SuperAdminAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hospitalId = searchParams.get('hospitalId') || '';
  const category = searchParams.get('category') || 'ALL';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [audit, hosp] = await Promise.all([
        listAuditLogs({
          hospitalId: hospitalId || undefined,
          category,
          limit: 300,
        }),
        listHospitals(),
      ]);
      setLogs(Array.isArray(audit) ? audit : []);
      setHospitals(Array.isArray(hosp) ? hosp : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hospitalId, category]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  return (
    <div className="platform-admin">
      <div className="sa-audit-scope-bar glass-card">
        <div className="sa-filter-field">
          <label htmlFor="audit-hospital">Hospital scope</label>
          <select
            id="audit-hospital"
            className="sa-hospital-select"
            value={hospitalId}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              if (e.target.value) next.set('hospitalId', e.target.value);
              else next.delete('hospitalId');
              setSearchParams(next);
            }}
          >
            <option value="">All hospitals (platform-wide)</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
        {selectedHospital && (
          <p className="muted sa-audit-scope-hint">
            Showing events scoped to <strong>{selectedHospital.name}</strong> plus platform actions on this tenant.
          </p>
        )}
      </div>

      <AuditLogViewer
        logs={logs}
        loading={loading}
        error={error}
        showHospitalColumn
        category={category}
        onCategoryChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value && value !== 'ALL') next.set('category', value);
          else next.delete('category');
          setSearchParams(next);
        }}
        onRefresh={refresh}
        title="Platform audit trail"
        subtitle="Authentication, super-admin provisioning, and hospital admin changes across the v2 tenants."
      />
    </div>
  );
}
