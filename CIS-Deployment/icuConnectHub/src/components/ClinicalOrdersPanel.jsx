import { useEffect, useMemo, useState } from 'react';
import { createOrder, listOrders, updateOrderStatus } from '../api/clinical';
import { useAuth } from '../context/AuthContext';

const ORDER_TYPES = [
  { value: 'MEDICATIONS', label: 'Medications', icon: 'medication', color: '#7c3aed' },
  { value: 'LABS', label: 'Labs', icon: 'science', color: '#0d9488' },
  { value: 'IMAGING', label: 'Imaging', icon: 'imagesmode', color: '#2563eb' },
  { value: 'PROCEDURES', label: 'Procedures', icon: 'clinical_notes', color: '#ea580c' },
  { value: 'DIET', label: 'Diet', icon: 'restaurant', color: '#16a34a' },
  { value: 'ACTIVITY', label: 'Activity', icon: 'directions_run', color: '#dc2626' },
];

const DRUG_FORMULARY = [
  'Norepinephrine', 'Meropenem 1g', 'Vancomycin', 'Propofol', 'Fentanyl',
  'Heparin', 'Pantoprazole', 'Enoxaparin', 'Furosemide', 'Metoprolol',
  'Midazolam', 'Dexmedetomidine', 'Ceftriaxone', 'Piperacillin-Tazobactam',
];

const ROUTES = ['IV', 'PO (Oral)', 'SC (Subcutaneous)', 'IM (Intramuscular)', 'SL (Sublingual)', 'Topical', 'Inhaled'];
const FREQUENCIES = [
  'Continuous', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'QD (Daily)', 'BID (Twice daily)',
  'TID (Three times daily)', 'PRN (As needed)', 'STAT (Immediate once)',
];
const DURATIONS = ['Until Discontinued', ...Array.from({ length: 15 }, (_, i) => `${i + 1} day${i === 0 ? '' : 's'}`)];
const PRIORITIES = [
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'STAT', label: 'STAT — Immediate', danger: true },
  { value: 'PRN', label: 'PRN — As Needed' },
];
const DISCONTINUE_REASONS = ['Patient condition changed', 'Duplicate order', 'Adverse reaction', 'Other'];
const HISTORY_TYPE_FILTER = [{ value: '', label: 'All Types' }, ...ORDER_TYPES.map((t) => ({ value: t.value, label: t.label }))];
const MAR_STATUS_FILTER = [
  { value: '', label: 'All Statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

const EMPTY_FORM = {
  orderType: 'MEDICATIONS',
  drugName: '',
  dose: '',
  route: '',
  frequency: '',
  duration: 'Until Discontinued',
  priority: 'ROUTINE',
  notes: '',
  description: '',
};

function formatDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
}

function formatDtTable(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function orderTypeMeta(type) {
  return ORDER_TYPES.find((t) => t.value === type) || { label: type, icon: 'description', color: '#64748b' };
}

function statusLabel(status) {
  if (status === 'APPROVED' || status === 'ACTIVE') return 'Approved';
  if (status === 'DISCONTINUED' || status === 'CANCELLED' || status === 'COMPLETED') return 'Discontinued';
  return status;
}

function isActiveStatus(status) {
  return status === 'APPROVED' || status === 'ACTIVE';
}

function OrderTypeCell({ type }) {
  const meta = orderTypeMeta(type);
  return (
    <span className="order-type-cell">
      <span className="material-symbols-outlined order-type-icon" style={{ color: meta.color }} aria-hidden>
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const approved = isActiveStatus(status);
  return (
    <span className={`order-status-badge ${approved ? 'is-approved' : 'is-discontinued'}`}>
      {statusLabel(status)}
    </span>
  );
}

export default function ClinicalOrdersPanel({ visitId, bedLabel }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [drugQuery, setDrugQuery] = useState('');
  const [drugOpen, setDrugOpen] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState('');
  const [marStatusFilter, setMarStatusFilter] = useState('');
  const [discontinueTarget, setDiscontinueTarget] = useState(null);
  const [discontinueReason, setDiscontinueReason] = useState('Patient condition changed');
  const [submitting, setSubmitting] = useState(false);
  const selectedTypeMeta = orderTypeMeta(form.orderType);

  const filteredDrugs = useMemo(() => {
    const q = drugQuery.trim().toLowerCase();
    if (!q) return DRUG_FORMULARY;
    return DRUG_FORMULARY.filter((d) => d.toLowerCase().includes(q));
  }, [drugQuery]);

  const activeOrders = useMemo(
    () => orders.filter((o) => isActiveStatus(o.status)),
    [orders],
  );

  const historyOrders = useMemo(() => {
    if (!historyTypeFilter) return orders;
    return orders.filter((o) => o.orderType === historyTypeFilter);
  }, [orders, historyTypeFilter]);

  const marOrders = useMemo(() => {
    let list = orders.filter((o) => o.orderType === 'MEDICATIONS');
    if (marStatusFilter) {
      list = list.filter((o) => {
        if (marStatusFilter === 'APPROVED') return isActiveStatus(o.status);
        return !isActiveStatus(o.status);
      });
    }
    return list;
  }, [orders, marStatusFilter]);

  async function refresh() {
    if (!visitId) return;
    setLoading(true);
    try {
      setOrders(await listOrders(visitId));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [visitId]);

  function openNewOrder() {
    setEditingOrder(null);
    setForm(EMPTY_FORM);
    setDrugQuery('');
    setModalOpen(true);
  }

  function openEditOrder(order) {
    setEditingOrder(order);
    setForm({
      orderType: order.orderType || 'MEDICATIONS',
      drugName: order.drugName || '',
      dose: order.dose || '',
      route: order.route || '',
      frequency: order.frequency || '',
      duration: order.duration || 'Until Discontinued',
      priority: order.priority || 'ROUTINE',
      notes: order.notes || '',
      description: order.orderText || '',
    });
    setDrugQuery(order.drugName || '');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingOrder(null);
    setDrugOpen(false);
  }

  function validateForm() {
    if (form.orderType === 'MEDICATIONS') {
      if (!form.drugName.trim()) return 'Drug name is required';
      if (!form.dose.trim()) return 'Dose is required';
      if (!form.route) return 'Route is required';
      if (!form.frequency) return 'Frequency is required';
    } else if (!form.description.trim()) {
      return 'Order description is required';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      bedLabel,
      orderedBy: user?.email || user?.displayName || 'clinician',
      orderType: form.orderType,
      priority: form.priority,
      notes: form.notes,
      duration: form.duration,
    };
    if (form.orderType === 'MEDICATIONS') {
      Object.assign(payload, {
        drugName: form.drugName.trim(),
        dose: form.dose.trim(),
        route: form.route,
        frequency: form.frequency,
      });
    } else {
      payload.orderText = form.description.trim();
      payload.drugName = form.description.trim();
    }
    try {
      if (editingOrder) {
        await updateOrderStatus(editingOrder.orderId, {
          ...payload,
          status: editingOrder.status,
        });
      } else {
        await createOrder(visitId, payload);
      }
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDiscontinue() {
    if (!discontinueTarget) return;
    setSubmitting(true);
    try {
      await updateOrderStatus(discontinueTarget.orderId, {
        status: 'DISCONTINUED',
        discontinueReason,
      });
      setDiscontinueTarget(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderActions(order, showDiscontinue = true) {
    return (
      <div className="order-actions">
        <button type="button" className="order-action-link" onClick={() => openEditOrder(order)}>
          Edit
        </button>
        {showDiscontinue && isActiveStatus(order.status) && (
          <button
            type="button"
            className="order-action-link is-danger"
            onClick={() => {
              setDiscontinueReason('Patient condition changed');
              setDiscontinueTarget(order);
            }}
          >
            D/C
          </button>
        )}
      </div>
    );
  }

  if (!visitId) {
    return <div className="empty-state glass-card"><p>Admit a patient to place orders.</p></div>;
  }

  return (
    <div className="clinical-panel order-mgmt">
      <div className="order-mgmt-head">
        <h2 className="order-mgmt-title">Order Management</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openNewOrder}>+ New Order</button>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="order-mgmt-tabs">
        <button type="button" className={`order-tab ${tab === 'active' ? 'is-active' : ''}`} onClick={() => setTab('active')}>
          Active Orders
          {activeOrders.length > 0 && <span className="order-tab-badge">{activeOrders.length}</span>}
        </button>
        <button type="button" className={`order-tab ${tab === 'history' ? 'is-active' : ''}`} onClick={() => setTab('history')}>
          Order History
        </button>
        <button type="button" className={`order-tab ${tab === 'mar' ? 'is-active' : ''}`} onClick={() => setTab('mar')}>
          MAR
        </button>
      </div>

      {tab === 'history' && (
        <div className="order-filter-bar">
          <label>Filter by type:</label>
          <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)}>
            {HISTORY_TYPE_FILTER.map((f) => <option key={f.value || 'all'} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      )}

      {tab === 'mar' && (
        <>
          <div className="order-info-banner">
            Medication Administration Record — Nursing View. Active and discontinued medication orders for this patient.
          </div>
          <div className="order-filter-bar">
            <label>Filter by status:</label>
            <select value={marStatusFilter} onChange={(e) => setMarStatusFilter(e.target.value)}>
              {MAR_STATUS_FILTER.map((f) => <option key={f.value || 'all'} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="clinical-table-wrap order-table-wrap">
        {loading ? <p className="muted order-loading">Loading orders…</p> : (
          <>
            {tab === 'active' && (
              <table className="clinical-table order-table order-table--6">
                <thead>
                  <tr>
                    <th>Order Type</th>
                    <th>Description</th>
                    <th>Ordered By</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrders.length === 0 && (
                    <tr><td colSpan={6} className="muted order-empty">No active orders.</td></tr>
                  )}
                  {activeOrders.map((o) => (
                    <tr key={o.orderId}>
                      <td><OrderTypeCell type={o.orderType} /></td>
                      <td className="order-desc">{o.orderText || o.description}</td>
                      <td className="order-by">{o.orderedBy}</td>
                      <td className="order-ts col-timestamp">{formatDtTable(o.orderedAt)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="col-actions">{renderActions(o)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'history' && (
              <table className="clinical-table order-table order-table--6">
                <thead>
                  <tr>
                    <th>Order Type</th>
                    <th>Description</th>
                    <th>Ordered By</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {historyOrders.length === 0 && (
                    <tr><td colSpan={6} className="muted order-empty">No order history.</td></tr>
                  )}
                  {historyOrders.map((o) => (
                    <tr key={o.orderId}>
                      <td><OrderTypeCell type={o.orderType} /></td>
                      <td className="order-desc">{o.orderText || o.description}</td>
                      <td className="order-by">{o.orderedBy}</td>
                      <td className="order-ts col-timestamp">{formatDtTable(o.orderedAt)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className={o.discontinueReason ? 'order-reason' : 'muted'}>
                        {o.discontinueReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'mar' && (
              <table className="clinical-table order-table order-table--mar">
                <thead>
                  <tr>
                    <th>Order Type</th>
                    <th>Description</th>
                    <th>Ordered By</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th className="col-discontinued">Discontinued At</th>
                  </tr>
                </thead>
                <tbody>
                  {marOrders.length === 0 && (
                    <tr><td colSpan={6} className="muted order-empty">No medication orders.</td></tr>
                  )}
                  {marOrders.map((o) => (
                    <tr key={o.orderId}>
                      <td><OrderTypeCell type={o.orderType} /></td>
                      <td className="order-desc">{o.orderText || o.description}</td>
                      <td className="order-by">{o.orderedBy}</td>
                      <td className="order-ts col-timestamp">{formatDtTable(o.orderedAt)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="order-ts col-discontinued">
                        {o.discontinuedAt ? formatDtTable(o.discontinuedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="order-table-footer">
              <span>{(tab === 'active' ? activeOrders : tab === 'history' ? historyOrders : marOrders).length} orders</span>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div className="order-modal-overlay" onClick={closeModal}>
          <div className="order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-head">
              <h3>{editingOrder ? 'Edit Order' : '+ New Order'}</h3>
              <button type="button" className="order-modal-close" onClick={closeModal}>×</button>
            </div>
            <form className="order-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label><span className="req">*</span> Order Type</label>
                <div className="order-type-select-wrap">
                  <span
                    className="material-symbols-outlined order-type-select-icon"
                    style={{ color: selectedTypeMeta.color }}
                    aria-hidden
                  >
                    {selectedTypeMeta.icon}
                  </span>
                  <select
                    value={form.orderType}
                    onChange={(e) => setForm({ ...form, orderType: e.target.value })}
                    className="order-type-select"
                  >
                    {ORDER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.orderType === 'MEDICATIONS' ? (
                <>
                  <div className="form-group drug-combobox">
                    <label><span className="req">*</span> Drug Name</label>
                    <input
                      value={drugQuery}
                      onChange={(e) => {
                        setDrugQuery(e.target.value);
                        setForm({ ...form, drugName: e.target.value });
                        setDrugOpen(true);
                      }}
                      onFocus={() => setDrugOpen(true)}
                      placeholder="Search formulary..."
                      autoComplete="off"
                    />
                    {drugOpen && filteredDrugs.length > 0 && (
                      <ul className="drug-dropdown">
                        {filteredDrugs.map((d) => (
                          <li key={d}>
                            <button
                              type="button"
                              onClick={() => {
                                setDrugQuery(d);
                                setForm({ ...form, drugName: d });
                                setDrugOpen(false);
                              }}
                            >
                              {d}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label><span className="req">*</span> Dose</label>
                      <input
                        required
                        value={form.dose}
                        onChange={(e) => setForm({ ...form, dose: e.target.value })}
                        placeholder="e.g. 1g, 0.1 mcg/kg/min"
                      />
                    </div>
                    <div className="form-group">
                      <label><span className="req">*</span> Route</label>
                      <select required value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}>
                        <option value="">Select route</option>
                        {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label><span className="req">*</span> Frequency</label>
                      <select required value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                        <option value="">Select frequency</option>
                        {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Duration</label>
                      <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                        {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label><span className="req">*</span> Order Description</label>
                  <input
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Enter order details..."
                  />
                </div>
              )}

              <div className="form-group">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Additional Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional instructions..."
                />
              </div>

              <div className="order-modal-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Saving…' : editingOrder ? 'Save Changes' : 'Submit Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {discontinueTarget && (
        <div className="order-modal-overlay" onClick={() => setDiscontinueTarget(null)}>
          <div className="order-modal order-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-head">
              <h3>Discontinue Order</h3>
              <button type="button" className="order-modal-close" onClick={() => setDiscontinueTarget(null)}>×</button>
            </div>
            <p className="order-discontinue-text">{discontinueTarget.orderText || discontinueTarget.description}</p>
            <div className="form-group">
              <label>Reason</label>
              <select value={discontinueReason} onChange={(e) => setDiscontinueReason(e.target.value)}>
                {DISCONTINUE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="order-modal-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setDiscontinueTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={submitting} onClick={confirmDiscontinue}>
                Discontinue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
