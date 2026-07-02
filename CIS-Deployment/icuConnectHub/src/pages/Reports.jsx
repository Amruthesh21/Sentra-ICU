import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReportPreview from '../components/ReportPreview';
import { generateReport, listReportPatients } from '../api/reports';
import { listUnits } from '../api/units';
import { getVitalsHistory, trendParamNames } from '../api/hub';
import { downloadReportCsv, downloadReportPdf } from '../utils/reportExport';
const REPORT_TYPES = [
  { id: 'CLINICAL_SUMMARY', label: 'Clinical Summary' },
  { id: 'COMPLETE_PATIENT', label: 'Complete Patient Report (day-by-day)' },
  { id: 'OPERATIONAL_REPORT', label: 'Operational Report' },
  { id: 'COMPLIANCE_REPORT', label: 'Compliance Report' },
];

const DEFAULT_VITALS = [
  'HeartRate', 'SpO2', 'Resp.Rate', 'Temp1', 'PEEP', 'MV', 'Peak', 'VT',
  'Inf Rate', 'Inf Vol', 'Bolus Vol', 'Bolus Rate',
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const [units, setUnits] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [patientCohort, setPatientCohort] = useState('current');
  const [patients, setPatients] = useState([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [reportType, setReportType] = useState('COMPLETE_PATIENT');
  const [fromDate, setFromDate] = useState(daysAgoIso(6));
  const [toDate, setToDate] = useState(todayIso());
  const [vitalsParams, setVitalsParams] = useState([...DEFAULT_VITALS]);
  const [availableVitals, setAvailableVitals] = useState(DEFAULT_VITALS);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState('PDF');
  const [pdfPageSize, setPdfPageSize] = useState('landscape');
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    listUnits().then(setUnits).catch(() => setUnits([]));
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const unitId = selectedUnits.length === 1 ? selectedUnits[0] : null;
      const list = await listReportPatients(unitId, { discharged: patientCohort === 'discharged' });
      setPatients(list);
    } catch {
      setPatients([]);
    }
  }, [selectedUnits, patientCohort]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.patientName?.toLowerCase().includes(q) || p.mrn?.toLowerCase().includes(q)
    );
  }, [patients, patientQuery]);

  useEffect(() => {
    if (!selectedPatient?.bedId) {
      setAvailableVitals(DEFAULT_VITALS);
      return;
    }
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    getVitalsHistory(selectedPatient.bedId, { from, to })
      .then((h) => {
        const names = trendParamNames(h.series || h);
        setAvailableVitals(names.length ? names : DEFAULT_VITALS);
      })
      .catch(() => setAvailableVitals(DEFAULT_VITALS));
  }, [selectedPatient?.bedId]);

  useEffect(() => {
    if (selectedPatient?.admittedAt) {
      const admit = selectedPatient.admittedAt.slice(0, 10);
      const end = selectedPatient.dischargedAt
        ? selectedPatient.dischargedAt.slice(0, 10)
        : todayIso();
      setFromDate(admit);
      setToDate(end);
    }
  }, [selectedPatient?.visitId]);

  function toggleUnit(id) {
    setSelectedUnits((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  }

  function toggleVital(name) {
    setVitalsParams((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]));
  }

  async function handleGenerate() {
    if (!selectedPatient) {
      setError('Select a patient');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        visitId: selectedPatient.visitId,
        reportType,
        fromDate: reportType === 'COMPLETE_PATIENT' ? undefined : fromDate,
        toDate: reportType === 'COMPLETE_PATIENT' ? undefined : toDate,
        vitalsParams: vitalsParams.length ? vitalsParams : DEFAULT_VITALS,
      };
      const data = await generateReport(payload);
      setReport(data);
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!report) return;
    if (downloadFormat === 'PDF') {
      setDownloading(true);
      setError(null);
      try {
        await downloadReportPdf({ pageSize: pdfPageSize, fileName: report.fileName });
      } catch (e) {
        setError(e.message || 'PDF download failed');
      } finally {
        setDownloading(false);
      }
      return;
    }
    downloadReportCsv(report);
  }

  const canDownload = Boolean(report) && !downloading;

  return (
    <div className="reports-page">
      <div className="reports-layout">
        <aside className="reports-params glass-card">
          <h2>Report Parameters</h2>

          <fieldset className="report-fieldset">
            <legend>Select Report Type</legend>
            {REPORT_TYPES.map((t) => (
              <label key={t.id} className="report-radio">
                <input
                  type="radio"
                  name="reportType"
                  checked={reportType === t.id}
                  onChange={() => setReportType(t.id)}
                />
                {t.label}
              </label>
            ))}
          </fieldset>

          {reportType !== 'COMPLETE_PATIENT' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          )}

          {reportType === 'COMPLETE_PATIENT' && selectedPatient && (
            <p className="muted report-hint">
              Full stay report from admission ({selectedPatient.admittedAt?.slice(0, 10)})
              {selectedPatient.dischargedAt
                ? ` through discharge (${selectedPatient.dischargedAt.slice(0, 10)})`
                : ' through today'}
              — one section per ICU day.
            </p>
          )}

          <fieldset className="report-fieldset">
            <legend>Patient cohort</legend>
            <label className="report-radio">
              <input
                type="radio"
                name="cohort"
                checked={patientCohort === 'current'}
                onChange={() => { setPatientCohort('current'); setSelectedPatient(null); setReport(null); }}
              />
              Current in-unit patients
            </label>
            <label className="report-radio">
              <input
                type="radio"
                name="cohort"
                checked={patientCohort === 'discharged'}
                onChange={() => { setPatientCohort('discharged'); setSelectedPatient(null); setReport(null); }}
              />
              Discharged patient records
            </label>
          </fieldset>

          <fieldset className="report-fieldset">
            <legend>Select Units</legend>
            {units.length === 0 ? <p className="muted">All units</p> : units.map((u) => (
              <label key={u.unitId} className="report-check">
                <input
                  type="checkbox"
                  checked={selectedUnits.includes(u.unitId)}
                  onChange={() => toggleUnit(u.unitId)}
                />
                {u.name || u.code}
              </label>
            ))}
          </fieldset>

          <div className="form-group">
            <label>{patientCohort === 'discharged' ? 'Select discharged patient' : 'Select patient'}</label>
            <input
              type="search"
              placeholder="Search Patient Name / MRN"
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
            />
            <div className="report-patient-list">
              {filteredPatients.map((p) => (
                <button
                  key={p.visitId}
                  type="button"
                  className={`report-patient-item${selectedPatient?.visitId === p.visitId ? ' active' : ''}`}
                  onClick={() => setSelectedPatient(p)}
                >
                  <strong>{p.patientName}</strong>
                  <span>
                    {p.mrn}
                    {p.bedLabel ? ` · Bed ${p.bedLabel}` : ''}
                    {p.dischargedAt ? ` · Discharged ${p.dischargedAt.slice(0, 10)}` : ''}
                  </span>
                </button>
              ))}
              {filteredPatients.length === 0 && (
                <p className="muted">
                  {patientCohort === 'discharged'
                    ? 'No discharged patients in selected units.'
                    : 'No admitted patients in selected units.'}
                </p>
              )}
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="button" className="btn btn-primary btn-block" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate Report'}
          </button>
        </aside>

        <section className="reports-preview glass-card" ref={printRef}>
          <ReportPreview report={report} reportType={reportType} />
        </section>

        <aside className="reports-options">
          <div className="glass-card">
            <h3>Vitals to Include</h3>
            {!selectedPatient ? (
              <p className="muted">Select a patient to see available vitals.</p>
            ) : (
              <div className="report-vitals-checklist">
                {availableVitals.map((v) => (
                  <label key={v} className="report-check">
                    <input
                      type="checkbox"
                      checked={vitalsParams.includes(v)}
                      onChange={() => toggleVital(v)}
                    />
                    {v}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card">
            <h3>Download Report</h3>
            <fieldset className="report-fieldset">
              <label className="report-radio">
                <input type="radio" name="fmt" checked={downloadFormat === 'PDF'} onChange={() => setDownloadFormat('PDF')} />
                PDF file download
              </label>
              <label className="report-radio">
                <input type="radio" name="fmt" checked={downloadFormat === 'Excel'} onChange={() => setDownloadFormat('Excel')} />
                Excel (full CSV export)
              </label>
            </fieldset>
            {downloadFormat === 'PDF' && (
              <fieldset className="report-fieldset">
                <legend>PDF page layout</legend>
                <label className="report-radio">
                  <input
                    type="radio"
                    name="pdfPage"
                    checked={pdfPageSize === 'landscape'}
                    onChange={() => setPdfPageSize('landscape')}
                  />
                  A4 Landscape (recommended)
                </label>
                <label className="report-radio">
                  <input
                    type="radio"
                    name="pdfPage"
                    checked={pdfPageSize === 'portrait'}
                    onChange={() => setPdfPageSize('portrait')}
                  />
                  A4 Portrait
                </label>
              </fieldset>
            )}
            <button type="button" className="btn btn-primary btn-block" disabled={!canDownload} onClick={handleDownload}>
              {downloading ? 'Building PDF…' : 'Download'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
