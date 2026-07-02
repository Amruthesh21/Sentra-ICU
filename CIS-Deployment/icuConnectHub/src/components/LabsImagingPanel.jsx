import { useEffect, useRef, useState } from 'react';
import { createImaging, createLab, listLabsImaging, parseClinicalOcr } from '../api/clinical';

function formatDt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const EMPTY_LAB = { testName: '', value: '', unit: '', referenceRange: '', flag: 'NORMAL' };
const EMPTY_IMG = { modality: 'X-RAY', studyName: '', findings: '', impression: '' };

export default function LabsImagingPanel({ visitId }) {
  const [labs, setLabs] = useState([]);
  const [imaging, setImaging] = useState([]);
  const [labForm, setLabForm] = useState(EMPTY_LAB);
  const [imgForm, setImgForm] = useState(EMPTY_IMG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [extractedLabs, setExtractedLabs] = useState([]);
  const fileRef = useRef(null);

  async function refresh() {
    if (!visitId) return;
    setLoading(true);
    try {
      const data = await listLabsImaging(visitId);
      setLabs(data.labs || []);
      setImaging(data.imaging || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [visitId]);

  function applyLab(lab) {
    setLabForm({
      testName: lab.testName || '',
      value: lab.value || '',
      unit: lab.unit || '',
      referenceRange: lab.referenceRange || '',
      flag: lab.flag || 'NORMAL',
    });
  }

  function applyImaging(img) {
    if (!img) return;
    setImgForm({
      modality: img.modality || 'X-RAY',
      studyName: img.studyName || '',
      findings: img.findings || '',
      impression: img.impression || '',
    });
  }

  async function handleOcrFile(file) {
    if (!file) return;
    setOcrLoading(true);
    setError(null);
    setOcrResult(null);
    try {
      const result = await parseClinicalOcr(file);
      setOcrResult(result);
      const foundLabs = result.labs || [];
      setExtractedLabs(foundLabs);

      if (foundLabs.length > 0) {
        applyLab(foundLabs[0]);
      }
      if (result.imaging) {
        applyImaging(result.imaging);
      }
      if (foundLabs.length === 0 && !result.imaging) {
        setError('OCR completed but could not map fields — review raw text below and edit manually.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setOcrLoading(false);
    }
  }

  async function saveAllExtractedLabs() {
    if (!visitId || extractedLabs.length === 0) return;
    setError(null);
    try {
      for (const lab of extractedLabs) {
        await createLab(visitId, lab);
      }
      setExtractedLabs([]);
      setLabForm(EMPTY_LAB);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitLab(e) {
    e.preventDefault();
    if (!labForm.testName.trim()) return;
    setError(null);
    try {
      await createLab(visitId, labForm);
      setLabForm(EMPTY_LAB);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitImaging(e) {
    e.preventDefault();
    if (!imgForm.studyName.trim()) return;
    setError(null);
    try {
      await createImaging(visitId, imgForm);
      setImgForm(EMPTY_IMG);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!visitId) {
    return <div className="empty-state glass-card"><p>Admit a patient to record labs &amp; imaging.</p></div>;
  }

  return (
    <div className="clinical-panel">
      <h3>Labs &amp; Imaging</h3>
      {error && <div className="message error">{error}</div>}

      <div
        className={`ocr-upload-zone glass-card${ocrLoading ? ' ocr-upload-zone--busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ocr-upload-zone--hover'); }}
        onDragLeave={(e) => e.currentTarget.classList.remove('ocr-upload-zone--hover')}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('ocr-upload-zone--hover');
          const file = e.dataTransfer.files?.[0];
          if (file) handleOcrFile(file);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,image/*,application/pdf"
          hidden
          onChange={(e) => handleOcrFile(e.target.files?.[0])}
        />
        <div className="ocr-upload-inner">
          <strong>Upload lab report or imaging document</strong>
          <p className="muted">PDF, photo, or scan — OCR extracts values and fills the form automatically</p>
          <button type="button" className="btn btn-primary" disabled={ocrLoading} onClick={() => fileRef.current?.click()}>
            {ocrLoading ? 'Reading document…' : 'Choose file / Take photo'}
          </button>
        </div>
        {ocrResult && (
          <div className="ocr-result-banner">
            <span>
              Detected: <strong>{ocrResult.documentType}</strong>
              {extractedLabs.length > 0 && ` · ${extractedLabs.length} lab result(s)`}
              {ocrResult.imaging && ' · imaging report'}
            </span>
            {extractedLabs.length > 1 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={saveAllExtractedLabs}>
                Save all {extractedLabs.length} labs
              </button>
            )}
          </div>
        )}
        {ocrResult?.rawText && (
          <details className="ocr-raw-text">
            <summary>View OCR raw text</summary>
            <pre>{ocrResult.rawText}</pre>
          </details>
        )}
      </div>

      {extractedLabs.length > 1 && (
        <div className="ocr-lab-pills">
          {extractedLabs.map((lab, i) => (
            <button key={`${lab.testName}-${i}`} type="button" className="ocr-lab-pill" onClick={() => applyLab(lab)}>
              {lab.testName}: {lab.value}{lab.unit ? ` ${lab.unit}` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="clinical-dual-grid">
        <div>
          <h4 className="clinical-subhead">Lab results</h4>
          <form className="glass-card clinical-form" onSubmit={submitLab}>
            <div className="form-grid two-col">
              <div className="form-group">
                <label>Test</label>
                <input required value={labForm.testName} onChange={(e) => setLabForm({ ...labForm, testName: e.target.value })} placeholder="Hb, WBC, Creatinine" />
              </div>
              <div className="form-group">
                <label>Value</label>
                <input value={labForm.value} onChange={(e) => setLabForm({ ...labForm, value: e.target.value })} placeholder="12.5" />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input value={labForm.unit} onChange={(e) => setLabForm({ ...labForm, unit: e.target.value })} placeholder="g/dL" />
              </div>
              <div className="form-group">
                <label>Reference</label>
                <input value={labForm.referenceRange} onChange={(e) => setLabForm({ ...labForm, referenceRange: e.target.value })} placeholder="12-16" />
              </div>
              <div className="form-group">
                <label>Flag</label>
                <select value={labForm.flag} onChange={(e) => setLabForm({ ...labForm, flag: e.target.value })}>
                  <option>NORMAL</option>
                  <option>HIGH</option>
                  <option>LOW</option>
                  <option>CRITICAL</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Add lab result</button>
          </form>

          <div className="clinical-table-wrap">
            <table className="clinical-table">
              <thead>
                <tr><th>Time</th><th>Test</th><th>Result</th><th>Ref</th><th>Flag</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
                {!loading && labs.length === 0 && <tr><td colSpan={5} className="muted">No lab results.</td></tr>}
                {labs.map((l) => (
                  <tr key={l.labId}>
                    <td className="num">{formatDt(l.resultedAt)}</td>
                    <td>{l.testName}</td>
                    <td className="num">{l.value}{l.unit ? ` ${l.unit}` : ''}</td>
                    <td className="num">{l.referenceRange || '—'}</td>
                    <td><span className={`flag-pill flag-${(l.flag || 'normal').toLowerCase()}`}>{l.flag || 'NORMAL'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="clinical-subhead">Imaging studies</h4>
          <form className="glass-card clinical-form" onSubmit={submitImaging}>
            <div className="form-grid two-col">
              <div className="form-group">
                <label>Modality</label>
                <select value={imgForm.modality} onChange={(e) => setImgForm({ ...imgForm, modality: e.target.value })}>
                  <option>X-RAY</option>
                  <option>CT</option>
                  <option>MRI</option>
                  <option>US</option>
                </select>
              </div>
              <div className="form-group">
                <label>Study</label>
                <input required value={imgForm.studyName} onChange={(e) => setImgForm({ ...imgForm, studyName: e.target.value })} placeholder="Chest PA" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Findings</label>
                <textarea rows={3} value={imgForm.findings} onChange={(e) => setImgForm({ ...imgForm, findings: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Impression</label>
                <textarea rows={2} value={imgForm.impression} onChange={(e) => setImgForm({ ...imgForm, impression: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Add imaging study</button>
          </form>

          <div className="clinical-table-wrap">
            <table className="clinical-table">
              <thead>
                <tr><th>Time</th><th>Modality</th><th>Study</th><th>Impression</th></tr>
              </thead>
              <tbody>
                {!loading && imaging.length === 0 && <tr><td colSpan={4} className="muted">No imaging studies.</td></tr>}
                {imaging.map((s) => (
                  <tr key={s.imagingId}>
                    <td>{formatDt(s.studyAt)}</td>
                    <td>{s.modality}</td>
                    <td>{s.studyName}</td>
                    <td>{s.impression || s.findings || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
