import { useEffect, useMemo, useState } from 'react';
import { createNote, listNotes, updateNote } from '../api/clinical';

function formatDt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function todayLabel() {
  return new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Hospital / ICU note templates used on wards (systems-based, SOAP, SBAR, etc.). */
export const NOTE_TEMPLATES = [
  {
    id: 'icu-progress',
    label: 'ICU Progress Note (systems)',
    noteType: 'ICU Progress Note',
    title: () => `ICU progress — ${todayLabel()}`,
    body: (p) => `ICU DAILY PROGRESS NOTE
Patient: ${p.name} · MRN ${p.mrn} · Bed ${p.bed}
Date: ${todayLabel()}
Author: ________________

INTERVAL HISTORY / 24h EVENTS
• 
• 

ACTIVE PROBLEMS
1. 
2. 
3. 

SYSTEMS ASSESSMENT & PLAN
Neuro
  Exam / GCS / RASS / sedation: 
  Plan: 

Cardiovascular
  Hemodynamics / pressors / MAP goal: 
  Plan: 

Respiratory
  Support / FiO2 / SpO2 / vent mode (if any): 
  Plan: 

Renal / Fluids / Electrolytes
  UOP / Cr / K / acid–base / renal support: 
  Plan: 

GI / Nutrition
  Diet / residuals / bowel / LFTs: 
  Plan: 

ID / Lines / Cultures
  Antibiotics / cultures / lines / devices: 
  Plan: 

Heme / Endocrine
  Hb / transfusion / glucose / steroids: 
  Plan: 

PROPHYLAXIS / LINES / DEVICES
DVT / GI / VAP bundles · Foley · CVC · Arterial line: 

FAMILY / GOALS OF CARE
• 

PENDING / FOLLOW-UP
• Labs: 
• Imaging: 
• Consults: 
`,
  },
  {
    id: 'soap',
    label: 'SOAP Note',
    noteType: 'SOAP Note',
    title: () => `SOAP — ${todayLabel()}`,
    body: (p) => `SOAP NOTE
Patient: ${p.name} · MRN ${p.mrn} · Bed ${p.bed}
Date: ${todayLabel()}

S — SUBJECTIVE
Chief complaint / symptoms / nursing & family report:


O — OBJECTIVE
Vitals: 
Exam: 
Labs / imaging (pertinent): 
Medications / drips:


A — ASSESSMENT
1. 
2. 


P — PLAN
1. 
2. 
3. 
`,
  },
  {
    id: 'admission',
    label: 'ICU Admission Note',
    noteType: 'Admission Note',
    title: () => `ICU admission — ${todayLabel()}`,
    body: (p) => `ICU ADMISSION NOTE
Patient: ${p.name} · MRN ${p.mrn} · Bed ${p.bed}
Admission date: ${todayLabel()}
Admitting physician: ________________

CHIEF COMPLAINT


HISTORY OF PRESENT ILLNESS


PAST MEDICAL / SURGICAL HISTORY


MEDICATIONS / ALLERGIES


SOCIAL / CODE STATUS / GOALS


EXAMINATION (on arrival)


INITIAL VITALS / SUPPORT
HR · BP · SpO2 · RR · Temp · Vent / O2:


PROBLEM LIST (prioritized)
1. 
2. 
3. 

SYSTEMS PLAN ON ADMISSION
Neuro: 
CV: 
Pulm: 
Renal / fluids: 
ID: 
Other: 

ORDERS / PENDING
• 
`,
  },
  {
    id: 'nursing-sbar',
    label: 'Nursing Shift / SBAR',
    noteType: 'Nursing Note',
    title: () => `Nursing SBAR — ${todayLabel()}`,
    body: (p) => `NURSING SHIFT REPORT (SBAR)
Patient: ${p.name} · MRN ${p.mrn} · Bed ${p.bed}
Shift: ☐ Day  ☐ Evening  ☐ Night     Date: ${todayLabel()}
Nurse: ________________

S — SITUATION
Current status / reason for ICU / main concern today:


B — BACKGROUND
Diagnosis · allergies · code status · isolation · lines/devices:


A — ASSESSMENT
Vitals (last): 
Neuro / pain / sedation: 
Airway / O2 / vent: 
Cardiac / drips: 
Intake / output / drains: 
Skin / wounds / falls risk: 
Pending labs / procedures:


R — RECOMMENDATION / HANDOFF
Watch for: 
Tasks to complete: 
Escalate to: 
`,
  },
  {
    id: 'procedure',
    label: 'Procedure Note',
    noteType: 'Procedure Note',
    title: () => `Procedure — ${todayLabel()}`,
    body: (p) => `PROCEDURE NOTE
Patient: ${p.name} · MRN ${p.mrn} · Bed ${p.bed}
Date / time: ${todayLabel()} ________
Operator: ________________  Assistant: ________________

PROCEDURE
Indication: 
Consent: ☐ Obtained  ☐ Emergent (document reason)
Timeout / site mark: ☐ Yes

TECHNIQUE / FINDINGS


COMPLICATIONS
☐ None  ☐ Yes — describe:


SPECIMENS / DEVICES PLACED


POST-PROCEDURE STATUS / ORDERS
• 
`,
  },
  {
    id: 'consult',
    label: 'Consultation Note',
    noteType: 'Consultation',
    title: () => `Consult — ${todayLabel()}`,
    body: (p) => `CONSULTATION NOTE
Patient: ${p.name} · MRN ${p.mrn} · Bed ${p.bed}
Date: ${todayLabel()}
Requesting service: ICU
Consulting service: ________________
Reason for consult:


HISTORY (pertinent)


EXAM / DATA REVIEWED


IMPRESSION
1. 
2. 


RECOMMENDATIONS
1. 
2. 
3. 

Discussed with: ________________
`,
  },
  {
    id: 'event',
    label: 'Significant Event / RRT',
    noteType: 'Event Note',
    title: () => `Significant event — ${todayLabel()}`,
    body: (p) => `SIGNIFICANT EVENT / RAPID RESPONSE NOTE
Patient: ${p.name} · MRN ${p.mrn} · Bed ${p.bed}
Date / time of event: ${todayLabel()} ________
Location: ICU ${p.bed}

EVENT DESCRIPTION


VITALS AT ONSET
HR · BP · SpO2 · RR · Temp · Rhythm:


INTERVENTIONS / RESPONSE
• 
• 

OUTCOME
☐ Stabilized on unit  ☐ Escalation / transfer  ☐ Code called

NOTIFICATIONS
Physician: ________  Family: ________  Time: ________

FOLLOW-UP PLAN
• 
`,
  },
  {
    id: 'discharge',
    label: 'Discharge / Transfer Summary',
    noteType: 'Discharge Summary',
    title: () => `Discharge summary — ${todayLabel()}`,
    body: (p) => `DISCHARGE / TRANSFER SUMMARY
Patient: ${p.name} · MRN ${p.mrn}
ICU bed: ${p.bed} · Discharge date: ${todayLabel()}
Disposition: ☐ Ward  ☐ Step-down  ☐ Home  ☐ Another facility  ☐ Other

ADMISSION DIAGNOSIS / ICU COURSE (brief)


HOSPITAL COURSE BY PROBLEM
1. 
2. 


PROCEDURES DURING STAY


KEY RESULTS (labs / imaging)


CONDITION AT DISCHARGE
Vitals / support / neuro / ambulation:


MEDICATIONS ON DISCHARGE
• 

FOLLOW-UP / PENDING
• Appointments: 
• Pending results: 
• Patient / family education: 

PENDING ISSUES FOR RECEIVING TEAM
• 
`,
  },
];

function patientCtx(patientName, patientMRN, bedLabel) {
  return {
    name: patientName || 'Patient',
    mrn: patientMRN || '—',
    bed: bedLabel || '—',
  };
}

export default function ClinicalNotesPanel({ visitId, patientName, patientMRN, bedLabel }) {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState({ noteType: 'ICU Progress Note', title: '', content: '', status: 'DRAFT' });
  const [templateId, setTemplateId] = useState('icu-progress');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const ctx = useMemo(
    () => patientCtx(patientName, patientMRN, bedLabel),
    [patientName, patientMRN, bedLabel],
  );

  async function refresh() {
    if (!visitId) return;
    setLoading(true);
    try {
      const list = await listNotes(visitId);
      setNotes(list);
      if (!selectedId && !isCreating && list.length) setSelectedId(list[0].noteId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [visitId]);

  const selected = notes.find((n) => n.noteId === selectedId);

  useEffect(() => {
    if (selected) {
      setDraft({
        noteType: selected.noteType || 'Progress Note',
        title: selected.title || '',
        content: selected.content || '',
        status: selected.status || 'DRAFT',
      });
      const match = NOTE_TEMPLATES.find((t) => t.noteType === selected.noteType);
      if (match) setTemplateId(match.id);
    }
  }, [selectedId, selected?.noteId]);

  function applyTemplate(id, { force = false } = {}) {
    const tpl = NOTE_TEMPLATES.find((t) => t.id === id) || NOTE_TEMPLATES[0];
    const nextBody = tpl.body(ctx);
    const hasContent = Boolean(draft.content && draft.content.trim());
    if (hasContent && !force) {
      const ok = window.confirm('Replace current note content with this hospital template?');
      if (!ok) return;
    }
    setTemplateId(tpl.id);
    setDraft((d) => ({
      ...d,
      noteType: tpl.noteType,
      title: d.title?.trim() ? d.title : tpl.title(),
      content: nextBody,
    }));
    setInfo(`Template applied: ${tpl.label}`);
    setError(null);
  }

  function handleNew() {
    setSelectedId(null);
    setIsCreating(true);
    setError(null);
    setInfo(null);
    const tpl = NOTE_TEMPLATES.find((t) => t.id === templateId) || NOTE_TEMPLATES[0];
    setDraft({
      noteType: tpl.noteType,
      title: tpl.title(),
      content: tpl.body(ctx),
      status: 'DRAFT',
    });
  }

  function selectNote(noteId) {
    setIsCreating(false);
    setSelectedId(noteId);
    setInfo(null);
  }

  async function handleSave(finalize = false) {
    if (!visitId) return;
    if (!draft.content?.trim()) {
      setError('Note content is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        ...draft,
        status: finalize ? 'FINAL' : draft.status,
        bedLabel,
        authorName: 'Hub Clinician',
      };
      if (selectedId) {
        await updateNote(selectedId, payload);
      } else {
        const created = await createNote(visitId, payload);
        setSelectedId(created.noteId);
        setIsCreating(false);
      }
      await refresh();
      setInfo(finalize ? 'Note finalized.' : 'Draft saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!visitId) {
    return (
      <div className="empty-state glass-card">
        <p>Admit a patient to document clinical notes.</p>
      </div>
    );
  }

  const editing = Boolean(selectedId || isCreating);

  return (
    <div className="clinical-panel notes-panel">
      <div className="clinical-panel-head">
        <div>
          <h3>Clinical Notes</h3>
          <p className="muted">
            {patientName || 'Patient'}
            {patientMRN ? ` · MRN ${patientMRN}` : ''}
            {bedLabel ? ` · ${bedLabel}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleNew}>
          + New note
        </button>
      </div>

      {error && <div className="message error">{error}</div>}
      {info && !error && <div className="message success">{info}</div>}

      <div className="clinical-split">
        <aside className="clinical-list">
          {loading && <p className="muted">Loading…</p>}
          {!loading && notes.length === 0 && (
            <p className="muted">No notes yet. Start with a hospital template.</p>
          )}
          {notes.map((n) => (
            <button
              key={n.noteId}
              type="button"
              className={`clinical-list-item${selectedId === n.noteId ? ' is-selected' : ''}`}
              onClick={() => selectNote(n.noteId)}
            >
              <div className="clinical-list-top">
                <strong>{n.noteType}</strong>
                {n.status === 'DRAFT' && <span className="status-pill status-pill--draft">Draft</span>}
                {n.status === 'FINAL' && <span className="status-pill status-pill--final">Final</span>}
              </div>
              <div className="muted">{n.title || n.authorName}</div>
              <div className="muted">{formatDt(n.updatedAt)}</div>
              <div className="clinical-snippet">{(n.content || 'No content').replace(/\s+/g, ' ').slice(0, 72)}</div>
            </button>
          ))}
        </aside>

        <div className="clinical-editor glass-card">
          {!editing ? (
            <div className="clinical-empty">
              <p>Document care with a standard hospital template</p>
              <p className="muted">ICU progress, SOAP, nursing SBAR, admission, procedure, consult, or discharge.</p>
              <button type="button" className="btn btn-primary" onClick={handleNew}>
                Start new note
              </button>
            </div>
          ) : (
            <>
              <div className="notes-template-bar">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Hospital template</label>
                  <select
                    value={templateId}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                    }}
                  >
                    {NOTE_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => applyTemplate(templateId, { force: false })}
                >
                  Insert template
                </button>
              </div>

              <div className="form-grid two-col">
                <div className="form-group">
                  <label>Note type</label>
                  <input
                    value={draft.noteType}
                    onChange={(e) => setDraft({ ...draft, noteType: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Note title"
                  />
                </div>
              </div>

              <div className="form-group clinical-content-field">
                <label>Content</label>
                <textarea
                  rows={20}
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  placeholder="Structured clinical documentation…"
                  spellCheck
                />
              </div>

              <div className="form-actions-row">
                <button type="button" className="btn btn-outline" disabled={saving} onClick={() => handleSave(false)}>
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => handleSave(true)}>
                  Finalize note
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
