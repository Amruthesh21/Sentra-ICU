import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addBedToUnit, createUnit, listUnits, getUnit } from '../api/units';
import DeviceConnectivityPanel from '../components/DeviceConnectivityPanel';

export default function Admin({ hospitalAdmin = false }) {
  const { user } = useAuth();
  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitDetail, setUnitDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [unitForm, setUnitForm] = useState({
    blockName: '',
    code: '',
    name: '',
  });

  const [bedForm, setBedForm] = useState({ bedLabel: '' });

  async function loadUnits(selectFirst = false) {
    const list = await listUnits();
    setUnits(list);
    if (selectFirst && list.length && !selectedUnitId) {
      setSelectedUnitId(list[0].unitId);
    }
    return list;
  }

  async function loadUnitDetail(unitId) {
    if (!unitId) {
      setUnitDetail(null);
      return;
    }
    const detail = await getUnit(unitId);
    setUnitDetail(detail);
  }

  async function refresh(selectFirst = false) {
    try {
      const list = await loadUnits(selectFirst);
      const id = selectedUnitId || (list[0]?.unitId ?? '');
      if (id) await loadUnitDetail(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(true); }, []);

  useEffect(() => {
    if (selectedUnitId) loadUnitDetail(selectedUnitId).catch((e) => setError(e.message));
  }, [selectedUnitId]);

  async function handleCreateUnit(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const result = await createUnit(unitForm);
      setMessage(result.message || `Unit ${result.name} created`);
      setUnitForm({ blockName: '', code: '', name: '' });
      await loadUnits();
      setSelectedUnitId(result.unitId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddBed(e) {
    e.preventDefault();
    if (!selectedUnitId) {
      setError('Select an ICU unit first');
      return;
    }
    setMessage(null);
    setError(null);
    try {
      const result = await addBedToUnit(selectedUnitId, { ...bedForm, ip: 'auto' });
      setMessage(result.message || `Bed ${result.bedLabel} added`);
      setBedForm({ bedLabel: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="empty-state glass-card"><h2>Loading admin…</h2></div>;
  }

  return (
    <div className={`admin-layout${hospitalAdmin ? ' hospital-admin-page' : ''}`}>
      <div className="page-intro admin-header">
        <div>
          <h2 className="page-intro-title">
            {hospitalAdmin
              ? (user?.displayName || 'Hospital setup')
              : 'Hospital setup'}
          </h2>
          <p className="muted">
            Create ICU units and beds locally. Live patient data and history come from hospital
            connectivity (HL7 / FHIR / adapters) — not Connect Engine.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link to="/connectivity" className="btn btn-primary">Open Connectivity</Link>
          {!hospitalAdmin && (
            <Link to="/analytics" className="btn btn-outline">ICU Command Center</Link>
          )}
        </div>
      </div>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <div className="admin-grid">
        <div className="form-card glass-card">
          <h3 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Create ICU Unit</h3>
          <form className="form-grid" onSubmit={handleCreateUnit}>
            <div className="form-group">
              <label>Block / Wing (optional)</label>
              <input
                placeholder="e.g. Block A, North Wing"
                value={unitForm.blockName}
                onChange={(e) => setUnitForm({ ...unitForm, blockName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Unit code *</label>
              <input
                required
                placeholder="ICU1"
                value={unitForm.code}
                onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value.toUpperCase() })}
              />
              <small className="muted">e.g. ICU1, ICU2</small>
            </div>
            <div className="form-group">
              <label>Unit name *</label>
              <input
                required
                placeholder="e.g. ICU 1, ICU 2, ICU 3"
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Create unit</button>
            </div>
          </form>
        </div>

        <div className="form-card glass-card">
          <h3 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Add bed to unit</h3>
          {units.length === 0 ? (
            <p className="muted">Create an ICU unit first.</p>
          ) : (
            <form className="form-grid" onSubmit={handleAddBed}>
              <div className="form-group">
                <label>ICU unit *</label>
                <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
                  {units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>{u.displayLabel}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Bed name *</label>
                <input
                  required
                  placeholder="BED-01"
                  value={bedForm.bedLabel}
                  onChange={(e) => setBedForm({ ...bedForm, bedLabel: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Add bed</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="form-card glass-card units-beds-card">
        <div className="units-beds-header">
          <h3>Units &amp; beds</h3>
          {selectedUnitId && unitDetail && (
            <span className="units-beds-summary muted">
              {unitDetail.name} · {unitDetail.beds?.length ?? 0} bed{(unitDetail.beds?.length ?? 0) === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {units.length === 0 ? (
          <p className="muted">No ICU units yet — create one above.</p>
        ) : (
          <div className="units-beds-layout">
            <aside className="unit-picker" aria-label="ICU units">
              {units.map((u) => (
                <button
                  key={u.unitId}
                  type="button"
                  className={`unit-picker-card${selectedUnitId === u.unitId ? ' is-selected' : ''}`}
                  onClick={() => setSelectedUnitId(u.unitId)}
                >
                  <div className="unit-picker-top">
                    <span className="unit-picker-name">{u.name}</span>
                    <span className="unit-code-badge">{u.code}</span>
                  </div>
                  {u.blockName && <div className="unit-picker-block">{u.blockName}</div>}
                  <div className="unit-picker-stats">
                    <span className="unit-stat-vacant">{u.vacantCount} vacant</span>
                    <span className="unit-stat-occupied">{u.occupiedCount} occupied</span>
                  </div>
                </button>
              ))}
            </aside>

            <div className="beds-panel">
              {!unitDetail ? (
                <p className="muted">Select a unit.</p>
              ) : (unitDetail.beds || []).length === 0 ? (
                <p className="muted">No beds in this unit yet.</p>
              ) : (
                <div className="clinical-table-wrap">
                  <div className="bed-table" role="table">
                    <div className="bed-table-head" role="row">
                      <span role="columnheader">Bed</span>
                      <span role="columnheader">Status</span>
                    </div>
                    {(unitDetail.beds || []).map((bed) => (
                      <div className="bed-table-row" role="row" key={bed.bedId || bed.bedLabel}>
                        <span className="bed-table-label" role="cell">{bed.bedLabel}</span>
                        <span className="bed-table-status" role="cell">
                          {bed.occupied ? 'Occupied' : 'Vacant'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DeviceConnectivityPanel />
    </div>
  );
}
