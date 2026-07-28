import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  connectFhir,
  deleteConnection,
  getEngineStatus,
  hospitalPushDevice,
  hospitalPushHl7,
  listAudit,
  listPatients,
  replayBuffer,
  syncConnection,
} from '../api/integration';
import { useLiveWard } from '../hooks/useLiveWard';

const DEFAULT_FHIR = 'http://127.0.0.1:9080/fhir';
const INGEST_TOKEN = 'pulse-hospital-demo-token';
const FRESH_MS = 5 * 60 * 1000;

function formatLiveVitals(bed) {
  const parts = [];
  if (bed.hr != null) parts.push(`HR ${bed.hr}`);
  if (bed.spo2 != null) parts.push(`SpO2 ${bed.spo2}`);
  if (bed.bp && bed.bp !== '—') parts.push(`BP ${bed.bp}`);
  if (bed.rr != null) parts.push(`RR ${bed.rr}`);
  return parts.length ? parts.join(' · ') : '—';
}

function feedLabel(bed) {
  if (bed.liveVitalsCapable || bed.simulatorConnected) return 'LIVE CE';
  if (bed.virtualSimulatorActive || bed.simulationMode === 'virtual') return 'VIRTUAL';
  if (bed.hasVitals) return 'CACHED';
  return 'NO FEED';
}

function isFresh(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t < FRESH_MS;
}

export default function Connectivity() {
  const {
    beds,
    occupied,
    alerts,
    stats,
    centerName,
    loading,
    error: wardError,
    updatedAt,
    refresh: refreshWard,
  } = useLiveWard({ pollMs: 3000 });

  const [engine, setEngine] = useState(null);
  const [labPatients, setLabPatients] = useState([]);
  const [audit, setAudit] = useState([]);
  const [engineDown, setEngineDown] = useState(false);
  const [fhirUrl, setFhirUrl] = useState(DEFAULT_FHIR);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [labError, setLabError] = useState(null);

  const refreshLab = useCallback(async () => {
    try {
      const [st, pts, aud] = await Promise.all([getEngineStatus(), listPatients(), listAudit()]);
      setEngine(st);
      setLabPatients(Array.isArray(pts) ? pts : []);
      setAudit(Array.isArray(aud) ? aud : []);
      setEngineDown(false);
      setLabError(null);
    } catch (e) {
      setEngineDown(true);
      setEngine(null);
      setLabError(e.message);
    }
  }, []);

  useEffect(() => {
    refreshLab();
    const id = setInterval(refreshLab, 5000);
    return () => clearInterval(id);
  }, [refreshLab]);

  async function run(label, fn) {
    setBusy(label);
    setMessage(null);
    setLabError(null);
    try {
      const result = await fn();
      setMessage(typeof result === 'string' ? result : (result.message || result.note || 'Done'));
      await Promise.all([refreshLab(), refreshWard()]);
    } catch (e) {
      setLabError(e.message);
    } finally {
      setBusy('');
    }
  }

  const liveFeeds = useMemo(
    () => beds.filter((b) => b.simulatorConnected || b.liveVitalsCapable),
    [beds],
  );
  const virtualFeeds = useMemo(
    () => beds.filter((b) => b.virtualSimulatorActive && !b.liveVitalsCapable),
    [beds],
  );
  const streamingOccupied = useMemo(
    () => occupied.filter((b) => b.hasVitals),
    [occupied],
  );

  const channels = useMemo(() => {
    const recentAudit = (ch) =>
      audit.some((a) => String(a.channel || '').toUpperCase() === ch && isFresh(a.ts));
    const fhirOk = (engine?.connections || []).some(
      (c) => c.type === 'FHIR' && c.status === 'connected' && isFresh(c.lastSyncAt),
    );
    return [
      {
        key: 'ce',
        title: 'Connect Engine',
        detail: `${liveFeeds.length} bed device stream${liveFeeds.length === 1 ? '' : 's'}`,
        on: liveFeeds.length > 0,
      },
      {
        key: 'vitals',
        title: 'Live vitals',
        detail: `${streamingOccupied.length}/${occupied.length || 0} patients streaming`,
        on: streamingOccupied.length > 0,
      },
      {
        key: 'virtual',
        title: 'Virtual sim',
        detail: `${virtualFeeds.length} bed${virtualFeeds.length === 1 ? '' : 's'} on virtual feed`,
        on: virtualFeeds.length > 0,
      },
      {
        key: 'alarms',
        title: 'Alarm feed',
        detail: `${alerts.length} active`,
        on: true,
      },
      {
        key: 'hl7',
        title: 'HL7 ingest',
        detail: recentAudit('HL7') ? 'Activity in last 5 min' : 'No recent messages',
        on: recentAudit('HL7'),
      },
      {
        key: 'fhir',
        title: 'FHIR pull',
        detail: fhirOk ? 'Synced recently' : 'No fresh sync',
        on: fhirOk,
      },
      {
        key: 'device',
        title: 'Device adapter',
        detail: recentAudit('DEVICE') ? 'Activity in last 5 min' : 'No recent posts',
        on: recentAudit('DEVICE'),
      },
      {
        key: 'hub',
        title: 'Alarm hub',
        detail: wardError ? 'Unreachable' : `${centerName} · ${stats.bedCount} beds`,
        on: !wardError && !loading,
      },
    ];
  }, [audit, engine, liveFeeds, virtualFeeds, streamingOccupied, occupied, alerts, wardError, loading, centerName, stats.bedCount]);

  const connections = engine?.connections || [];
  const fhirConnections = connections.filter((c) => c.type === 'FHIR');
  const hostHint = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  const ingestUrl = `http://${hostHint === 'localhost' ? '<CLOUD-IP>' : hostHint}:9070/ingest/hl7`;
  const liveChannels = channels.filter((c) => c.on).length;

  return (
    <div className="pulse-conn">
      <div className="pulse-kpis pulse-conn-kpis">
        <div className="pulse-kpi">
          <div className="pulse-kpi-label">Hub feed</div>
          <div className={`pulse-kpi-value${wardError ? ' is-critical' : ' is-stable-text'}`}>
            {wardError ? 'Offline' : 'Live'}
          </div>
        </div>
        <div className="pulse-kpi">
          <div className="pulse-kpi-label">Patients</div>
          <div className="pulse-kpi-value">{stats.patients}</div>
        </div>
        <div className="pulse-kpi">
          <div className="pulse-kpi-label">CE device streams</div>
          <div className="pulse-kpi-value">{liveFeeds.length}</div>
        </div>
        <div className="pulse-kpi">
          <div className="pulse-kpi-label">Active alerts</div>
          <div className="pulse-kpi-value">{stats.activeAlerts}</div>
        </div>
      </div>

      {wardError && (
        <div className="pulse-conn-alert is-error">
          <strong>Live ward feed unreachable</strong>
          <p>{wardError}</p>
        </div>
      )}

      {message && <div className="pulse-conn-alert is-ok">{message}</div>}
      {labError && !engineDown && <div className="pulse-conn-alert is-error">{labError}</div>}

      {!wardError && (
        <div className="pulse-conn-statusline">
          <span className="pulse-conn-dot" />
          <span>
            <strong>{centerName}</strong>
            {' · '}{liveChannels}/{channels.length} channels active
            {' · '}{liveFeeds.length} Connect Engine · {virtualFeeds.length} virtual
            {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}
          </span>
        </div>
      )}

      <div className="pulse-conn-caps">
        {channels.map((c) => (
          <div key={c.key} className={`pulse-conn-cap${c.on ? ' is-on' : ''}`}>
            <span className="pulse-conn-cap-title">{c.title}</span>
            <span className="pulse-conn-cap-detail">{c.detail}</span>
            <em>{c.on ? 'Live' : 'Idle'}</em>
          </div>
        ))}
      </div>

      {/* Primary: live hospital beds from Connect Engine / hub */}
      <div className="pulse-conn-split pulse-conn-split--tables">
        <section className="pulse-panel pulse-conn-panel">
          <header className="pulse-conn-panel-head">
            <div>
              <h2>Live bed feeds</h2>
              <p>Real device connectivity from Connect Engine — refreshes every few seconds.</p>
            </div>
            <span className="pulse-conn-count">{beds.length}</span>
          </header>
          {loading && beds.length === 0 ? (
            <p className="pulse-muted">Loading live beds…</p>
          ) : beds.length === 0 ? (
            <p className="pulse-muted">No beds registered in this center.</p>
          ) : (
            <div className="pulse-conn-table-wrap">
              <table className="pulse-table">
                <thead>
                  <tr>
                    <th>Bed</th>
                    <th>Device IP</th>
                    <th>Mode</th>
                    <th>Stream</th>
                    <th>Patient</th>
                  </tr>
                </thead>
                <tbody>
                  {[...beds]
                    .sort((a, b) => Number(b.occupied) - Number(a.occupied) || String(a.bedLabel).localeCompare(String(b.bedLabel), undefined, { numeric: true }))
                    .map((b) => (
                      <tr key={b.bedLabel}>
                        <td className="mono">{b.bedLabel}</td>
                        <td className="mono">{b.deviceIp || '—'}</td>
                        <td>
                          <span className={`pulse-conn-tag${b.liveVitalsCapable ? ' is-ok' : ''}`}>
                            {feedLabel(b)}
                          </span>
                        </td>
                        <td className="pulse-muted">
                          {b.simulatorConnected ? 'Connected' : b.virtualSimulatorActive ? 'Virtual' : 'Idle'}
                        </td>
                        <td>{b.occupied ? (b.patient || '—') : <span className="pulse-muted">Vacant</span>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="pulse-panel pulse-conn-panel">
          <header className="pulse-conn-panel-head">
            <div>
              <h2>Live patients</h2>
              <p>Occupied beds with current vitals from the alarm hub.</p>
            </div>
            <span className="pulse-conn-count">{occupied.length}</span>
          </header>
          {occupied.length === 0 ? (
            <p className="pulse-muted">No occupied beds right now.</p>
          ) : (
            <div className="pulse-conn-table-wrap">
              <table className="pulse-table">
                <thead>
                  <tr>
                    <th>MRN</th>
                    <th>Name</th>
                    <th>Bed</th>
                    <th>Feed</th>
                    <th>Vitals</th>
                  </tr>
                </thead>
                <tbody>
                  {occupied.map((b) => (
                    <tr key={b.bedLabel}>
                      <td className="mono">{b.mrn || '—'}</td>
                      <td>
                        <div className="pulse-name">{b.patient || '—'}</div>
                        {b.attendingPhysician || b.primaryNurse ? (
                          <div className="pulse-sub">
                            {[b.attendingPhysician, b.primaryNurse].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </td>
                      <td>{b.bedLabel}</td>
                      <td>
                        <span className={`pulse-conn-tag${b.liveVitalsCapable ? ' is-ok' : ''}`}>
                          {feedLabel(b)}
                        </span>
                      </td>
                      <td className="mono">{formatLiveVitals(b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Secondary: HL7 / FHIR lab — only for interface testing */}
      <details className="pulse-panel pulse-conn-setup pulse-conn-lab">
        <summary>
          Hospital interface lab (HL7 / FHIR)
          <span className="pulse-conn-lab-meta">
            {engineDown ? 'Engine offline' : `Engine online · ${labPatients.length} lab patients · ${audit.length} audit`}
          </span>
        </summary>

        {engineDown && (
          <div className="pulse-conn-alert is-error" style={{ margin: '0 1.1rem 1rem' }}>
            <strong>Integration Engine unreachable (:9070)</strong>
            <p>Optional lab for HL7/FHIR practice — live ward data above does not depend on it.</p>
          </div>
        )}

        <div className="pulse-conn-lab-body">
          <div className="pulse-conn-split">
            <section className="pulse-conn-panel">
              <header className="pulse-conn-panel-head">
                <div>
                  <h2>FHIR connection</h2>
                  <p>Pull from a hospital FHIR base into the lab store.</p>
                </div>
              </header>
              <div className="pulse-conn-form">
                <label>
                  Hospital FHIR base URL
                  <input value={fhirUrl} onChange={(e) => setFhirUrl(e.target.value)} placeholder="http://HOST:9080/fhir" />
                </label>
                <label>
                  API token <span className="pulse-muted">(optional)</span>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Bearer token if required" />
                </label>
                <button
                  type="button"
                  className="pulse-btn-dark"
                  disabled={!!busy || engineDown}
                  onClick={() => run('fhir', () => connectFhir({ name: 'Hospital FHIR', baseUrl: fhirUrl, apiKey }))}
                >
                  {busy === 'fhir' ? 'Connecting…' : 'Connect & sync FHIR'}
                </button>
              </div>
              <div className="pulse-conn-sources">
                <h3>Connected sources</h3>
                {fhirConnections.length === 0 ? (
                  <p className="pulse-muted">No FHIR source connected.</p>
                ) : (
                  fhirConnections.map((c) => (
                    <div key={c.id} className="pulse-conn-source">
                      <div>
                        <strong>{c.name}</strong>
                        <div className="pulse-conn-source-url">{c.baseUrl}</div>
                        <div className="pulse-muted">
                          {c.status}
                          {c.lastSyncAt ? ` · last sync ${new Date(c.lastSyncAt).toLocaleString()}` : ''}
                          {isFresh(c.lastSyncAt) ? ' · fresh' : ' · stale'}
                          {c.lastSyncCount != null ? ` · ${c.lastSyncCount} pts` : ''}
                        </div>
                      </div>
                      <div className="pulse-conn-source-actions">
                        <button type="button" className="pulse-ack" disabled={!!busy} onClick={() => run('sync', () => syncConnection(c.id))}>Sync</button>
                        <button type="button" className="pulse-ack" disabled={!!busy} onClick={() => run('del', () => deleteConnection(c.id))}>Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="pulse-conn-panel">
              <header className="pulse-conn-panel-head">
                <div>
                  <h2>HL7 & device ingest</h2>
                  <p>Push test messages into the Integration Engine lab.</p>
                </div>
              </header>
              <div className="pulse-conn-endpoint">
                <div className="pulse-conn-endpoint-label">Ingest endpoint</div>
                <div className="pulse-conn-endpoint-body">
                  <div><span>POST</span> {ingestUrl}</div>
                  <div><span>Auth</span> Bearer {INGEST_TOKEN}</div>
                </div>
              </div>
              <div className="pulse-conn-actions">
                <span className="pulse-conn-actions-label">Simulator tests</span>
                <div className="pulse-conn-action-row">
                  <button type="button" className="pulse-btn-dark" disabled={!!busy || engineDown} onClick={() => run('adt', () => hospitalPushHl7('ADT'))}>
                    {busy === 'adt' ? 'Sending…' : 'Push ADT'}
                  </button>
                  <button type="button" className="pulse-ack" disabled={!!busy || engineDown} onClick={() => run('oru', () => hospitalPushHl7('ORU'))}>
                    Push ORU
                  </button>
                  <button type="button" className="pulse-ack" disabled={!!busy || engineDown} onClick={() => run('dev', () => hospitalPushDevice())}>
                    Push device
                  </button>
                  <button type="button" className="pulse-ack" disabled={!!busy || engineDown} onClick={() => run('replay', () => replayBuffer())}>
                    Replay buffer
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="pulse-conn-split pulse-conn-split--tables" style={{ marginTop: '1rem' }}>
            <section className="pulse-conn-panel">
              <header className="pulse-conn-panel-head">
                <div>
                  <h2>Lab patients</h2>
                  <p>Sandbox store only — not the live ward roster.</p>
                </div>
                <span className="pulse-conn-count">{labPatients.length}</span>
              </header>
              {labPatients.length === 0 ? (
                <p className="pulse-muted">Empty until you sync FHIR or push HL7.</p>
              ) : (
                <div className="pulse-conn-table-wrap">
                  <table className="pulse-table">
                    <thead>
                      <tr>
                        <th>MRN</th>
                        <th>Name</th>
                        <th>Source</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labPatients.map((p) => (
                        <tr key={p.id || p.mrn}>
                          <td className="mono">{p.mrn || '—'}</td>
                          <td>{p.fullName || '—'}</td>
                          <td><span className="pulse-conn-tag">{p.source || '—'}</span></td>
                          <td className="mono pulse-muted">
                            {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '—'}
                            {isFresh(p.updatedAt) ? '' : ' · stale'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="pulse-conn-panel">
              <header className="pulse-conn-panel-head">
                <div>
                  <h2>Lab audit</h2>
                  <p>Recent HL7 / FHIR / buffer events.</p>
                </div>
                <span className="pulse-conn-count">{Math.min(audit.length, 20)}</span>
              </header>
              {audit.length === 0 ? (
                <p className="pulse-muted">No lab events yet.</p>
              ) : (
                <div className="pulse-conn-table-wrap">
                  <table className="pulse-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Channel</th>
                        <th>Action</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.slice(0, 20).map((a) => (
                        <tr key={a.id}>
                          <td className="mono">{a.ts ? new Date(a.ts).toLocaleTimeString() : '—'}</td>
                          <td>{a.channel || '—'}</td>
                          <td>{a.action || '—'}</td>
                          <td>
                            <span className={`pulse-conn-tag${String(a.result).toUpperCase() === 'OK' ? ' is-ok' : ''}`}>
                              {a.result || '—'}
                            </span>
                            {a.detail ? <div className="pulse-sub">{a.detail}</div> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </details>
    </div>
  );
}
