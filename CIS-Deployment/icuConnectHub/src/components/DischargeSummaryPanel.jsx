function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function displayValue(value, emptyLabel = 'Not documented at admission') {
  if (value == null) return emptyLabel;
  if (typeof value === 'string' && !value.trim()) return emptyLabel;
  if (Array.isArray(value)) return value.length ? value.join(', ') : emptyLabel;
  return String(value);
}

function vitalsLine(snap) {
  if (!snap || !Object.keys(snap).length) return null;
  const parts = [];
  if (snap.hr) parts.push(`HR ${snap.hr}`);
  if (snap.bp) parts.push(`BP ${snap.bp}`);
  if (snap.spo2) parts.push(`SpO₂ ${snap.spo2}%`);
  if (snap.rr) parts.push(`RR ${snap.rr}`);
  if (snap.temp) parts.push(`Temp ${snap.temp}°C`);
  if (snap.gcs) parts.push(`GCS ${snap.gcs}`);
  return parts.length ? parts.join(' · ') : null;
}

function liveVitalsLine(vitals) {
  if (!vitals) return null;
  const { timestamp, ...rest } = vitals;
  const parts = Object.entries(rest).map(([k, v]) => `${k} ${v}`);
  return parts.length ? parts.join(' · ') : null;
}

function SummaryField({ label, value, warn }) {
  return (
    <div className={`ds-field${warn ? ' ds-field--warn' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummarySection({ title, hint, children }) {
  return (
    <div className="ds-section">
      <div className="ds-section-head">
        <h4>{title}</h4>
        {hint ? <p className="muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function DischargeSummaryPanel({
  preview,
  loading,
  form,
  onPatch,
  dischargeDateTime,
}) {
  if (loading) {
    return <div className="ds-loading muted">Loading discharge summary from patient record…</div>;
  }

  if (!preview) {
    return (
      <div className="ds-empty muted">
        Select an occupied bed to load the full discharge summary — admission details, allergies, orders, and vitals.
      </div>
    );
  }

  const patient = preview.patient || {};
  const stay = preview.stay || {};
  const clinical = preview.clinical || {};
  const admissionSnap = vitalsLine(clinical.admissionSnapshot);
  const liveSnap = liveVitalsLine(preview.latestVitals);
  const los = stay.lengthOfStay || '—';
  const dischargeDisplay = dischargeDateTime
    ? new Date(dischargeDateTime).toLocaleString()
    : fmtDateTime(stay.proposedDischargeAt);

  const allergies = clinical.allergyHistory;
  const allergyWarn = !allergies || !allergies.trim();

  return (
    <div className="discharge-summary">
      <div className="ds-timeline">
        <div className="ds-timeline-card ds-timeline-card--admit">
          <span>Admission</span>
          <strong>{fmtDateTime(stay.admittedAt)}</strong>
        </div>
        <div className="ds-timeline-mid">
          <span className="ds-los-label">Length of stay</span>
          <strong className="ds-los-value">{los}</strong>
        </div>
        <div className="ds-timeline-card ds-timeline-card--discharge">
          <span>Discharge</span>
          <strong>{dischargeDisplay}</strong>
        </div>
      </div>

      <SummarySection title="Patient identification">
        <div className="ds-grid">
          <SummaryField label="Patient" value={patient.fullName || '—'} />
          <SummaryField label="MRN" value={patient.mrn || '—'} />
          <SummaryField label="Date of birth" value={fmtDate(patient.dateOfBirth)} />
          <SummaryField label="Age / sex" value={`${patient.age != null ? patient.age : '—'} / ${patient.sex || '—'}`} />
          <SummaryField label="Blood group" value={patient.bloodGroup || '—'} />
          <SummaryField label="Unit / bed" value={`${preview.unitDisplay || preview.unitName || '—'} / ${preview.bedLabel || '—'}`} />
        </div>
      </SummarySection>

      <SummarySection
        title="Reason for ICU stay"
        hint="Per discharge standards: admission context and working diagnosis"
      >
        <div className="ds-grid">
          <SummaryField label="Admission type" value={stay.admissionType || '—'} />
          <SummaryField label="Admission source" value={stay.admissionSource || '—'} />
          <SummaryField label="Referring physician" value={stay.referringPhysician || '—'} />
          <SummaryField
            label="Primary diagnosis"
            value={displayValue(clinical.primaryDiagnosis)}
            warn={!clinical.primaryDiagnosis}
          />
          {clinical.provisionalDiagnosis ? (
            <SummaryField label="Provisional diagnosis" value={clinical.provisionalDiagnosis} />
          ) : null}
          {clinical.comorbidities?.length ? (
            <SummaryField label="Co-morbidities" value={clinical.comorbidities.join(', ')} />
          ) : null}
        </div>
      </SummarySection>

      <SummarySection title="Allergies & alerts" hint="Mandatory — confirm before discharge">
        <div className="ds-grid">
          <SummaryField
            label="Allergies"
            value={allergyWarn ? 'Not documented — confirm NKDA or record allergies' : allergies}
            warn={allergyWarn}
          />
          <SummaryField label="Isolation" value={clinical.isolationPrecautions || 'None'} />
          {clinical.pastMedicalHistory ? (
            <SummaryField label="Past medical history" value={clinical.pastMedicalHistory} />
          ) : null}
        </div>
      </SummarySection>

      <SummarySection title="ICU status at discharge">
        <div className="ds-grid">
          <SummaryField
            label="Vitals at admission"
            value={admissionSnap || 'Not recorded at admission'}
            warn={!admissionSnap}
          />
          <SummaryField
            label="Latest monitor vitals"
            value={liveSnap || 'No live vitals on bed'}
            warn={!liveSnap}
          />
          {preview.devices ? (
            <SummaryField
              label="Devices"
              value={Object.entries(preview.devices)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ') || '—'}
            />
          ) : null}
        </div>
      </SummarySection>

      {(preview.activeOrders?.length > 0 || preview.recentLabs?.length > 0 || preview.recentNotes?.length > 0) && (
        <SummarySection title="Active care at discharge">
          {preview.activeOrders?.length > 0 ? (
            <div className="ds-list-block">
              <h5>Active orders ({preview.activeOrderCount})</h5>
              <ul className="ds-list">
                {preview.activeOrders.map((o, i) => (
                  <li key={o.orderText + i}>
                    <strong>{o.orderType}</strong> — {o.orderText}
                    <span className="muted"> · {o.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.recentLabs?.length > 0 ? (
            <div className="ds-list-block">
              <h5>Recent labs</h5>
              <ul className="ds-list">
                {preview.recentLabs.map((l) => (
                  <li key={l.testName + l.resultedAt}>
                    {l.testName}: <strong>{l.value}</strong>{l.unit ? ` ${l.unit}` : ''}
                    {l.flag ? <span className="ds-flag"> {l.flag}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.recentNotes?.length > 0 ? (
            <div className="ds-list-block">
              <h5>Clinical notes</h5>
              <ul className="ds-list">
                {preview.recentNotes.map((n) => (
                  <li key={n.updatedAt + n.title}>
                    <strong>{n.noteType}</strong>
                    {n.title ? ` — ${n.title}` : ''}
                    {n.excerpt ? <span className="muted"> · {n.excerpt}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SummarySection>
      )}

      <SummarySection title="Discharge plan" hint="Complete before releasing the bed">
        <div className="form-grid two-col">
          <div className="form-group">
            <label>Discharge date / time *</label>
            <input
              type="datetime-local"
              value={form.dischargeDateTime}
              onChange={(e) => onPatch({ dischargeDateTime: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Discharge destination</label>
            <select
              value={form.dischargeDestination}
              onChange={(e) => onPatch({ dischargeDestination: e.target.value })}
            >
              <option value="">Select destination…</option>
              <option value="Home">Home</option>
              <option value="Ward / step-down">Ward / step-down unit</option>
              <option value="Another hospital">Transfer to another hospital</option>
              <option value="Rehabilitation">Rehabilitation facility</option>
              <option value="Hospice / palliative">Hospice / palliative care</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div className="form-group form-group--full">
            <label>Reason for discharge</label>
            <textarea
              rows={2}
              value={form.dischargeReason}
              onChange={(e) => onPatch({ dischargeReason: e.target.value })}
              placeholder="Clinical reason — improved, transfer, palliation, etc."
            />
          </div>
          <div className="form-group form-group--full">
            <label>Follow-up plan & instructions</label>
            <textarea
              rows={3}
              value={form.followUpPlan}
              onChange={(e) => onPatch({ followUpPlan: e.target.value })}
              placeholder="Appointments, pending tests, medication changes, warning signs for patient/caregiver"
            />
          </div>
        </div>
      </SummarySection>
    </div>
  );
}
