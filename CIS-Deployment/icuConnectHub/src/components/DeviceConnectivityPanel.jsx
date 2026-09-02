import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBedMap, getQuarantine, mapDevice, unmapDevice, getDeviceTypes, normalizeMapping } from '../api/deviceIngestion';
import { listUnits, getUnit } from '../api/units';

const POLL_MS = 5000;

// Friendlier labels for known device types — purely cosmetic; the actual
// list of what's supported always comes live from getDeviceTypes(), so a
// new adapter shows up (under its raw deviceType) even before a label is
// added here.
const DEVICE_TYPE_LABELS = {
  BplVividVueM10: 'BPL VividVue M10 (default)',
  BplAcuraS1: 'BPL Acura S1 (syringe pump)',
  AviIW6000: 'Avi IW6000 (incubator)',
  AviVihaDV10: 'Avi Viha DV10 (ventilator)',
  BplPenlon320: 'BPL Penlon 320 (anesthesia)',
  BplVividVue12: 'BPL VividVue M12',
  G40: 'Philips Goldway G40',
  MindrayBeneviewT5: 'Mindray Beneview T5',
  PVM2703: 'Nihon Kohden PVM-2703',
  SchillerNeumovent: 'Schiller Neumovent (ventilator)',
  VmDevice: 'Philips SureSigns VM',
  IntelliVue: 'Philips IntelliVue',
  EvitaV600: 'Draeger Evita V600 (ventilator)',
  MX550: 'Philips MX550',
  DraegerSavina300: 'Draeger Savina 300 (ventilator)',
};

/**
 * "Connect a device" — lets hospital staff map a patient monitor's IP
 * address to a bed, without anyone touching a server or a config file.
 * Talks to the device-ingestion service (see
 * CIS-Deployment/deviceIngestion) via the /device-ingestion proxy.
 *
 * Two ways to map a device:
 *  - It already sent data from an unmapped IP -> shows up under
 *    "Devices waiting to be connected" -> pick its bed, done.
 *  - You know the monitor's IP before it's plugged in -> use "Add a
 *    mapping manually" to pre-provision it.
 */
export default function DeviceConnectivityPanel() {
  const [beds, setBeds] = useState([]); // flat list across all units
  const [bedMap, setBedMapState] = useState({});
  const [unmapped, setUnmapped] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [pickedBedByIp, setPickedBedByIp] = useState({});
  const [pickedDeviceTypeByIp, setPickedDeviceTypeByIp] = useState({});
  const [manualIp, setManualIp] = useState('');
  const [manualBedLabel, setManualBedLabel] = useState('');
  const [manualDeviceType, setManualDeviceType] = useState('');

  const loadBeds = useCallback(async () => {
    const units = await listUnits();
    const details = await Promise.all(units.map((u) => getUnit(u.unitId).catch(() => null)));
    const flat = [];
    details.forEach((detail, i) => {
      const unit = units[i];
      (detail?.beds || []).forEach((bed) => {
        flat.push({
          bedLabel: bed.bedLabel,
          unitCode: unit.code,
          occupied: !!bed.occupied,
        });
      });
    });
    setBeds(flat);
  }, []);

  const loadConnectivity = useCallback(async () => {
    const [map, sources] = await Promise.all([getBedMap(), getQuarantine()]);
    setBedMapState(map);
    setUnmapped(sources);
  }, []);

  const loadDeviceTypes = useCallback(async () => {
    setDeviceTypes(await getDeviceTypes());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadBeds(), loadConnectivity(), loadDeviceTypes()]);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = setInterval(() => {
      loadConnectivity().catch((err) => setError(err.message));
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loadBeds, loadConnectivity, loadDeviceTypes]);

  const bedOptions = useMemo(
    () => beds.map((b) => ({
      value: b.bedLabel,
      label: `${b.unitCode} · ${b.bedLabel}${b.occupied ? ' (occupied)' : ''}`,
    })),
    [beds],
  );

  const deviceTypeOptions = useMemo(
    () => [
      { value: '', label: DEVICE_TYPE_LABELS.BplVividVueM10 || 'Default (BPL VividVue M10)' },
      ...deviceTypes
        .filter((d) => d.deviceType !== 'BplVividVueM10')
        .map((d) => ({
          value: d.deviceType,
          label: `${DEVICE_TYPE_LABELS[d.deviceType] || d.deviceType} — ${d.protocol.toUpperCase()}`,
        })),
    ],
    [deviceTypes],
  );

  async function handleMap(ip, bedLabel, deviceType) {
    if (!bedLabel) {
      setError('Pick a bed first');
      return;
    }
    setBusyKey(`map-${ip}`);
    setError(null);
    setMessage(null);
    try {
      await mapDevice(ip, bedLabel, deviceType);
      setMessage(`${ip} connected to ${bedLabel}`);
      await loadConnectivity();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  }

  async function handleUnmap(ip) {
    setBusyKey(`unmap-${ip}`);
    setError(null);
    setMessage(null);
    try {
      await unmapDevice(ip);
      setMessage(`${ip} disconnected`);
      await loadConnectivity();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  }

  async function handleManualAdd(e) {
    e.preventDefault();
    if (!manualIp.trim() || !manualBedLabel) {
      setError('Enter a device IP and pick a bed');
      return;
    }
    await handleMap(manualIp.trim(), manualBedLabel, manualDeviceType);
    setManualIp('');
    setManualBedLabel('');
    setManualDeviceType('');
  }

  // Each entry is either a plain bedId string (default adapter) or a
  // {bedId, deviceType} object — normalize before rendering so an object
  // never gets handed to React as a child (see api/deviceIngestion.js).
  const mappedEntries = Object.entries(bedMap).map(([ip, entry]) => ({ ip, ...normalizeMapping(entry) }));

  if (loading) {
    return (
      <div className="form-card glass-card">
        <h3 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Connect a device</h3>
        <p className="muted">Loading device connectivity…</p>
      </div>
    );
  }

  return (
    <div className="form-card glass-card">
      <h3 style={{ marginBottom: 4, fontSize: '0.95rem' }}>Connect a device</h3>
      <p className="muted" style={{ marginBottom: 14 }}>
        Map a patient monitor&apos;s network address to a bed. A monitor is never trusted to say
        which bed it&apos;s in — data from an unmapped device is held here, never guessed at.
      </p>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>
        Devices waiting to be connected
        {unmapped.length > 0 && <span className="unit-code-badge" style={{ marginLeft: 8 }}>{unmapped.length}</span>}
      </h4>
      {unmapped.length === 0 ? (
        <p className="muted" style={{ marginBottom: 18 }}>
          No unrecognized devices right now — this fills in the moment a new monitor sends data.
        </p>
      ) : (
        <div className="clinical-table-wrap" style={{ marginBottom: 18 }}>
          <table className="clinical-table order-table">
            <thead>
              <tr>
                <th>Device IP</th>
                <th>First seen</th>
                <th>Messages</th>
                <th>Device model</th>
                <th>Connect to bed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {unmapped.map((u) => (
                <tr key={u.ip}>
                  <td className="mono">{u.ip}</td>
                  <td className="muted">{new Date(u.firstSeenAt).toLocaleTimeString()}</td>
                  <td>{u.messageCount}</td>
                  <td>
                    <select
                      value={pickedDeviceTypeByIp[u.ip] || ''}
                      onChange={(e) => setPickedDeviceTypeByIp({ ...pickedDeviceTypeByIp, [u.ip]: e.target.value })}
                    >
                      {deviceTypeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={pickedBedByIp[u.ip] || ''}
                      onChange={(e) => setPickedBedByIp({ ...pickedBedByIp, [u.ip]: e.target.value })}
                    >
                      <option value="">Select bed…</option>
                      {bedOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyKey === `map-${u.ip}`}
                      onClick={() => handleMap(u.ip, pickedBedByIp[u.ip], pickedDeviceTypeByIp[u.ip])}
                    >
                      {busyKey === `map-${u.ip}` ? 'Connecting…' : 'Connect'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Connected devices</h4>
      {mappedEntries.length === 0 ? (
        <p className="muted" style={{ marginBottom: 18 }}>No devices connected yet.</p>
      ) : (
        <div className="clinical-table-wrap" style={{ marginBottom: 18 }}>
          <table className="clinical-table order-table">
            <thead>
              <tr>
                <th>Device IP</th>
                <th>Bed</th>
                <th>Device model</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mappedEntries.map(({ ip, bedId, deviceType }) => (
                <tr key={ip}>
                  <td className="mono">{ip}</td>
                  <td>{bedId}</td>
                  <td className="muted">{DEVICE_TYPE_LABELS[deviceType] || deviceType || DEVICE_TYPE_LABELS.BplVividVueM10}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busyKey === `unmap-${ip}`}
                      onClick={() => handleUnmap(ip)}
                    >
                      {busyKey === `unmap-${ip}` ? 'Removing…' : 'Disconnect'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Add a mapping manually</h4>
      <p className="muted" style={{ marginBottom: 8 }}>
        Know the monitor&apos;s IP before it&apos;s plugged in? Set it up ahead of time.
      </p>
      <form className="form-grid" onSubmit={handleManualAdd}>
        <div className="form-group">
          <label>Device IP *</label>
          <input
            required
            placeholder="e.g. 192.168.1.50"
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Bed *</label>
          <select value={manualBedLabel} onChange={(e) => setManualBedLabel(e.target.value)}>
            <option value="">Select bed…</option>
            {bedOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Device model</label>
          <select value={manualDeviceType} onChange={(e) => setManualDeviceType(e.target.value)}>
            {deviceTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={!!busyKey}>Add mapping</button>
        </div>
      </form>
    </div>
  );
}
