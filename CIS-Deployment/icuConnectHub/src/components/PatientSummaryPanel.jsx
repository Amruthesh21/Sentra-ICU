function fmtGender(g) {
  if (!g) return '—';
  const u = String(g).toUpperCase();
  if (u === 'F' || u === 'FEMALE') return 'Female';
  if (u === 'M' || u === 'MALE') return 'Male';
  return g;
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function fmtDateOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function fmtList(items) {
  if (!items || !items.length) return '—';
  return items.join(', ');
}

function fmtText(value) {
  if (!value || !String(value).trim()) return '—';
  return String(value).trim();
}

function fmtNum(value, unit) {
  if (value == null || value === '') return '—';
  return unit ? `${value} ${unit}` : String(value);
}

function fmtUnitBed(s) {
  const unit = s.unitDisplay || s.unitName;
  const bed = s.bedLabel;
  if (unit && bed) return `${unit} / ${bed}`;
  if (bed) return bed;
  if (unit) return unit;
  return '—';
}

function fmtIsolation(value) {
  if (!value || !String(value).trim()) return '—';
  return String(value).trim();
}

const ROWS = [
  { key: 'patientName', label: 'Patient name', fmt: (s) => fmtText(s.patientName), highlight: true },
  { key: 'mrn', label: 'MRN', fmt: (s) => fmtText(s.mrn) },
  { key: 'externalId', label: 'External ID', fmt: (s) => fmtText(s.externalId) },
  { key: 'age', label: 'Age', fmt: (s) => (s.age != null && s.age !== '' ? `${s.age} yr` : '—') },
  { key: 'dateOfBirth', label: 'DOB', fmt: (s) => fmtDateOnly(s.dateOfBirth) },
  { key: 'weightKg', label: 'Weight', fmt: (s) => fmtNum(s.weightKg, 'kg') },
  { key: 'heightCm', label: 'Height', fmt: (s) => fmtNum(s.heightCm, 'cm') },
  { key: 'gender', label: 'Gender', fmt: (s) => fmtGender(s.gender) },
  { key: 'bloodGroup', label: 'Blood group', fmt: (s) => fmtText(s.bloodGroup) },
  { key: 'unitBed', label: 'Unit / bed', fmt: fmtUnitBed },
  { key: 'admissionType', label: 'Admission type', fmt: (s) => fmtText(s.admissionType) },
  { key: 'admissionSource', label: 'Admission source', fmt: (s) => fmtText(s.admissionSource) },
  { key: 'referringPhysician', label: 'Referring physician', fmt: (s) => fmtText(s.referringPhysician) },
  { key: 'isolationPrecautions', label: 'Isolation', fmt: (s) => fmtIsolation(s.isolationPrecautions) },
  { key: 'diagnosis', label: 'Diagnosis', fmt: (s) => fmtText(s.diagnosis) },
  { key: 'provisionalDiagnosis', label: 'Provisional dx', fmt: (s) => fmtText(s.provisionalDiagnosis) },
  { key: 'admittedAt', label: 'Admitted', fmt: (s) => fmtDate(s.admittedAt) },
  { key: 'comorbidities', label: 'Co-morbidities', fmt: (s) => fmtList(s.comorbidities) },
  { key: 'pastMedicalHistory', label: 'Past history', fmt: (s) => fmtText(s.pastMedicalHistory) },
  { key: 'familyHistory', label: 'Family history', fmt: (s) => fmtText(s.familyHistory) },
  { key: 'allergyHistory', label: 'Allergies', fmt: (s) => fmtText(s.allergyHistory) },
  { key: 'systemicExamination', label: 'Systemic exam', fmt: (s) => fmtText(s.systemicExamination) },
];

const HEADER_COMPACT_ORDER = [
  'mrn', 'age', 'dateOfBirth', 'gender', 'weightKg', 'heightCm', 'bloodGroup',
  'unitBed', 'admissionType', 'admissionSource', 'referringPhysician', 'isolationPrecautions', 'admittedAt',
];

const HEADER_NARRATIVE_ORDER = [
  'diagnosis', 'provisionalDiagnosis', 'comorbidities',
  'allergyHistory', 'pastMedicalHistory', 'familyHistory', 'systemicExamination',
];

const COMPACT_SPAN_2 = new Set(['unitBed']);

const ROW_BY_KEY = Object.fromEntries(ROWS.map((row) => [row.key, row]));

const HEADER_ALWAYS_SHOW = new Set(['mrn', 'unitBed', 'admissionType', 'gender', 'age']);

function fmtHeaderValue(key, summary, fmt) {
  if (key === 'admittedAt') {
    const d = summary.admittedAt ? new Date(summary.admittedAt) : null;
    if (d && !Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return fmt(summary);
}

function diagnosisText(summary) {
  const dx = fmtText(summary.diagnosis);
  if (dx !== '—') return dx;
  return fmtText(summary.provisionalDiagnosis);
}

function stripValue(key, summary) {
  if (key === 'diagnosis') return diagnosisText(summary);
  const row = ROW_BY_KEY[key];
  if (!row) return '—';
  return fmtHeaderValue(key, summary, row.fmt);
}

function shortGender(g) {
  if (!g) return '';
  const u = String(g).toUpperCase();
  if (u === 'M' || u === 'MALE') return 'M';
  if (u === 'F' || u === 'FEMALE') return 'F';
  return String(g).charAt(0).toUpperCase();
}

function formatAdmitShort(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcIcuDay(admittedAt) {
  if (!admittedAt) return null;
  const d = new Date(admittedAt);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(1, Math.floor((Date.now() - d.getTime()) / (24 * 3600 * 1000)) + 1);
}

const NUMERIC_FIELD_KEYS = new Set([
  'mrn', 'externalId', 'age', 'dateOfBirth', 'weightKg', 'heightCm', 'admittedAt',
]);

function renderHeaderField(key, summary, zone = 'compact') {
  const row = ROW_BY_KEY[key];
  if (!row) return null;
  const value = fmtHeaderValue(key, summary, row.fmt);
  if (value === '—' && !HEADER_ALWAYS_SHOW.has(key)) return null;
  const valueClass = NUMERIC_FIELD_KEYS.has(key)
    ? 'patient-summary-field-value num'
    : 'patient-summary-field-value';
  const spanClass = zone === 'compact' && COMPACT_SPAN_2.has(key) ? ' patient-summary-field--span-2' : '';
  const zoneClass = zone === 'narrative' ? ' patient-summary-field--narrative' : ' patient-summary-field--compact';
  return (
    <div key={key} className={`patient-summary-field${zoneClass}${spanClass}`} title={zone === 'narrative' ? value : undefined}>
      <span className="patient-summary-field-label">{row.label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

export default function PatientSummaryPanel({
  summary,
  title = 'Patient summary',
  compact = false,
  variant = 'panel',
  bedLabel,
}) {
  if (!summary) return null;

  const name = summary.patientName && String(summary.patientName).trim();
  const rows = ROWS.filter((row) => !row.highlight || !name);

  if (variant === 'context-bar') {
    const age = summary.age != null && summary.age !== '' ? `${summary.age}y` : '';
    const gender = shortGender(summary.gender);
    const ageGender = [age, gender].filter(Boolean).join(' / ');
    const mrn = summary.mrn && String(summary.mrn).trim();
    const admitDate = formatAdmitShort(summary.admittedAt);
    const icuDay = calcIcuDay(summary.admittedAt);
    const weight = stripValue('weightKg', summary);
    const bloodGroup = stripValue('bloodGroup', summary);
    const diagnosis = stripValue('diagnosis', summary);
    const bed = bedLabel || summary.bedLabel;

    const row2 = [
      bed && { label: 'Bed', value: bed },
      admitDate && { label: 'Admit Date', value: admitDate, num: true },
      icuDay != null && { label: 'ICU Day', value: String(icuDay), num: true },
      weight !== '—' && { label: 'Weight', value: weight, num: true },
      bloodGroup !== '—' && { label: 'Blood group', value: bloodGroup },
      diagnosis !== '—' && { label: 'Diagnosis', value: diagnosis, truncate: true },
    ].filter(Boolean);

    return (
      <div className="patient-context-bar">
        <div className="patient-context-bar-main">
          <div className="patient-context-bar-row1">
            <span className="patient-context-name">{name || 'No Patient'}</span>
            {ageGender && <span className="patient-context-age num">{ageGender}</span>}
            {mrn && <span className="patient-context-mrn num">MRN-{mrn}</span>}
          </div>
          {row2.length > 0 && (
            <div className="patient-context-bar-row2">
              {row2.map((item, i) => (
                <span key={item.label} className="patient-context-inline">
                  {i > 0 && <span className="patient-context-sep" aria-hidden>·</span>}
                  <span className={`patient-context-item${item.truncate ? ' patient-context-item--truncate' : ''}`}>
                    <span className="patient-context-item-label">{item.label}:</span>{' '}
                    <span
                      className={item.num ? 'num' : undefined}
                      title={item.truncate ? item.value : undefined}
                    >
                      {item.value}
                    </span>
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="live-dot">Live</div>
      </div>
    );
  }

  if (variant === 'header') {
    const compactFields = HEADER_COMPACT_ORDER
      .map((key) => renderHeaderField(key, summary, 'compact'))
      .filter(Boolean);
    const narrativeFields = HEADER_NARRATIVE_ORDER
      .map((key) => renderHeaderField(key, summary, 'narrative'))
      .filter(Boolean);
    if (!compactFields.length && !narrativeFields.length) return null;
    return (
      <div className="patient-summary-header">
        {compactFields.length > 0 && (
          <div className="patient-summary-header-grid patient-summary-header-grid--compact">
            {compactFields}
          </div>
        )}
        {narrativeFields.length > 0 && (
          <div className="patient-summary-narrative-grid">
            {narrativeFields}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`patient-summary-panel glass-card${compact ? ' patient-summary-panel--compact' : ''}`}>
      <h3 className="patient-summary-title">{title}</h3>
      {name && (
        <div className="patient-summary-hero">
          <strong>{name}</strong>
          {summary.mrn && <span className="num">MRN {summary.mrn}</span>}
        </div>
      )}
      <dl className="patient-summary-grid">
        {rows.map(({ key, label, fmt }) => (
          <div key={key} className="patient-summary-row">
            <dt>{label}</dt>
            <dd className={NUMERIC_FIELD_KEYS.has(key) ? 'num' : undefined}>{fmt(summary)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function calcAgeNum(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function formatIsolationFlags(flags) {
  if (!flags || typeof flags !== 'object') return null;
  const active = Object.entries(flags)
    .filter(([, on]) => on)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  return active.length ? active.join(', ') : 'None';
}

export function buildSummaryFromForm(form, { unitName, unitDisplay, bedLabel } = {}) {
  return {
    patientName: form.fullName || null,
    mrn: form.mrn || null,
    externalId: form.externalId || null,
    age: form.dateOfBirth ? calcAgeNum(form.dateOfBirth) : null,
    dateOfBirth: form.dateOfBirth || null,
    weightKg: form.weight || null,
    heightCm: form.height || null,
    gender: form.gender,
    bloodGroup: form.bloodGroup || null,
    unitName: unitName || null,
    unitDisplay: unitDisplay || unitName || null,
    bedLabel: bedLabel || form.bedLabel || null,
    admissionType: form.admissionType || null,
    admissionSource: form.admissionSource || null,
    referringPhysician: form.referringPhysician || null,
    isolationPrecautions: formatIsolationFlags(form.isolationFlags),
    diagnosis: form.primaryDiagnosis || null,
    provisionalDiagnosis: form.provisionalDiagnosis || null,
    admittedAt: form.admissionDateTime || null,
    comorbidities: form.comorbidities || [],
    pastMedicalHistory: form.pastMedicalHistory || '',
    familyHistory: form.familyHistory || '',
    allergyHistory: form.allergyHistory || '',
    systemicExamination: form.systemicExamination || '',
  };
}
