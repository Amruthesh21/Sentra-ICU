import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listUnits } from '../api/units';
import {
  admitPatientHub,
  dischargePatientHub,
  getDischargePreview,
  listAdmissionBeds,
  readmitPatientHub,
  saveAdmissionDraft,
  searchPatients,
} from '../api/admissions';
import { listStaff } from '../api/staff';

import PatientSummaryPanel, { buildSummaryFromForm } from '../components/PatientSummaryPanel';
import DischargeSummaryPanel from '../components/DischargeSummaryPanel';

const COMORBIDITIES = [
  'Diabetes mellitus',
  'Hypertension',
  'COPD',
  'Chronic kidney disease',
  'Coronary artery disease',
  'Heart failure',
  'Obesity',
  'Immunosuppression',
  'Malignancy',
  'Liver disease',
  'Asthma',
  'Stroke / CVA',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const STEPS_NEW = [
  { id: 'demographics', label: 'Demographics' },
  { id: 'admission', label: 'Admission details' },
  { id: 'assessment', label: 'Clinical assessment' },
  { id: 'clinical', label: 'Clinical snapshot' },
  { id: 'consent', label: 'Consent & policies' },
  { id: 'summary', label: 'Summary' },
];

const STEPS_READMIT = [
  { id: 'lookup', label: 'Patient lookup' },
  { id: 'admission', label: 'Admission details' },
  { id: 'assessment', label: 'Clinical assessment' },
  { id: 'clinical', label: 'Clinical snapshot' },
  { id: 'consent', label: 'Consent & policies' },
  { id: 'summary', label: 'Summary' },
];

const STEPS_DISCHARGE = [
  { id: 'select-bed', label: 'Select bed' },
  { id: 'summary', label: 'Discharge summary' },
];

function emptyForm() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    fullName: '',
    mrn: '',
    externalId: '',
    gender: 'M',
    dateOfBirth: '',
    weight: '',
    height: '',
    bloodGroup: '',
    admissionSource: 'Emergency department',
    referringPhysician: '',
    attendingPhysician: '',
    primaryNurse: '',
    unitId: '',
    bedLabel: '',
    admissionType: 'Medical',
    admissionDateTime: local,
    dischargeDateTime: local,
    isolationFlags: { contact: false, airborne: false, droplet: false, protective: false },
    primaryDiagnosis: '',
    provisionalDiagnosis: '',
    comorbidities: [],
    systemicExamination: '',
    allergyHistory: '',
    pastMedicalHistory: '',
    familyHistory: '',
    clinicalSnapshot: {
      hr: '', bp: '', spo2: '', rr: '', temp: '', gcs: '', painScore: '',
      ventilated: false, inotropes: false, dialysis: false,
    },
    consent: {
      status: '',
      videoMonitoring: true,
      audioMonitoring: false,
      researchExclusion: false,
    },
    dischargeReason: '',
    dischargeDestination: '',
    followUpPlan: '',
    patientId: null,
  };
}

function calcAge(dob) {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  return String(Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)));
}

export default function PatientManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('new');
  const [activeSection, setActiveSection] = useState('demographics');
  const [form, setForm] = useState(emptyForm);
  const [units, setUnits] = useState([]);
  const [beds, setBeds] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dischargePreview, setDischargePreview] = useState(null);
  const [dischargePreviewLoading, setDischargePreviewLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);

  const scrollRef = useRef(null);
  const sectionRefs = useRef({});
  const admitPrefillRef = useRef(false);

  const steps = tab === 'readmit' ? STEPS_READMIT : tab === 'discharge' ? STEPS_DISCHARGE : STEPS_NEW;

  async function loadBedsForUnit(unitId, forDischarge = false, preferBedLabel = null) {
    const bedList = forDischarge
      ? await listAdmissionBeds(null, { allUnits: true })
      : await listAdmissionBeds(unitId);
    setBeds(bedList);
    if (!forDischarge && bedList.length) {
      setForm((f) => {
        const keep = f.bedLabel
          ? bedList.find((b) => b.bedLabel === f.bedLabel && !b.occupied)
          : null;
        const preferred = preferBedLabel
          ? bedList.find((b) => b.bedLabel === preferBedLabel && !b.occupied)
          : null;
        const vacant = preferred || keep || bedList.find((b) => !b.occupied);
        return { ...f, bedLabel: vacant?.bedLabel || '' };
      });
    }
    return bedList;
  }

  async function applyAdmitPrefill(unitList) {
    const prefillUnit = searchParams.get('unitId');
    const prefillBed = searchParams.get('bedLabel');
    if (!prefillUnit && !prefillBed) return false;
    if (admitPrefillRef.current) return false;

    let unitId = prefillUnit;
    if (!unitId && prefillBed) {
      const allBeds = await listAdmissionBeds(null, { allUnits: true });
      unitId = allBeds.find((b) => b.bedLabel === prefillBed && !b.occupied)?.unitId || null;
    }
    if (!unitId || !unitList.some((u) => u.unitId === unitId)) {
      return false;
    }

    admitPrefillRef.current = true;
    setTab('new');
    setActiveSection('demographics');
    setForm((f) => ({ ...f, unitId, bedLabel: prefillBed || '' }));
    await loadBedsForUnit(unitId, false, prefillBed);
    setSearchParams({}, { replace: true });
    return true;
  }

  useEffect(() => {
    Promise.all([
      listUnits(),
      listStaff('doctor').catch(() => []),
      listStaff('nurse').catch(() => []),
    ])
      .then(async ([unitList, doctorList, nurseList]) => {
        setUnits(unitList);
        setDoctors(doctorList);
        setNurses(nurseList);
        const prefilled = await applyAdmitPrefill(unitList);
        if (!prefilled && unitList.length) {
          const firstId = unitList[0].unitId;
          setForm((f) => ({ ...f, unitId: firstId }));
          await loadBedsForUnit(firstId);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'discharge') {
      loadBedsForUnit(null, true).catch((e) => setError(e.message));
      return;
    }
    if (form.unitId) {
      loadBedsForUnit(form.unitId).catch((e) => setError(e.message));
    }
  }, [form.unitId, tab]);

  useEffect(() => {
    if (tab !== 'readmit' || searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchPatients(searchQ).then(setSearchResults).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, tab]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id.replace('section-', ''));
        }
      },
      { root, rootMargin: '-10% 0px -55% 0px', threshold: [0, 0.25, 0.5] }
    );

    steps.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [tab, steps]);

  function scrollToSection(id) {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  }

  function patch(updates) {
    setForm((f) => ({ ...f, ...updates }));
  }

  function patchNested(key, updates) {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...updates } }));
  }

  async function loadDischargePreview(bedLabel) {
    if (!bedLabel) {
      setDischargePreview(null);
      return;
    }
    setDischargePreviewLoading(true);
    try {
      const preview = await getDischargePreview(bedLabel);
      setDischargePreview(preview);
    } catch (e) {
      setDischargePreview(null);
      setError(e.message);
    } finally {
      setDischargePreviewLoading(false);
    }
  }

  function selectDischargeBed(bedLabel) {
    const bed = beds.find((b) => b.bedLabel === bedLabel);
    if (!bed || !bedLabel) {
      patch({
        bedLabel: '',
        fullName: '',
        mrn: '',
        visitId: null,
        patientId: null,
        primaryDiagnosis: '',
        comorbidities: [],
        admissionType: 'Medical',
        unitId: '',
      });
      setDischargePreview(null);
      return;
    }
    const admittedLocal = bed.admittedAt
      ? new Date(bed.admittedAt).toISOString().slice(0, 16)
      : form.admissionDateTime;
    const now = new Date();
    const dischargeLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    patch({
      bedLabel,
      unitId: bed.unitId || '',
      fullName: bed.patientName || '',
      mrn: bed.mrn || '',
      visitId: bed.visitId || null,
      patientId: bed.patientId || null,
      primaryDiagnosis: bed.primaryDiagnosis || '',
      comorbidities: Array.isArray(bed.comorbidities) ? bed.comorbidities : [],
      admissionType: bed.admissionType || 'Medical',
      admissionDateTime: admittedLocal,
      dischargeDateTime: dischargeLocal,
    });
    loadDischargePreview(bedLabel);
  }

  function selectPatient(p) {
    patch({
      patientId: p.patientId,
      fullName: p.fullName,
      mrn: p.mrn,
      externalId: p.externalId || p.mrn,
      gender: p.sex === 'F' ? 'F' : 'M',
      dateOfBirth: p.dateOfBirth || '',
      weight: p.weightKg != null ? String(p.weightKg) : '',
      height: p.heightCm != null ? String(p.heightCm) : '',
      bloodGroup: p.bloodGroup || '',
    });
    scrollToSection('admission');
  }

  function addComorbidity(value) {
    if (!value || form.comorbidities.includes(value)) return;
    setForm((f) => ({ ...f, comorbidities: [...f.comorbidities, value] }));
  }

  function removeComorbidity(name) {
    setForm((f) => ({ ...f, comorbidities: f.comorbidities.filter((c) => c !== name) }));
  }

  function buildPayload() {
    return {
      bedLabel: form.bedLabel,
      fullName: form.fullName,
      mrn: form.mrn,
      externalId: form.externalId || form.mrn,
      gender: form.gender,
      dateOfBirth: form.dateOfBirth || null,
      weight: form.weight ? Number(form.weight) : null,
      height: form.height ? Number(form.height) : null,
      bloodGroup: form.bloodGroup || null,
      admissionSource: form.admissionSource,
      referringPhysician: form.referringPhysician,
      attendingPhysician: form.attendingPhysician,
      primaryNurse: form.primaryNurse,
      assignedDoctor: form.attendingPhysician,
      assignedNurse: form.primaryNurse,
      admissionType: form.admissionType,
      admissionDateTime: form.admissionDateTime
        ? new Date(form.admissionDateTime).toISOString()
        : new Date().toISOString(),
      primaryDiagnosis: form.primaryDiagnosis,
      provisionalDiagnosis: form.provisionalDiagnosis,
      comorbidities: form.comorbidities,
      systemicExamination: form.systemicExamination,
      allergyHistory: form.allergyHistory,
      pastMedicalHistory: form.pastMedicalHistory,
      familyHistory: form.familyHistory,
      isolationFlags: form.isolationFlags,
      clinicalSnapshot: form.clinicalSnapshot,
      consent: form.consent,
      patientId: form.patientId,
      unitId: form.unitId || null,
    };
  }

  async function handleSaveDraft() {
    setMessage(null);
    setError(null);
    try {
      const r = await saveAdmissionDraft({
        workflowType: tab.toUpperCase(),
        patientId: form.patientId,
        payload: buildPayload(),
      });
      setMessage(`Draft saved (${r.draftId})`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmit() {
    setMessage(null);
    setError(null);
    try {
      const payload = buildPayload();
      let r;
      if (tab === 'readmit') r = await readmitPatientHub(payload);
      else if (tab === 'discharge') {
        r = await dischargePatientHub({
          bedLabel: form.bedLabel,
          dischargeReason: form.dischargeReason,
          dischargeDestination: form.dischargeDestination,
          followUpPlan: form.followUpPlan,
          dischargedAt: form.dischargeDateTime
            ? new Date(form.dischargeDateTime).toISOString()
            : new Date().toISOString(),
        });
      }
      else r = await admitPatientHub(payload);
      setMessage(r.message || 'Success');
      if (tab === 'discharge') {
        setForm(emptyForm());
        setDischargePreview(null);
        setActiveSection('select-bed');
        setBeds(await listAdmissionBeds(null, { allUnits: true }));
      } else {
        setForm(emptyForm());
        setActiveSection(tab === 'readmit' ? 'lookup' : 'demographics');
        setBeds(await listAdmissionBeds(form.unitId || null));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function switchTab(id) {
    setTab(id);
    setError(null);
    setMessage(null);
    if (id !== 'discharge') setDischargePreview(null);
    setActiveSection(id === 'discharge' ? 'select-bed' : id === 'readmit' ? 'lookup' : 'demographics');
  }

  const selectedUnit = units.find((u) => u.unitId === form.unitId);
  const targetBed = beds.find((b) => b.bedLabel === form.bedLabel);

  const summaryPreview = useMemo(() => {
    const unitDisplay = selectedUnit
      ? [selectedUnit.blockName, selectedUnit.name].filter(Boolean).join(' · ')
      : null;
    return buildSummaryFromForm(form, {
      unitName: selectedUnit?.name,
      unitDisplay,
      bedLabel: form.bedLabel,
    });
  }, [form, selectedUnit]);

  const dischargeBed = beds.find((b) => b.bedLabel === form.bedLabel);

  const summaryRows = useMemo(() => {
    const unitName = dischargeBed?.unitName || selectedUnit?.name || '—';
    return [
      ['Patient', form.fullName || dischargeBed?.patientName || '—'],
      ['MRN', form.mrn || dischargeBed?.mrn || '—'],
      ['Unit / bed', `${unitName}${form.bedLabel ? ` / ${form.bedLabel}` : ''}`],
      ['Admission type', form.admissionType || dischargeBed?.admissionType || '—'],
      ['Admission time', form.admissionDateTime ? new Date(form.admissionDateTime).toLocaleString() : (dischargeBed?.admittedAt ? new Date(dischargeBed.admittedAt).toLocaleString() : '—')],
      ['Diagnosis', form.primaryDiagnosis || dischargeBed?.primaryDiagnosis || '—'],
      ['Co-morbidities', form.comorbidities.length ? form.comorbidities.join(', ') : (Array.isArray(dischargeBed?.comorbidities) && dischargeBed.comorbidities.length ? dischargeBed.comorbidities.join(', ') : '—')],
    ];
  }, [form, selectedUnit, dischargeBed]);

  function sectionRef(id) {
    return (node) => {
      sectionRefs.current[id] = node;
    };
  }

  if (loading) {
    return <div className="empty-state glass-card"><h2>Loading patient management…</h2></div>;
  }

  return (
    <div className="patient-mgmt patient-mgmt--scroll">
      <div className="patient-mgmt-header">
        <div className="workflow-tabs">
          {[
            ['new', 'New admission'],
            ['readmit', 'Readmission'],
            ['discharge', 'Discharge'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`workflow-tab${tab === id ? ' active' : ''}`}
              onClick={() => switchTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="target-bed-pill">Target Bed: {form.bedLabel || '—'}</div>
      </div>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <div className={`admission-layout admission-layout--scroll${tab !== 'discharge' ? ' admission-layout--with-summary' : ''}`}>
        <aside className="admission-stepper glass-card">
          {steps.map(({ id, label }, i) => (
            <button
              key={id}
              type="button"
              className={`step-item${activeSection === id ? ' active' : ''}`}
              onClick={() => scrollToSection(id)}
            >
              <span className="step-num">{i + 1}</span>
              <span className="step-label">{label}</span>
            </button>
          ))}
        </aside>

        <div className="admission-scroll-panel" ref={scrollRef}>
          {tab === 'discharge' ? (
            <>
              <section id="section-select-bed" ref={sectionRef('select-bed')} className="glass-card form-section form-section--compact">
                <h3>1 Select occupied bed</h3>
                <div className="form-grid two-col">
                  <div className="form-group">
                    <label>Bed *</label>
                    <select value={form.bedLabel} onChange={(e) => selectDischargeBed(e.target.value)}>
                      <option value="">Select…</option>
                      {beds.filter((b) => b.occupied).map((b) => (
                        <option key={b.bedLabel} value={b.bedLabel}>
                          {b.bedLabel}{b.patientName ? ` · ${b.patientName}` : ''}{b.unitName ? ` · ${b.unitName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section id="section-summary" ref={sectionRef('summary')} className="glass-card form-section">
                <h3>2 Discharge summary</h3>
                <DischargeSummaryPanel
                  preview={dischargePreview}
                  loading={dischargePreviewLoading}
                  form={form}
                  onPatch={patch}
                  dischargeDateTime={form.dischargeDateTime}
                />
                <div className="form-actions-row sticky-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleSubmit}
                    disabled={!form.bedLabel || dischargePreviewLoading}
                  >
                    Discharge patient
                  </button>
                </div>
              </section>
            </>
          ) : (
            <>
              {tab === 'new' && (
                <section id="section-demographics" ref={sectionRef('demographics')} className="glass-card form-section form-section--compact">
                  <h3>1 Demographics</h3>
                  <div className="form-grid two-col">
                    <div className="form-group"><label>Full name *</label><input value={form.fullName} onChange={(e) => patch({ fullName: e.target.value })} placeholder="Enter name" /></div>
                    <div className="form-group"><label>MRN *</label><input value={form.mrn} onChange={(e) => patch({ mrn: e.target.value })} placeholder="00000000" /></div>
                    <div className="form-group"><label>External ID</label><input value={form.externalId} onChange={(e) => patch({ externalId: e.target.value })} placeholder="Defaults to MRN" /></div>
                    <div className="form-group"><label>Sex</label><select value={form.gender} onChange={(e) => patch({ gender: e.target.value })}><option value="M">Male</option><option value="F">Female</option></select></div>
                    <div className="form-group"><label>Date of birth</label><input type="date" value={form.dateOfBirth} onChange={(e) => patch({ dateOfBirth: e.target.value })} /></div>
                    <div className="form-group"><label>Age</label><input readOnly value={calcAge(form.dateOfBirth)} className="readonly" /></div>
                    <div className="form-group"><label>Weight (kg)</label><input type="number" min="0" step="0.1" value={form.weight} onChange={(e) => patch({ weight: e.target.value })} placeholder="e.g. 72" /></div>
                    <div className="form-group"><label>Height (cm)</label><input type="number" min="0" step="0.1" value={form.height} onChange={(e) => patch({ height: e.target.value })} placeholder="e.g. 170" /></div>
                    <div className="form-group">
                      <label>Blood group</label>
                      <select value={form.bloodGroup} onChange={(e) => patch({ bloodGroup: e.target.value })}>
                        <option value="">Select…</option>
                        {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Admission source</label><select value={form.admissionSource} onChange={(e) => patch({ admissionSource: e.target.value })}><option>Emergency department</option><option>Transfer</option><option>Direct admit</option></select></div>
                    <div className="form-group"><label>Referring physician</label><input value={form.referringPhysician} onChange={(e) => patch({ referringPhysician: e.target.value })} placeholder="Search physician…" /></div>
                  </div>
                </section>
              )}

              {tab === 'readmit' && (
                <section id="section-lookup" ref={sectionRef('lookup')} className="glass-card form-section form-section--compact">
                  <h3>1 Patient lookup</h3>
                  <div className="form-group">
                    <input className="search-input" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search by name, MRN or external ID (min 2 chars)" />
                  </div>
                  <div className="lookup-results">
                    {searchResults.map((p) => (
                      <button key={p.patientId} type="button" className="lookup-row" onClick={() => selectPatient(p)}>
                        <strong>{p.fullName}</strong>
                        <span>MRN {p.mrn}</span>
                      </button>
                    ))}
                    {searchQ.length >= 2 && searchResults.length === 0 && <p className="muted">No patients found</p>}
                  </div>
                </section>
              )}

              <section id="section-admission" ref={sectionRef('admission')} className="glass-card form-section form-section--compact">
                <h3>{tab === 'readmit' ? '2' : '2'} Admission details</h3>
                <div className="form-grid two-col">
                  <div className="form-group">
                    <label>Unit / ICU *</label>
                    {units.length === 0 ? (
                      <p className="muted">No units — create one in Admin first.</p>
                    ) : (
                      <select
                        value={form.unitId}
                        onChange={(e) => patch({ unitId: e.target.value, bedLabel: '' })}
                      >
                        {units.map((u) => (
                          <option key={u.unitId} value={u.unitId}>{u.displayLabel}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Bed *</label>
                    <select value={form.bedLabel} onChange={(e) => patch({ bedLabel: e.target.value })}>
                      <option value="">Select…</option>
                      {beds.filter((b) => !b.occupied).map((b) => (
                        <option key={b.bedLabel} value={b.bedLabel}>
                          {b.bedLabel}{b.deviceIp ? ` · ${b.deviceIp}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group"><label>Admission type</label><select value={form.admissionType} onChange={(e) => patch({ admissionType: e.target.value })}><option>Medical</option><option>Surgical</option></select></div>
                  <div className="form-group"><label>Admission date / time</label><input type="datetime-local" value={form.admissionDateTime} onChange={(e) => patch({ admissionDateTime: e.target.value })} /></div>
                  <div className="form-group">
                    <label>Assign doctor *</label>
                    {doctors.length === 0 ? (
                      <p className="muted">No doctors in Staff roster — add under Admin → Staff.</p>
                    ) : (
                      <select
                        value={form.attendingPhysician}
                        onChange={(e) => patch({ attendingPhysician: e.target.value })}
                        required
                      >
                        <option value="">Select doctor…</option>
                        {doctors.filter((d) => d.onDuty !== false).map((d) => (
                          <option key={d.id} value={d.fullName || d.name}>
                            {d.fullName || d.name}{d.roleLabel ? ` · ${d.roleLabel}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Assign nurse *</label>
                    {nurses.length === 0 ? (
                      <p className="muted">No nurses in Staff roster — add under Admin → Staff.</p>
                    ) : (
                      <select
                        value={form.primaryNurse}
                        onChange={(e) => patch({ primaryNurse: e.target.value })}
                        required
                      >
                        <option value="">Select nurse…</option>
                        {nurses.filter((n) => n.onDuty !== false).map((n) => (
                          <option key={n.id} value={n.fullName || n.name}>
                            {n.fullName || n.name}{n.roleLabel ? ` · ${n.roleLabel}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>Isolation / precautions</label>
                  <div className="checkbox-row">
                    {['contact', 'airborne', 'droplet', 'protective'].map((k) => (
                      <label key={k} className="inline-check">
                        <input type="checkbox" checked={form.isolationFlags[k]} onChange={(e) => patchNested('isolationFlags', { [k]: e.target.checked })} />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Primary diagnosis / reason for ICU admission</label>
                  <textarea rows={2} value={form.primaryDiagnosis} onChange={(e) => patch({ primaryDiagnosis: e.target.value })} placeholder="e.g. Acute respiratory failure — viral pneumonia (J12.89)" />
                </div>
              </section>

              <section id="section-assessment" ref={sectionRef('assessment')} className="glass-card form-section form-section--compact">
                <h3>{tab === 'readmit' ? '3' : '3'} Clinical assessment</h3>

                <div className="form-group">
                  <label>Co-morbidities</label>
                  <p className="muted field-hint">Add each condition from the list below.</p>
                  <div className="comorbidity-select-wrap">
                    <select
                      value=""
                      onChange={(e) => {
                        addComorbidity(e.target.value);
                        e.target.value = '';
                      }}
                    >
                      <option value="" disabled hidden>Select</option>
                      {COMORBIDITIES.filter((name) => !form.comorbidities.includes(name)).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    {form.comorbidities.length > 0 && (
                      <div className="comorbidity-chips">
                        {form.comorbidities.map((name) => (
                          <span key={name} className="comorbidity-chip">
                            {name}
                            <button type="button" aria-label={`Remove ${name}`} onClick={() => removeComorbidity(name)}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Provisional diagnosis</label>
                  <textarea rows={2} value={form.provisionalDiagnosis} onChange={(e) => patch({ provisionalDiagnosis: e.target.value })} placeholder="Working diagnosis at admission" />
                </div>

                <div className="assessment-history-grid">
                  <div className="form-group">
                    <label>Systemic examination</label>
                    <textarea rows={4} value={form.systemicExamination} onChange={(e) => patch({ systemicExamination: e.target.value })} placeholder="CVS, RS, CNS, abdomen, etc." />
                  </div>
                  <div className="form-group">
                    <label>Allergy history</label>
                    <textarea rows={4} value={form.allergyHistory} onChange={(e) => patch({ allergyHistory: e.target.value })} placeholder="Drug, food, environmental allergies" />
                  </div>
                  <div className="form-group">
                    <label>Past medical history</label>
                    <textarea rows={4} value={form.pastMedicalHistory} onChange={(e) => patch({ pastMedicalHistory: e.target.value })} placeholder="Prior illnesses, surgeries, hospitalizations" />
                  </div>
                  <div className="form-group">
                    <label>Family history</label>
                    <textarea rows={4} value={form.familyHistory} onChange={(e) => patch({ familyHistory: e.target.value })} placeholder="Relevant hereditary or familial conditions" />
                  </div>
                </div>
              </section>

              <section id="section-clinical" ref={sectionRef('clinical')} className="glass-card form-section form-section--compact">
                <h3>{tab === 'readmit' ? '4' : '4'} Initial clinical snapshot</h3>
                <div className="vitals-inline">
                  {[['hr', 'HR', 'bpm'], ['bp', 'BP', 'mmHg'], ['spo2', 'SpO₂', '%'], ['rr', 'RR', 'br/min'], ['temp', 'Temp', '°C'], ['gcs', 'GCS', '/15'], ['painScore', 'Pain', '/10']].map(([k, lbl, unit]) => (
                    <div key={k} className="vital-inline-field">
                      <label>{lbl}</label>
                      <input value={form.clinicalSnapshot[k]} onChange={(e) => patchNested('clinicalSnapshot', { [k]: e.target.value })} />
                      <small>{unit}</small>
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label>Clinical flags</label>
                  <div className="checkbox-row">
                    {[['ventilated', 'Ventilated'], ['inotropes', 'Inotropes'], ['dialysis', 'Dialysis']].map(([k, lbl]) => (
                      <label key={k} className="inline-check">
                        <input type="checkbox" checked={form.clinicalSnapshot[k]} onChange={(e) => patchNested('clinicalSnapshot', { [k]: e.target.checked })} />
                        {lbl}
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section id="section-consent" ref={sectionRef('consent')} className="glass-card form-section form-section--compact">
                <h3>{tab === 'readmit' ? '5' : '5'} Consent &amp; policies</h3>
                <div className="form-group">
                  <label>Admission consent status</label>
                  <select value={form.consent.status} onChange={(e) => patchNested('consent', { status: e.target.value })}>
                    <option value="" disabled hidden>Select</option>
                    <option>Obtained</option>
                    <option>Pending</option>
                    <option>Declined</option>
                  </select>
                </div>
                {[
                  ['videoMonitoring', 'Video monitoring allowed'],
                  ['audioMonitoring', 'Audio monitoring allowed'],
                  ['researchExclusion', 'Research exclusion'],
                ].map(([k, title]) => (
                  <div key={k} className="toggle-row toggle-row--compact">
                    <strong>{title}</strong>
                    <label className="toggle">
                      <input type="checkbox" checked={form.consent[k]} onChange={(e) => patchNested('consent', { [k]: e.target.checked })} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                ))}
              </section>

              <section id="section-summary" ref={sectionRef('summary')} className="glass-card form-section form-section--compact">
                <h3>{tab === 'readmit' ? '6' : '6'} Summary &amp; actions</h3>
                <div className="summary-table">
                  {summaryRows.map(([k, v]) => (
                    <div key={k} className="summary-cell"><span>{k}</span><strong>{v}</strong></div>
                  ))}
                </div>
                {targetBed && (
                  <p className="muted summary-bed-hint">
                    Bed {targetBed.bedLabel}{targetBed.deviceIp ? ` · ${targetBed.deviceIp}` : ''}
                  </p>
                )}
                <div className="form-actions-row sticky-actions">
                  <button type="button" className="btn btn-primary btn-lg" onClick={handleSubmit}>
                    {tab === 'readmit' ? 'Readmit & assign bed' : 'Register & assign bed'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleSaveDraft}>Save as draft</button>
                  <button type="button" className="btn btn-text" onClick={() => { setForm(emptyForm()); scrollToSection(tab === 'readmit' ? 'lookup' : 'demographics'); }}>Cancel</button>
                </div>
              </section>
            </>
          )}
        </div>

        {tab !== 'discharge' && (
          <div className="admission-summary-rail">
            <PatientSummaryPanel
              summary={summaryPreview}
              title="Live patient summary"
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
