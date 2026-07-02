import { useCallback, useEffect, useState } from 'react';
import AuditLogViewer from '../components/AuditLogViewer';
import { listAuditLogs } from '../api/hospitalAdmin';
import '../styles/super-admin.css';

export default function HospitalAdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('ALL');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const audit = await listAuditLogs({ category, limit: 300 });
      setLogs(Array.isArray(audit) ? audit : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="ha-audit-wrap">
      <AuditLogViewer
        logs={logs}
        loading={loading}
        error={error}
        showHospitalColumn
        category={category}
        onCategoryChange={setCategory}
        onRefresh={refresh}
        title="Hospital audit log"
        subtitle="Sign-ins, user provisioning, role changes, and other administration events for your hospital only."
      />
    </div>
  );
}
