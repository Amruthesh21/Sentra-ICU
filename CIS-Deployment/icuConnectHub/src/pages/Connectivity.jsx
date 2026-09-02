import { useMemo } from 'react';
import { useLiveWard } from '../hooks/useLiveWard';

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
  if (bed.hasVitals) return 'CACHED';
  return 'NO FEED';
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
  } = useLiveWard({ pollMs: 3000 });

  const liveFeeds = useMemo(
    () => beds.filter((b) => b.simulatorConnected || b.liveVitalsCapable),
    [beds],
  );
  const streamingOccupied = useMemo(
    () => occupied.filter((b) => b.hasVitals),
    [occupied],
  );

  const channels = useMemo(() => [
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
      key: 'alarms',
      title: 'Alarm feed',
      detail: `${alerts.length} active`,
      on: true,
    },
    {
      key: 'hub',
      title: 'Alarm hub',
      detail: wardError ? 'Unreachable' : `${centerName} · ${stats.bedCount} beds`,
      on: !wardError && !loading,
    },
  ], [liveFeeds, streamingOccupied, occupied, alerts, wardError, loading, centerName, stats.bedCount]);

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

      {!wardError && (
        <div className="pulse-conn-statusline">
          <span className="pulse-conn-dot" />
          <span>
            <strong>{centerName}</strong>
            {' · '}{liveChannels}/{channels.length} channels active
            {' · '}{liveFeeds.length} Connect Engine
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
                          {b.simulatorConnected ? 'Connected' : 'Idle'}
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
    </div>
  );
}
