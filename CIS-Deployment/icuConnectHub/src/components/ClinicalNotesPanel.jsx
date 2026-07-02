import { useEffect, useState } from 'react';
import { createNote, listNotes, updateNote } from '../api/clinical';

function formatDt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ClinicalNotesPanel({ visitId, patientName, patientMRN, bedLabel }) {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState({ noteType: 'Progress Note', title: '', content: '', status: 'DRAFT' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
    }
  }, [selectedId, selected?.noteId]);

  function handleNew() {
    setSelectedId(null);
    setIsCreating(true);
    setDraft({ noteType: 'Progress Note', title: '', content: '', status: 'DRAFT' });
    setError(null);
  }

  function selectNote(noteId) {
    setIsCreating(false);
    setSelectedId(noteId);
  }

  async function handleSave(finalize = false) {
    if (!visitId) return;
    setSaving(true);
    setError(null);
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
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!visitId) {
    return <div className="empty-state glass-card"><p>Admit a patient to add clinical notes.</p></div>;
  }

  return (
    <div className="clinical-panel">
      <div className="clinical-panel-head">
        <div>
          <h3>Clinical Notes</h3>
          <p className="muted">Patient: {patientName} · MRN {patientMRN}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleNew}>+ Add New Note</button>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="clinical-split">
        <aside className="clinical-list">
          {loading && <p className="muted">Loading…</p>}
          {!loading && notes.length === 0 && <p className="muted">No notes yet.</p>}
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
              </div>
              <div className="muted">{n.authorName}</div>
              <div className="muted">{formatDt(n.updatedAt)}</div>
              <div className="clinical-snippet">{(n.content || 'No content').slice(0, 60)}</div>
            </button>
          ))}
        </aside>

        <div className="clinical-editor glass-card">
          {!selectedId && !isCreating ? (
            <div className="clinical-empty">
              <p>No note selected</p>
              <p className="muted">Select a note or create a new one.</p>
              <button type="button" className="btn btn-primary" onClick={handleNew}>Create New Note</button>
            </div>
          ) : (
            <>
              <div className="form-grid two-col">
                <div className="form-group">
                  <label>Note type</label>
                  <select value={draft.noteType} onChange={(e) => setDraft({ ...draft, noteType: e.target.value })}>
                    <option>Progress Note</option>
                    <option>Nursing Note</option>
                    <option>Consultation</option>
                    <option>Discharge Summary</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Optional title" />
                </div>
              </div>
              <div className="form-group clinical-content-field">
                <label>Content</label>
                <textarea
                  rows={16}
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  placeholder="Enter clinical note…"
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
