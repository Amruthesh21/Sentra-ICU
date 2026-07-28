import { Link } from 'react-router-dom';
import { useLiveWard } from '../hooks/useLiveWard';

function assignmentLine(s) {
  const assignments = Array.isArray(s.assignments) ? s.assignments : [];
  if (assignments.length > 0) {
    return assignments
      .map((a) => {
        const bed = a.bedLabel || '';
        const patient = a.patientName || '';
        if (bed && patient) return `${bed} · ${patient}`;
        return bed || patient;
      })
      .filter(Boolean)
      .join(', ');
  }
  const beds = s.assignedBeds && s.assignedBeds !== '—' ? s.assignedBeds : '';
  const patients = s.assignedPatients && s.assignedPatients !== '—' ? s.assignedPatients : '';
  if (beds && patients) return `${beds} · ${patients}`;
  return beds || patients || '—';
}

export default function Staff() {
  const { staff, loading, error } = useLiveWard();

  if (loading && staff.length === 0) {
    return <p className="pulse-muted">Loading staff…</p>;
  }

  if (error && staff.length === 0) {
    return (
      <div className="pulse-panel">
        <p style={{ color: '#b91c1c' }}>{error}</p>
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="pulse-panel">
        <p className="pulse-muted" style={{ margin: 0 }}>
          No staff roster yet. Add intensivists and nurses under Admin → Staff.
        </p>
        <Link to="/admin/staff" className="pulse-btn-dark" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
          + Add staff
        </Link>
      </div>
    );
  }

  return (
    <div className="pulse-staff-grid">
      {staff.map((s) => (
        <div key={s.id} className="pulse-staff-card">
          <div className="pulse-staff-top">
            <span className="pulse-staff-role">{s.roleLabel || s.roleCode}</span>
            <span className={s.onDuty ? 'pulse-staff-on' : 'pulse-staff-off'}>
              {s.onDuty ? 'On Duty' : 'Off'}
            </span>
          </div>
          <h3 className="pulse-staff-name">{s.fullName || s.name}</h3>
          <div className="pulse-staff-beds">Beds: {assignmentLine(s)}</div>
          {s.assignedPatients && s.assignedPatients !== '—' && (
            <div className="pulse-staff-beds" style={{ marginTop: '0.35rem' }}>
              Patients: {s.assignedPatients}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
