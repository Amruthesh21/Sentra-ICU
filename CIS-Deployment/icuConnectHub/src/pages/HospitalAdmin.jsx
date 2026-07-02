import { useEffect, useState } from 'react';
import {
  createRole, createUser, listRoles, listUsers, updateRole,
} from '../api/hospitalAdmin';
import PermissionPicker from '../components/PermissionPicker';
import { ALL_ASSIGNABLE_KEYS } from '../constants/permissionsCatalog';

function filterAssignable(perms = []) {
  const allowed = new Set(ALL_ASSIGNABLE_KEYS);
  return perms.filter((p) => allowed.has(p));
}

function StatusPill({ active }) {
  return (
    <span className={`status-pill ${active ? 'status-pill--vacant' : 'status-pill--occupied'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function HospitalAdmin() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '', displayName: '', password: '', roleId: '', role: '',
  });
  const [roleForm, setRoleForm] = useState({
    name: '', description: '', permissions: [],
  });
  const [editingRole, setEditingRole] = useState(null);

  async function refresh() {
    const [u, r] = await Promise.all([listUsers(), listRoles()]);
    setUsers(u);
    setRoles(r);
  }

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
  }, []);

  async function handleCreateUser(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await createUser(userForm);
      setMessage('User created');
      setUserForm({ email: '', displayName: '', password: '', roleId: '', role: '' });
      setUserModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateRole(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, roleForm);
        setMessage('Role updated');
      } else {
        await createRole(roleForm);
        setMessage('Role created');
      }
      setRoleForm({ name: '', description: '', permissions: [] });
      setEditingRole(null);
      setRoleModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function openRoleModal(role = null) {
    if (role) {
      setEditingRole(role);
      setRoleForm({ name: role.name, description: role.description || '', permissions: filterAssignable(role.permissions) });
    } else {
      setEditingRole(null);
      setRoleForm({ name: '', description: '', permissions: [] });
    }
    setRoleModalOpen(true);
  }

  if (loading) {
    return <div className="empty-state glass-card hospital-admin-page"><h2>Loading users &amp; roles…</h2></div>;
  }

  return (
    <div className="order-mgmt hospital-admin-page ha-staff-page">
      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <div className="ha-staff-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`ha-staff-tab${tab === 'users' ? ' is-active' : ''}`}
          aria-selected={tab === 'users'}
          onClick={() => setTab('users')}
        >
          Users
          <span className="ha-staff-tab-count">{users.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={`ha-staff-tab${tab === 'roles' ? ' is-active' : ''}`}
          aria-selected={tab === 'roles'}
          onClick={() => setTab('roles')}
        >
          Roles
          <span className="ha-staff-tab-count">{roles.length}</span>
        </button>
      </div>

      {tab === 'users' && (
        <div className="form-card glass-card sa-table-panel">
          <div className="order-mgmt-head">
            <div>
              <h3 className="order-mgmt-title">Hospital users</h3>
              <p className="ha-panel-sub">
                Staff accounts for nurses, physicians, and other clinical roles.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setUserModalOpen(true)}>
              + Create user
            </button>
          </div>
          <div className="clinical-table-wrap order-table-wrap">
            <table className="clinical-table order-table sa-platform-table sa-platform-table--users">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted order-empty">No users yet. Click &quot;+ Create user&quot; to add staff.</td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className={!u.active ? 'sa-table-row--muted' : ''}>
                    <td>{u.displayName || '—'}</td>
                    <td className="order-by">{u.email}</td>
                    <td>{u.role || '—'}</td>
                    <td><StatusPill active={!!u.active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="form-card glass-card sa-table-panel">
          <div className="order-mgmt-head">
            <div>
              <h3 className="order-mgmt-title">Roles &amp; permissions</h3>
              <p className="ha-panel-sub">
                System roles are pre-configured — click View to inspect or adjust permissions.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => openRoleModal()}>
              + Create role
            </button>
          </div>
          <div className="clinical-table-wrap order-table-wrap">
            <table className="clinical-table order-table sa-platform-table sa-platform-table--roles">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th className="col-manage">Edit</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted order-empty">No roles yet.</td>
                  </tr>
                )}
                {roles.map((r) => {
                  const isSystem = !!r.systemRole;
                  return (
                  <tr key={r.id} className={isSystem ? 'sa-table-row--system' : ''}>
                    <td>
                      <span className="sa-table-cell-stack">
                        <strong>{r.name}</strong>
                        {isSystem && <span className="unit-code-badge">System</span>}
                      </span>
                    </td>
                    <td className="muted">{r.description || '—'}</td>
                    <td>{r.permissions?.length || 0}</td>
                    <td className="col-manage">
                      <button
                        type="button"
                        className="sa-table-btn sa-table-btn--manage"
                        onClick={() => openRoleModal(r)}
                      >
                        {isSystem ? 'View →' : 'Edit →'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {userModalOpen && (
        <div className="order-modal-overlay" onClick={() => setUserModalOpen(false)}>
          <div className="order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-head">
              <h3>+ Create user</h3>
              <button type="button" className="order-modal-close" onClick={() => setUserModalOpen(false)}>×</button>
            </div>
            <form className="order-form" onSubmit={handleCreateUser}>
              <div className="form-group">
                <label><span className="req">*</span> Email</label>
                <input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Display name</label>
                <input value={userForm.displayName} onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={userForm.roleId}
                  onChange={(e) => {
                    const roleId = e.target.value;
                    const role = roles.find((r) => r.id === roleId);
                    setUserForm({ ...userForm, roleId, role: role?.name || '' });
                  }}
                >
                  <option value="">Select role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label><span className="req">*</span> Temporary password</label>
                <input required type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
              <div className="order-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setUserModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create user</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roleModalOpen && (
        <div className="order-modal-overlay" onClick={() => { setRoleModalOpen(false); setEditingRole(null); }}>
          <div className="order-modal order-modal--wide order-modal--permissions" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-head">
              <h3>{editingRole ? (editingRole.systemRole ? `View role — ${editingRole.name}` : `Edit role — ${editingRole.name}`) : '+ Create role'}</h3>
              <button type="button" className="order-modal-close" onClick={() => { setRoleModalOpen(false); setEditingRole(null); }}>×</button>
            </div>
            <form className="order-form" onSubmit={handleCreateRole}>
              {editingRole?.systemRole && (
                <p className="order-info-banner" style={{ marginBottom: 12 }}>
                  System role — name is fixed. You can update description and permissions for your hospital.
                </p>
              )}
              <div className="form-group">
                <label><span className="req">*</span> Role name</label>
                <input required value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} disabled={!!editingRole?.systemRole} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
              </div>
              <div className="form-group form-group--full">
                <label>Permissions</label>
                <PermissionPicker
                  value={roleForm.permissions}
                  onChange={(permissions) => setRoleForm({ ...roleForm, permissions })}
                />
              </div>
              <div className="order-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setRoleModalOpen(false); setEditingRole(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingRole ? 'Save role' : 'Create role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
