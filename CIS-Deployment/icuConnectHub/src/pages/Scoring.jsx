import { useCallback, useEffect, useMemo, useState } from 'react';
import TrendChart from '../components/TrendChart';
import {
  SCORE_TYPES,
  autofillScore,
  formatScoreValue,
  getScoreHistory,
  getScoringDashboard,
  previewScore,
  riskClass,
  saveScore,
} from '../api/scoring';

const EMPTY_INPUTS = {};

function Field({ label, name, value, onChange, type = 'number', step, min, max, hint, source }) {
  return (
    <label className="score-field">
      <span className="score-field-label">
        {label}
        {source ? <em className="score-source">{source}</em> : null}
      </span>
      {type === 'select' ? (
        <select name={name} value={value ?? ''} onChange={(e) => onChange(name, e.target.value)}>
          {hint}
        </select>
      ) : type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(name, e.target.checked)}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value ?? ''}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(name, e.target.value)}
        />
      )}
    </label>
  );
}

function ScoreFormFields({ scoreType, inputs, onChange }) {
  const set = (name, val) => onChange({ ...inputs, [name]: val });

  if (scoreType === 'NEWS2') {
    return (
      <div className="score-form-grid">
        <Field label="Resp rate (/min)" name="respRate" value={inputs.respRate} onChange={set} />
        <Field label="SpO₂ (%)" name="spo2" value={inputs.spo2} onChange={set} />
        <Field label="Supplemental O₂" name="supplementalOxygen" type="checkbox" value={inputs.supplementalOxygen} onChange={set} />
        <Field label="Hypercapnic resp. failure" name="hypercapnicRespFailure" type="checkbox" value={inputs.hypercapnicRespFailure} onChange={set} />
        <Field label="Temperature (°C)" name="temperature" value={inputs.temperature} onChange={set} step="0.1" />
        <Field label="Systolic BP (mmHg)" name="systolicBp" value={inputs.systolicBp} onChange={set} />
        <Field label="Pulse (/min)" name="pulse" value={inputs.pulse} onChange={set} />
        <Field
          label="Consciousness"
          name="consciousness"
          type="select"
          value={inputs.consciousness || 'ALERT'}
          onChange={set}
          hint={(
            <>
              <option value="ALERT">Alert</option>
              <option value="VOICE">Responds to voice</option>
              <option value="PAIN">Responds to pain</option>
              <option value="UNRESPONSIVE">Unresponsive</option>
            </>
          )}
        />
      </div>
    );
  }

  if (scoreType === 'SOFA') {
    return (
      <div className="score-form-grid">
        <Field label="PaO₂/FiO₂ ratio" name="pao2fio2Ratio" value={inputs.pao2fio2Ratio} onChange={set} />
        <Field label="PaO₂ (mmHg)" name="pao2" value={inputs.pao2} onChange={set} />
        <Field label="FiO₂ (%)" name="fio2" value={inputs.fio2} onChange={set} />
        <Field label="Platelets (10³/µL)" name="platelets" value={inputs.platelets} onChange={set} />
        <Field label="Bilirubin (mg/dL)" name="bilirubin" value={inputs.bilirubin} onChange={set} step="0.1" />
        <Field label="MAP (mmHg)" name="map" value={inputs.map} onChange={set} />
        <Field label="GCS (manual)" name="gcs" value={inputs.gcs} onChange={set} min="3" max="15" />
        <Field label="Creatinine (mg/dL)" name="creatinine" value={inputs.creatinine} onChange={set} step="0.1" />
        <Field label="Urine output ml/day" name="urineOutputMlDay" value={inputs.urineOutputMlDay} onChange={set} />
      </div>
    );
  }

  if (scoreType === 'APACHE_II') {
    return (
      <div className="score-form-grid">
        <Field label="Age (years)" name="age" value={inputs.age} onChange={set} />
        <Field
          label="Chronic health"
          name="chronicOrgan"
          type="select"
          value={inputs.chronicOrgan || 'NONE'}
          onChange={set}
          hint={(
            <>
              <option value="NONE">None / not applicable</option>
              <option value="ELECTIVE_POSTOP">Elective post-op</option>
              <option value="EMERGENCY_NONOP">Emergency non-operative</option>
            </>
          )}
        />
        <Field label="Temperature (°C)" name="temperature" value={inputs.temperature} onChange={set} step="0.1" />
        <Field label="MAP (mmHg)" name="map" value={inputs.map} onChange={set} />
        <Field label="Heart rate" name="heartRate" value={inputs.heartRate} onChange={set} />
        <Field label="Resp rate" name="respRate" value={inputs.respRate} onChange={set} />
        <Field label="PaO₂ (mmHg)" name="pao2" value={inputs.pao2} onChange={set} />
        <Field label="FiO₂ (%)" name="fio2" value={inputs.fio2} onChange={set} />
        <Field label="pH" name="ph" value={inputs.ph} onChange={set} step="0.01" />
        <Field label="Sodium" name="sodium" value={inputs.sodium} onChange={set} />
        <Field label="Potassium" name="potassium" value={inputs.potassium} onChange={set} step="0.1" />
        <Field label="Creatinine" name="creatinine" value={inputs.creatinine} onChange={set} step="0.1" />
        <Field label="Acute renal failure" name="acuteRenalFailure" type="checkbox" value={inputs.acuteRenalFailure} onChange={set} />
        <Field label="Hematocrit (%)" name="hematocrit" value={inputs.hematocrit} onChange={set} />
        <Field label="WBC (10³/µL)" name="wbc" value={inputs.wbc} onChange={set} step="0.1" />
        <Field label="GCS (manual)" name="gcs" value={inputs.gcs} onChange={set} min="3" max="15" />
      </div>
    );
  }

  if (scoreType === 'RASS') {
    return (
      <div className="score-form-grid">
        <Field
          label="RASS level"
          name="rassLevel"
          type="select"
          value={inputs.rassLevel ?? '0'}
          onChange={set}
          hint={(
            <>
              <option value="4">+4 Combative</option>
              <option value="3">+3 Very agitated</option>
              <option value="2">+2 Agitated</option>
              <option value="1">+1 Restless</option>
              <option value="0">0 Alert and calm</option>
              <option value="-1">-1 Drowsy</option>
              <option value="-2">-2 Light sedation</option>
              <option value="-3">-3 Moderate sedation</option>
              <option value="-4">-4 Deep sedation</option>
              <option value="-5">-5 Unarousable</option>
            </>
          )}
        />
      </div>
    );
  }

  if (scoreType === 'CAM_ICU') {
    return (
      <div className="score-form-grid">
        <Field label="RASS level" name="rassLevel" value={inputs.rassLevel ?? 0} onChange={set} min="-5" max="4" />
        <Field label="Acute mental status change" name="acuteMentalStatusChange" type="checkbox" value={inputs.acuteMentalStatusChange} onChange={set} />
        <Field label="Inattention" name="inattention" type="checkbox" value={inputs.inattention} onChange={set} />
        <Field label="Altered consciousness" name="alteredConsciousness" type="checkbox" value={inputs.alteredConsciousness} onChange={set} />
        <Field label="Disorganized thinking" name="disorganizedThinking" type="checkbox" value={inputs.disorganizedThinking} onChange={set} />
        <Field label="Command errors" name="commandErrors" value={inputs.commandErrors ?? 0} onChange={set} min="0" />
      </div>
    );
  }

  return null;
}

export default function Scoring() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [historyType, setHistoryType] = useState('NEWS2');
  const [history, setHistory] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPatient, setModalPatient] = useState(null);
  const [scoreType, setScoreType] = useState('NEWS2');
  const [inputs, setInputs] = useState(EMPTY_INPUTS);
  const [sources, setSources] = useState({});
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getScoringDashboard();
      setRows(data);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const loadHistory = useCallback(async (visitId, type) => {
    if (!visitId) return;
    try {
      const data = await getScoreHistory(visitId, type);
      setHistory(data);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (selectedVisit) loadHistory(selectedVisit, historyType);
  }, [selectedVisit, historyType, loadHistory]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.visitId === selectedVisit) || null,
    [rows, selectedVisit]
  );

  const chartSeries = useMemo(
    () => history.map((h) => ({
      timestamp: h.calculatedAt,
      value: Number(h.totalScore),
    })),
    [history]
  );

  function openModal(patient) {
    setModalPatient(patient);
    setScoreType('NEWS2');
    setInputs(EMPTY_INPUTS);
    setSources({});
    setPreview(null);
    setNotes('');
    setModalOpen(true);
  }

  async function handleAutofill() {
    if (!modalPatient) return;
    try {
      const data = await autofillScore(modalPatient.visitId, scoreType);
      setInputs(data.fields || {});
      setSources(data.sources || {});
      setPreview(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handlePreview() {
    if (!modalPatient) return;
    try {
      const result = await previewScore(modalPatient.visitId, scoreType, inputs);
      setPreview(result);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSave() {
    if (!modalPatient) return;
    setSaving(true);
    setError(null);
    try {
      await saveScore(modalPatient.visitId, scoreType, { inputs, notes, source: 'MIXED' });
      setModalOpen(false);
      await loadDashboard();
      if (selectedVisit === modalPatient.visitId) {
        await loadHistory(modalPatient.visitId, historyType);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function onScoreTypeChange(type) {
    setScoreType(type);
    setInputs(EMPTY_INPUTS);
    setSources({});
    setPreview(null);
  }

  return (
    <div className="scoring-page">
      <header className="scoring-header">
        <div>
          <h1>Clinical Scoring</h1>
          <p className="scoring-sub">NEWS2 · SOFA · APACHE II · RASS · CAM-ICU — latest per patient with history trends</p>
        </div>
      </header>

      {error ? <div className="scoring-error">{error}</div> : null}

      <section className="card scoring-dashboard">
        <h2>Latest scores — occupied beds</h2>
        {loading ? <p>Loading…</p> : (
          <div className="scoring-table-wrap">
            <table className="scoring-table">
              <thead>
                <tr>
                  <th>Bed</th>
                  <th>Patient</th>
                  <th>MRN</th>
                  {SCORE_TYPES.map((t) => <th key={t.id}>{t.label}</th>)}
                  <th className="scoring-actions-head">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.visitId}
                    className={selectedVisit === row.visitId ? 'is-selected' : ''}
                    onClick={() => setSelectedVisit(row.visitId)}
                  >
                    <td>{row.bedLabel}</td>
                    <td>{row.patientName}</td>
                    <td>{row.mrn}</td>
                    {SCORE_TYPES.map((t) => {
                      const s = row.latestScores?.[t.id];
                      return (
                        <td key={t.id}>
                          {s ? (
                            <span className={`score-pill ${riskClass(s.riskLevel)}`} title={s.interpretation}>
                              {formatScoreValue(t.id, s.totalScore)}
                            </span>
                          ) : '—'}
                        </td>
                      );
                    })}
                    <td className="scoring-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary scoring-score-btn"
                        onClick={(e) => { e.stopPropagation(); openModal(row); }}
                      >
                        Score
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr><td colSpan={SCORE_TYPES.length + 4}>No occupied beds</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRow ? (
        <section className="card scoring-history">
          <div className="scoring-history-head">
            <h2>
              History — {selectedRow.patientName}
              <span className="scoring-bed">Bed {selectedRow.bedLabel}</span>
            </h2>
            <div className="scoring-type-tabs">
              {SCORE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`score-type-tab${historyType === t.id ? ' is-active' : ''}`}
                  onClick={() => setHistoryType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {chartSeries.length > 1 ? (
            <div className="scoring-chart">
              <TrendChart series={chartSeries} paramName="Score" color="#6366f1" height={160} />
            </div>
          ) : null}

          <div className="scoring-history-list">
            {history.length ? history.slice().reverse().map((h) => (
              <div key={h.id} className="scoring-history-item">
                <div className="scoring-history-meta">
                  <strong className={`score-pill ${riskClass(h.riskLevel)}`}>
                    {formatScoreValue(h.scoreType, h.totalScore)}
                  </strong>
                  <span>{new Date(h.calculatedAt).toLocaleString()}</span>
                </div>
                <p>{h.interpretation}</p>
                {h.notes ? <p className="scoring-note">{h.notes}</p> : null}
              </div>
            )) : <p className="scoring-empty">No saved scores for this type yet.</p>}
          </div>
        </section>
      ) : (
        <section className="card scoring-history scoring-history--placeholder">
          <p>Select a patient row above to view score history and trend.</p>
        </section>
      )}

      {modalOpen && modalPatient ? (
        <div className="score-modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="score-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="score-modal-head">
              <div>
                <h3>Add score — {modalPatient.patientName}</h3>
                <p>Bed {modalPatient.bedLabel} · {modalPatient.mrn}</p>
              </div>
              <button type="button" className="order-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </header>

            <div className="score-type-pick">
              {SCORE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`score-type-btn${scoreType === t.id ? ' is-active' : ''}`}
                  onClick={() => onScoreTypeChange(t.id)}
                  title={t.desc}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {scoreType === 'APACHE_II' && modalPatient.admittedAt ? (
              <p className="score-hint">
                APACHE II is limited to the first 24 hours after ICU admission (
                {new Date(modalPatient.admittedAt).toLocaleString()}
                ).
              </p>
            ) : null}

            <div className="score-modal-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={handleAutofill}>
                Autofill from vitals &amp; labs
              </button>
            </div>

            <ScoreFormFields scoreType={scoreType} inputs={inputs} onChange={setInputs} />

            <label className="score-field score-field--full">
              <span className="score-field-label">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>

            {preview ? (
              <div className={`score-preview ${riskClass(preview.riskLevel)}`}>
                <strong>Preview: {formatScoreValue(scoreType, preview.totalScore)}</strong>
                <span>{preview.interpretation}</span>
              </div>
            ) : null}

            <footer className="score-modal-foot">
              <button type="button" className="btn btn-outline btn-sm" onClick={handlePreview}>Calculate</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save score'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
