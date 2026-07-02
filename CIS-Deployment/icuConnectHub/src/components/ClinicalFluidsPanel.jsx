import { useEffect, useMemo, useState } from 'react';
import { createFluidEntry, deleteFluidEntry, listFluidEntries, stopFluidEntry } from '../api/clinical';

const INTAKE_CATEGORIES = [
  'Infusions', 'Fluids', 'Blood Products', 'Oral Intakes',
  'Stat Medication', 'Prn Medication', 'Oral Medication', 'Other',
];

const OUTPUT_CATEGORIES = [
  'Urine Output', 'Drainage Output', 'Other',
];

function formatDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function toLocalInputValue(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function effectiveVolumeMl(entry, asOf = Date.now()) {
  if (entry.intakeMode !== 'RUNNING') return Number(entry.volumeMl || 0);
  if (entry.runningStatus === 'STOPPED') return Number(entry.volumeMl || 0);
  const rate = Number(entry.rateMlPerHr || 0);
  const start = new Date(entry.startedAt || entry.recordedAt).getTime();
  const minutes = Math.floor((asOf - start) / 60000);
  return (rate / 60) * Math.max(0, minutes);
}

const EMPTY = {
  entryType: 'INTAKE',
  intakeMode: 'ONE_TIME',
  category: 'Fluids',
  fluidName: '',
  volumeMl: '',
  rateMlPerHr: '',
  recordedAt: toLocalInputValue(),
  notes: '',
};

function TypeBadge({ type }) {
  const intake = type === 'INTAKE';
  return (
    <span className={`fluids-type-badge ${intake ? 'is-intake' : 'is-output'}`}>
      {intake ? 'Intake' : 'Output'}
    </span>
  );
}

function RunningBadge({ entry }) {
  if (entry.intakeMode !== 'RUNNING') return null;
  const active = entry.runningStatus === 'ACTIVE';
  return (
    <span className={`fluids-running-badge${active ? ' is-active' : ''}`}>
      {active ? 'Running' : 'Stopped'}
    </span>
  );
}

export default function ClinicalFluidsPanel({ visitId, bedLabel }) {
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const categories = draft.entryType === 'OUTPUT' ? OUTPUT_CATEGORIES : INTAKE_CATEGORIES;
  const isIntake = draft.entryType === 'INTAKE';
  const isRunning = isIntake && draft.intakeMode === 'RUNNING';

  async function refresh() {
    if (!visitId) return;
    setLoading(true);
    try {
      const list = await listFluidEntries(visitId);
      setEntries(list);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [visitId]);

  const hasActiveRunning = useMemo(
    () => entries.some((e) => e.intakeMode === 'RUNNING' && e.runningStatus === 'ACTIVE'),
    [entries],
  );

  useEffect(() => {
    if (!hasActiveRunning) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [hasActiveRunning]);

  const { intakeTotal, outputTotal, balance } = useMemo(() => {
    const intake = entries
      .filter((e) => e.entryType === 'INTAKE')
      .reduce((s, e) => s + effectiveVolumeMl(e), 0);
    const output = entries
      .filter((e) => e.entryType === 'OUTPUT')
      .reduce((s, e) => s + Number(e.volumeMl || 0), 0);
    return { intakeTotal: intake, outputTotal: output, balance: intake - output };
  }, [entries, tick]);

  function handleTypeChange(entryType) {
    const nextCategories = entryType === 'OUTPUT' ? OUTPUT_CATEGORIES : INTAKE_CATEGORIES;
    setDraft((prev) => ({
      ...prev,
      entryType,
      intakeMode: entryType === 'INTAKE' ? prev.intakeMode : 'ONE_TIME',
      category: nextCategories.includes(prev.category) ? prev.category : nextCategories[0],
    }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!visitId || !draft.fluidName) return;
    if (isRunning) {
      if (!draft.rateMlPerHr) return;
    } else if (!draft.volumeMl) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        entryType: draft.entryType,
        category: draft.category,
        fluidName: draft.fluidName,
        recordedAt: new Date(draft.recordedAt).toISOString(),
        bedLabel,
        recordedBy: 'Nursing',
        notes: draft.notes,
      };

      if (isRunning) {
        payload.intakeMode = 'RUNNING';
        payload.rateMlPerHr = Number(draft.rateMlPerHr);
      } else {
        payload.intakeMode = 'ONE_TIME';
        payload.volumeMl = Number(draft.volumeMl);
      }

      await createFluidEntry(visitId, payload);
      setDraft({ ...EMPTY, recordedAt: toLocalInputValue() });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStop(entryId) {
    try {
      await stopFluidEntry(entryId);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(entryId) {
    if (!window.confirm('Remove this fluid entry?')) return;
    try {
      await deleteFluidEntry(entryId);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!visitId) {
    return <div className="empty-state glass-card"><p>Admit a patient to chart fluids.</p></div>;
  }

  return (
    <div className="clinical-panel fluids-panel">
      <div className="clinical-panel-head">
        <div>
          <h3>Fluid balance &amp; I/O charting</h3>
          <p className="clinical-subhead muted">
            Manual intake and output entries for this admission. Device infusion totals appear in reports automatically.
          </p>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="fluids-summary-grid">
        <div className="fluids-stat-card is-intake">
          <span className="fluids-stat-label">Total intake</span>
          <span className="fluids-stat-value">{intakeTotal.toFixed(2)} <small>ml</small></span>
        </div>
        <div className="fluids-stat-card is-output">
          <span className="fluids-stat-label">Total output</span>
          <span className="fluids-stat-value">{outputTotal.toFixed(2)} <small>ml</small></span>
        </div>
        <div className={`fluids-stat-card is-balance${balance < 0 ? ' is-negative' : ''}`}>
          <span className="fluids-stat-label">Balance</span>
          <span className="fluids-stat-value">{balance.toFixed(2)} <small>ml</small></span>
        </div>
      </div>

      <form className="glass-card clinical-form fluids-form" onSubmit={handleAdd}>
        <h4 className="fluids-section-title">Add fluid entry</h4>
        <div className="form-grid fluids-form-grid">
          <div className="form-group">
            <label>Type</label>
            <select value={draft.entryType} onChange={(ev) => handleTypeChange(ev.target.value)}>
              <option value="INTAKE">Intake</option>
              <option value="OUTPUT">Output</option>
            </select>
          </div>

          {isIntake && (
            <div className="form-group fluids-intake-mode-group">
              <label>Intake mode</label>
              <div className="fluids-mode-toggle" role="group" aria-label="Intake mode">
                <button
                  type="button"
                  className={`fluids-mode-btn${draft.intakeMode === 'ONE_TIME' ? ' is-active' : ''}`}
                  onClick={() => setDraft((prev) => ({ ...prev, intakeMode: 'ONE_TIME' }))}
                >
                  One time
                </button>
                <button
                  type="button"
                  className={`fluids-mode-btn${draft.intakeMode === 'RUNNING' ? ' is-active' : ''}`}
                  onClick={() => setDraft((prev) => ({ ...prev, intakeMode: 'RUNNING' }))}
                >
                  Running
                </button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Category</label>
            <select value={draft.category} onChange={(ev) => setDraft({ ...draft, category: ev.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fluid / output name</label>
            <input
              value={draft.fluidName}
              onChange={(ev) => setDraft({ ...draft, fluidName: ev.target.value })}
              placeholder={draft.entryType === 'OUTPUT' ? 'e.g. Urine' : 'e.g. 10% Dextrose'}
              required
            />
          </div>

          {isRunning ? (
            <div className="form-group">
              <label>Rate (ml/hr)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.rateMlPerHr}
                onChange={(ev) => setDraft({ ...draft, rateMlPerHr: ev.target.value })}
                placeholder="e.g. 60"
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Volume (ml)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.volumeMl}
                onChange={(ev) => setDraft({ ...draft, volumeMl: ev.target.value })}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>{isRunning ? 'Start time' : 'Recorded at'}</label>
            <input
              type="datetime-local"
              value={draft.recordedAt}
              onChange={(ev) => setDraft({ ...draft, recordedAt: ev.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input
              value={draft.notes}
              onChange={(ev) => setDraft({ ...draft, notes: ev.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>
        {isRunning && (
          <p className="fluids-running-hint muted">
            Volume accrues every minute at rate ÷ 60 (e.g. 60 ml/hr adds 1 ml per minute). Use Stop when the infusion ends.
          </p>
        )}
        <div className="fluids-form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isRunning ? 'Start intake' : 'Add entry'}
          </button>
        </div>
      </form>

      <div className="glass-card fluids-entries-card">
        <div className="fluids-entries-head">
          <h4 className="fluids-section-title">Charted entries</h4>
          {!loading && entries.length > 0 && (
            <span className="fluids-entry-count">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
          )}
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="fluids-empty">
            <p>No manual fluid entries yet.</p>
            <p className="muted">Device infusion volumes are included in reports automatically.</p>
          </div>
        ) : (
          <div className="clinical-table-wrap">
            <table className="clinical-table fluids-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Name</th>
                  <th>Volume / rate</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const running = row.intakeMode === 'RUNNING';
                  const active = running && row.runningStatus === 'ACTIVE';
                  const vol = effectiveVolumeMl(row);
                  return (
                    <tr key={row.entryId} className={active ? 'fluids-row-running' : ''}>
                      <td className="fluids-time-cell">
                        {formatDt(running ? (row.startedAt || row.recordedAt) : row.recordedAt)}
                        {running && row.stoppedAt && (
                          <div className="fluids-stopped-at muted">Stopped {formatDt(row.stoppedAt)}</div>
                        )}
                      </td>
                      <td>
                        <TypeBadge type={row.entryType} />
                        <RunningBadge entry={row} />
                      </td>
                      <td>{row.category}</td>
                      <td>{row.fluidName}</td>
                      <td className="fluids-volume-cell">
                        {running ? (
                          <>
                            <span className="num">{vol.toFixed(2)} ml</span>
                            <div className="fluids-rate-line muted">
                              @ <span className="num">{Number(row.rateMlPerHr).toFixed(2)}</span> ml/hr
                              {active && <span className="fluids-live-dot" title="Accruing">●</span>}
                            </div>
                          </>
                        ) : (
                          <span className="num">{Number(row.volumeMl).toFixed(2)} {row.unit || 'ml'}</span>
                        )}
                      </td>
                      <td className="fluids-notes-cell">{row.notes || '—'}</td>
                      <td className="fluids-actions-cell">
                        {active && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary fluids-stop-btn"
                            onClick={() => handleStop(row.entryId)}
                          >
                            Stop
                          </button>
                        )}
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => handleDelete(row.entryId)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
