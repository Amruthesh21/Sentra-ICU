import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { createStaff, listStaff, removeStaff, updateStaff } from '../api/staff';

const ROLES = [
  { value: 'INTENSIVIST', label: 'Intensivist' },
  { value: 'PHYSICIAN', label: 'Physician' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'ICU_NURSE', label: 'ICU Nurse' },
  { value: 'CHARGE_NURSE', label: 'Charge Nurse' },
  { value: 'RESPIRATORY', label: 'Respiratory' },
];

export function AdminHome() {
  return (
    <div className="pulse-admin-home">
      <div className="pulse-admin-cards">
        <Link to="/admin/staff" className="pulse-panel pulse-admin-card">
          <h3>Staff roster</h3>
          <p className="pulse-muted">Add doctors and nurses used in admission assignment and Staff page.</p>
        </Link>
        <Link to="/admin/units" className="pulse-panel pulse-admin-card">
          <h3>Units & beds</h3>
          <p className="pulse-muted">Create ICU units and beds (synced to Connect Engine).</p>
        </Link>
        <Link to="/admissions" className="pulse-panel pulse-admin-card">
          <h3>Admissions</h3>
          <p className="pulse-muted">Admit patients and assign attending doctor + primary nurse.</p>
        </Link>
      </div>
    </div>
  );
}

export function AdminStaffPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    roleCode: 'INTENSIVIST',
    specialty: '',
    status: 'ON_DUTY',
    assignedBeds: '',
    phone: '',
    email: '',
  });

  async function load() {
    try {
      setRows(await listStaff());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await createStaff(form);
      setForm({
        fullName: '',
        roleCode: 'INTENSIVIST',
        specialty: '',
        status: 'ON_DUTY',
        assignedBeds: '',
        phone: '',
        email: '',
      });
      setMessage('Staff member added');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDuty(row) {
    setError(null);
    try {
      await updateStaff(row.id, { status: row.onDuty ? 'OFF' : 'ON_DUTY' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRemove(row) {
    if (!window.confirm(`Remove ${row.fullName}?`)) return;
    setError(null);
    try {
      await removeStaff(row.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pulse-admin-staff">
      <form className="pulse-panel" onSubmit={onSubmit} style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Add staff</h2>
        <div className="pulse-admin-form-grid">
          <label>
            Full name
            <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label>
            Role
            <select value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label>
            Specialty
            <input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Critical care" />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ON_DUTY">On duty</option>
              <option value="OFF">Off</option>
            </select>
          </label>
          <label>
            Assigned beds
            <input value={form.assignedBeds} onChange={(e) => setForm({ ...form, assignedBeds: e.target.value })} placeholder="ICU-01, ICU-02" />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="pulse-btn-dark" style={{ marginTop: '0.85rem' }}>Save staff</button>
        {message && <p className="pulse-muted" style={{ marginBottom: 0 }}>{message}</p>}
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      </form>

      <div className="pulse-panel">
        <h2 style={{ marginTop: 0 }}>Roster</h2>
        {rows.length === 0 ? (
          <p className="pulse-muted">No staff yet.</p>
        ) : (
          <table className="pulse-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Assigned beds / patients</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="pulse-name">{r.fullName}</div>
                    <div className="pulse-sub">{r.specialty || r.email || '—'}</div>
                  </td>
                  <td>{r.roleLabel || r.roleCode}</td>
                  <td>
                    <div>{r.assignedBeds || '—'}</div>
                    {r.assignedPatients && r.assignedPatients !== '—' ? (
                      <div className="pulse-sub">{r.assignedPatients}</div>
                    ) : null}
                  </td>
                  <td>
                    <button type="button" className="pulse-ack" onClick={() => toggleDuty(r)}>
                      {r.onDuty ? 'ON DUTY' : 'OFF'}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="pulse-ack" onClick={() => onRemove(r)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function PulseAdmin() {
  return (
    <div className="pulse-admin">
      <nav className="pulse-admin-subnav">
        <NavLink to="/admin" end className={({ isActive }) => `pulse-admin-tab${isActive ? ' is-active' : ''}`}>
          Overview
        </NavLink>
        <NavLink to="/admin/staff" className={({ isActive }) => `pulse-admin-tab${isActive ? ' is-active' : ''}`}>
          Staff
        </NavLink>
        <NavLink to="/admin/units" className={({ isActive }) => `pulse-admin-tab${isActive ? ' is-active' : ''}`}>
          Units & beds
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
