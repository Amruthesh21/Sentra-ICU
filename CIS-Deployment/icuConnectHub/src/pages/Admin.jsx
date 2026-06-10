import { useEffect, useState } from 'react';
import {
  getCenter,
  addBed,
  admitPatient,
  dischargePatient,
  getDevices,
  reloadConnectEngine,
} from '../api/hub';

const SIMULATOR_IP = '172.25.0.8';

const DEVICE_ORDER = ['BplUltimaPrime', 'Agilia', 'BplElisa600'];

function sortDevices(deviceList) {
  return [...deviceList].sort((a, b) => {
    const ai = DEVICE_ORDER.indexOf(a.deviceId);
    const bi = DEVICE_ORDER.indexOf(b.deviceId);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    return aRank - bRank || (a.deviceName || '').localeCompare(b.deviceName || '');
  });
}

export default function Admin() {
  const [beds, setBeds] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [bedForm, setBedForm] = useState({ bedLabel: '', ip: 'auto' });
  const [patientForm, setPatientForm] = useState({
    bedLabel: 'BED-01',
    name: '',
    mrn: '',
    gender: 'M',
    weight: '',
    dateOfBirth: '',
    devices: [],
  });

  async function refresh() {
    try {
      const [center, deviceList] = await Promise.all([
        getCenter(),
        getDevices().catch(() => []),
      ]);
      const bedList = Array.isArray(center.beds) ? center.beds : [];
      const devList = Array.isArray(deviceList) ? deviceList : [];
      setBeds(bedList);
      setDevices(sortDevices(devList));
      if (bedList.length) {
        setPatientForm((f) => ({
          ...f,
          bedLabel: bedList.some((b) => b.bedLabel === f.bedLabel) ? f.bedLabel : bedList[0].bedLabel,
          devices: f.devices.length ? f.devices : defaultDevicesForBed(bedList[0], devList),
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function defaultDevicesForBed(bed, deviceList = devices) {
    const list = Array.isArray(deviceList) ? deviceList : [];
    return list.map((d) => d.deviceId);
  }

  useEffect(() => { refresh(); }, []);

  function onBedChange(bedLabel) {
    const bed = beds.find((b) => b.bedLabel === bedLabel);
    setPatientForm((f) => ({
      ...f,
      bedLabel,
      devices: defaultDevicesForBed(bed),
    }));
  }

  function toggleDevice(deviceId) {
    setPatientForm((f) => ({
      ...f,
      devices: f.devices.includes(deviceId)
        ? f.devices.filter((d) => d !== deviceId)
        : [...f.devices, deviceId],
    }));
  }

  async function handleAddBed(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const result = await addBed(bedForm.bedLabel, bedForm.ip);
      setMessage(result.message || `Bed ${result.bedLabel} added`);
      setBedForm({ bedLabel: '', ip: 'auto' });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdmit(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const result = await admitPatient({
        ...patientForm,
        weight: patientForm.weight ? parseFloat(patientForm.weight) : undefined,
        devices: patientForm.devices,
      });
      setMessage(result.message || `${result.patientName} admitted to ${result.bedLabel}`);
      setPatientForm((f) => ({ ...f, name: '', mrn: '' }));
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSyncConnectEngine() {
    setMessage(null);
    setError(null);
    try {
      const result = await reloadConnectEngine();
      setMessage(result.message || 'Connect Engine sync requested');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDischarge(bedLabel) {
    setMessage(null);
    setError(null);
    try {
      await dischargePatient(bedLabel);
      setMessage(`Patient discharged from ${bedLabel}`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedBed = beds.find((b) => b.bedLabel === patientForm.bedLabel);

  if (loading) {
    return <div className="empty-state"><h2>Loading admin…</h2></div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Care Unit · RTWO / JPN</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 12 }}>
          Hub uses MongoDB instantly — no restart per bed. Use Sync once after bulk changes.
        </p>
        <button type="button" className="btn btn-outline" style={{ marginBottom: 20 }} onClick={handleSyncConnectEngine}>
          Sync Connect Engine (device gateway)
        </button>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>Add Bed</h3>
          <form className="form-grid" onSubmit={handleAddBed}>
            <div className="form-group">
              <label>Bed Name</label>
              <input
                required
                placeholder="BED-02"
                value={bedForm.bedLabel}
                onChange={(e) => setBedForm({ ...bedForm, bedLabel: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group">
              <label>Device IP</label>
              <input
                placeholder="auto (assigns simulator if free)"
                value={bedForm.ip}
                onChange={(e) => setBedForm({ ...bedForm, ip: e.target.value })}
              />
              <small style={{ color: '#64748b' }}>Use {SIMULATOR_IP} for live demo vitals (one bed at a time).</small>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Add Bed</button>
            </div>
          </form>
        </div>

        <div className="form-card">
          <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>Admit Patient</h3>
          <form className="form-grid" onSubmit={handleAdmit}>
            <div className="form-group">
              <label>Bed</label>
              {beds.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Add a bed first.</p>
              ) : (
                <select
                  value={patientForm.bedLabel}
                  onChange={(e) => onBedChange(e.target.value)}
                >
                  {beds.map((b) => (
                    <option key={b.bedLabel} value={b.bedLabel}>
                      {b.bedLabel}{b.simulatorConnected ? ' · simulator' : b.deviceIp ? ` · ${b.deviceIp}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="form-group">
              <label>Name</label>
              <input required value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>MRN</label>
              <input required value={patientForm.mrn} onChange={(e) => setPatientForm({ ...patientForm, mrn: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select value={patientForm.gender} onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="form-group">
              <label>Weight (kg)</label>
              <input type="number" value={patientForm.weight} onChange={(e) => setPatientForm({ ...patientForm, weight: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" value={patientForm.dateOfBirth} onChange={(e) => setPatientForm({ ...patientForm, dateOfBirth: e.target.value })} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Connect Devices</label>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>
                Select devices available on this bed. Parameters flow from connected devices only.
              </p>
              {devices.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>Loading device catalog…</p>
              ) : (
                <div className="device-checklist">
                  {devices.map((d) => (
                    <label key={d.deviceId} className="device-check">
                      <input
                        type="checkbox"
                        checked={patientForm.devices.includes(d.deviceId)}
                        onChange={() => toggleDevice(d.deviceId)}
                      />
                      <span className="device-check-body">
                        <span className="device-check-title">
                          {d.deviceName}
                          <span className="device-check-type"> · {d.deviceType}</span>
                        </span>
                        <div className="device-check-params">
                          {(d.parameters || []).slice(0, 6).map((p) => p.name).join(', ')}
                        </div>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {selectedBed && !selectedBed.simulatorConnected && selectedBed.virtualSimulatorActive && (
                <div className="message info" style={{ marginTop: 8 }}>
                  Virtual simulation — unique vitals will be generated for this bed after admit.
                </div>
              )}
              {selectedBed && !selectedBed.simulatorConnected && !selectedBed.virtualSimulatorActive && selectedBed.deviceIp !== SIMULATOR_IP && (
                <div className="message error" style={{ marginTop: 8 }}>
                  No live simulator on this bed — admit patient to enable virtual simulation.
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={beds.length === 0}>Admit Patient</button>
            </div>
          </form>
        </div>
      </div>

      <div className="form-card" style={{ alignSelf: 'start' }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>Current Beds</h3>
        {beds.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No beds yet</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {beds.map((bed) => (
              <div key={bed.bedLabel} style={{ padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{bed.bedLabel}</strong>
                    {bed.simulatorConnected && (
                      <span style={{ marginLeft: 8, fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4 }}>
                        SIM
                      </span>
                    )}
                    {bed.virtualSimulatorActive && !bed.simulatorConnected && (
                      <span style={{ marginLeft: 8, fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 4 }}>
                        V-SIM
                      </span>
                    )}
                    {bed.ipConflict && (
                      <span style={{ marginLeft: 8, fontSize: '0.7rem', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 4 }}>
                        IP conflict
                      </span>
                    )}
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                      {bed.occupied ? bed.patient?.name : 'Vacant'}
                      {bed.deviceIp ? ` · ${bed.deviceIp}` : ''}
                      {bed.ipConflict && ' · change to unique IP for live vitals'}
                    </div>
                  </div>
                  {bed.occupied && (
                    <button type="button" className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleDischarge(bed.bedLabel)}>
                      Discharge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
