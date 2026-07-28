import ReportTrendStrip from './ReportTrendStrip';

function formatIst(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function WaveformsSection({ waveforms, waveformSummary }) {
  const wf = waveforms || {};
  const channels = [
    { key: 'heartRate', color: '#ef4444' },
    { key: 'spo2', color: '#f59e0b' },
    { key: 'respRate', color: '#0ea5e9' },
  ];
  const hasAny = channels.some(({ key }) => (wf[key]?.points || []).length > 0);
  const summary = waveformSummary || {};

  return (
    <section className="report-section report-section--waveforms">
      <h4>Waveforms</h4>
      {(summary.heartRate != null || summary.spo2 != null || summary.respRate != null) && (
        <div className="report-waveform-summary">
          {summary.heartRate != null && (
            <span>HR <strong>{summary.heartRate}</strong> bpm</span>
          )}
          {summary.spo2 != null && (
            <span>SpO₂ <strong>{summary.spo2}</strong>%</span>
          )}
          {summary.respRate != null && (
            <span>RR <strong>{summary.respRate}</strong> bpm</span>
          )}
        </div>
      )}
      {!hasAny ? (
        <p className="report-empty">No waveform trend data for this day.</p>
      ) : (
        <div className="report-waveform-grid">
          {channels.map(({ key, color }) => (
            <ReportTrendStrip key={key} channel={wf[key]} color={color} height={110} />
          ))}
        </div>
      )}
    </section>
  );
}

function HourlyGrid({ rows }) {
  if (!rows?.length) {
    return <p className="report-empty">No hourly trend data for this day — vitals may not have been recorded during this 24h period (IST).</p>;
  }
  const labels = rows[0]?.hourLabels || [];
  const mid = Math.ceil(labels.length / 2);

  function renderBlock(blockLabels, hourStart, hourEnd, showDayAvg) {
    return (
      <table className="report-grid">
        <thead>
          <tr>
            <th className="report-grid-sticky">Parameter</th>
            {blockLabels.map((h) => <th key={h}>{h}</th>)}
            {showDayAvg && <th>Day Avg</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.param}-${hourStart}`}>
              <td className="report-grid-sticky">{row.param}</td>
              {(row.hours || []).slice(hourStart, hourEnd).map((v, i) => (
                <td key={i}>{v != null ? v : ''}</td>
              ))}
              {showDayAvg && <td><strong>{row.dayAvg != null ? row.dayAvg : ''}</strong></td>}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (labels.length <= 13) {
    return (
      <div className="report-table-scroll">
        {renderBlock(labels, 0, labels.length, true)}
      </div>
    );
  }

  const amLabels = labels.slice(0, mid);
  const pmLabels = labels.slice(mid);
  return (
    <div className="report-hourly-grids">
      <div className="report-table-scroll">
        <p className="report-hourly-split-label">{amLabels[0]} – {amLabels[amLabels.length - 1]}</p>
        {renderBlock(amLabels, 0, mid, false)}
      </div>
      <div className="report-table-scroll">
        <p className="report-hourly-split-label">{pmLabels[0]} – {pmLabels[pmLabels.length - 1]}</p>
        {renderBlock(pmLabels, mid, labels.length, true)}
      </div>
    </div>
  );
}

function FluidsSection({ fluids }) {
  if (!fluids) return null;
  return (
    <section className="report-section">
      <h4>Fluids &amp; I/O Balance</h4>
      <div className="report-fluid-totals">
        <span>Total Intake: <strong>{fluids.totalIntakeMl} ml</strong></span>
        <span>Total Output: <strong>{fluids.totalOutputMl} ml</strong></span>
        <span>24 hr Balance: <strong>{fluids.balance24hMl} ml</strong></span>
      </div>
      {fluids.intake?.length > 0 && (
        <>
          <h5>Daily Intake</h5>
          <table className="report-data-table">
            <thead><tr><th>Fluid</th><th>Category</th><th>Volume</th><th>Time (IST)</th></tr></thead>
            <tbody>
              {fluids.intake.map((row, i) => (
                <tr key={i}>
                  <td>{row.fluidName}</td>
                  <td>{row.category || '—'}</td>
                  <td>{row.dayTotal != null ? `${row.dayTotal} ml` : `${row.volumeMl || 0} ml`}</td>
                  <td>{row.recordedAt ? formatIst(row.recordedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {fluids.output?.length > 0 && (
        <>
          <h5>Daily Output</h5>
          <table className="report-data-table">
            <thead><tr><th>Output</th><th>Category</th><th>Volume</th><th>Time (IST)</th></tr></thead>
            <tbody>
              {fluids.output.map((row, i) => (
                <tr key={i}>
                  <td>{row.fluidName}</td>
                  <td>{row.category || '—'}</td>
                  <td>{row.volumeMl} ml</td>
                  <td>{row.recordedAt ? formatIst(row.recordedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function PatientHeader({ report }) {
  const s = report.patientSummary || {};
  const p = report.patient || {};
  return (
    <header className="report-patient-header">
      <div className="report-header-grid">
        <div><span className="lbl">Name</span><span>{s.patientName || p.fullName}</span></div>
        <div><span className="lbl">CR No.</span><span className="num">{s.mrn || p.mrn || p.crn}</span></div>
        <div><span className="lbl">Admit Date</span><span className="num">{report.admitDate}</span></div>
        <div><span className="lbl">Doctor</span><span>{s.attendingPhysician || s.doctorName || '—'}</span></div>
        <div><span className="lbl">Age / Gender</span><span>{[s.age, s.gender].filter(Boolean).join(' / ') || '—'}</span></div>
        <div><span className="lbl">Weight</span><span className="num">{s.weightKg != null ? `${s.weightKg} kg` : '—'}</span></div>
        <div><span className="lbl">Height</span><span className="num">{s.heightCm != null ? `${s.heightCm} cm` : '—'}</span></div>
        <div><span className="lbl">Blood Group</span><span>{s.bloodGroup || '—'}</span></div>
        <div><span className="lbl">Bed</span><span>{s.bedLabel || report.bedId || '—'}</span></div>
        <div><span className="lbl">Diagnosis</span><span>{s.primaryDiagnosis || s.diagnosis || '—'}</span></div>
      </div>
      <div className="report-meta-line">
        <span>Report period: <span className="num">{report.fromDate} — {report.toDate}</span></span>
        <span>LOS: <span className="num">{report.losDays} day(s)</span></span>
        <span>Generated: <span className="num">{formatIst(report.generatedAt)} IST</span></span>
      </div>
    </header>
  );
}

function DayReport({ day, showFull }) {
  const overview = day.overview || {};
  const overviewKeys = Object.keys(overview);

  return (
    <article className="report-day-page">
      <div className="report-day-banner">
        <h3>ICU Daily Chart — {day.dateDisplay}</h3>
        <span>ICU Day {day.dayNumber}</span>
      </div>

      {overviewKeys.length > 0 && (
        <section className="report-section">
          <h4>Overview (latest values)</h4>
          <div className="report-overview-grid">
            {overviewKeys.map((k) => (
              <div key={k} className="report-overview-tile">
                <span className="lbl">{k}</span>
                <span className="val">{overview[k]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showFull && (
        <>
          <section className="report-section">
            <h4>Trends (hourly)</h4>
            <HourlyGrid rows={day.vitalsHourly} />
          </section>

          <WaveformsSection waveforms={day.waveforms} waveformSummary={day.waveformSummary} />

          <FluidsSection fluids={day.fluids} />

          <section className="report-section">
            <h4>Labs &amp; Images</h4>
            {day.labs?.length === 0 && day.imaging?.length === 0 ? (
              <p className="report-empty">No lab or imaging for this day.</p>
            ) : (
              <>
                {day.labs?.length > 0 && (
                  <table className="report-data-table">
                    <thead><tr><th>Test</th><th>Result</th><th>Flag</th><th>Ref</th><th>Time</th></tr></thead>
                    <tbody>
                      {day.labs.map((l, i) => (
                        <tr key={i}>
                          <td>{l.testName}</td>
                          <td>{l.value} {l.unit}</td>
                          <td>{l.flag}</td>
                          <td>{l.referenceRange}</td>
                          <td>{formatIst(l.resultedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {day.imaging?.length > 0 && (
                  <table className="report-data-table">
                    <thead><tr><th>Study</th><th>Modality</th><th>Findings</th><th>Time</th></tr></thead>
                    <tbody>
                      {day.imaging.map((img, i) => (
                        <tr key={i}>
                          <td>{img.studyName}</td>
                          <td>{img.modality}</td>
                          <td>{img.impression || img.findings}</td>
                          <td>{formatIst(img.studyAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>

          <section className="report-section">
            <h4>Order Management</h4>
            {day.orders?.length === 0 ? (
              <p className="report-empty">No active or historical orders for this day.</p>
            ) : (
              <table className="report-data-table report-orders-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Route / Dose</th>
                    <th>Priority</th>
                    <th>Ordered</th>
                    <th>D/C</th>
                  </tr>
                </thead>
                <tbody>
                  {day.orders.map((o) => (
                    <tr key={o.orderId || `${o.orderText}-${o.orderedAt}`} className={o.status === 'DISCONTINUED' ? 'report-row-dc' : ''}>
                      <td>
                        <strong>{o.orderText}</strong>
                        {o.frequency && <div className="report-order-sub">{o.frequency}{o.duration ? ` · ${o.duration}` : ''}</div>}
                      </td>
                      <td>{o.orderType}</td>
                      <td><span className={`report-status report-status--${(o.status || '').toLowerCase()}`}>{o.status}</span></td>
                      <td>{[o.route, o.dose].filter(Boolean).join(' ') || '—'}</td>
                      <td>{o.priority}</td>
                      <td>
                        <div>{formatIst(o.orderedAt)}</div>
                        <div className="report-order-sub">{o.orderedBy}</div>
                      </td>
                      <td>
                        {o.discontinuedAt ? (
                          <>
                            <div>{formatIst(o.discontinuedAt)}</div>
                            {o.discontinueReason && <div className="report-order-sub">{o.discontinueReason}</div>}
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="report-section">
            <h4>Clinical Notes</h4>
            {day.notes?.length === 0 ? (
              <p className="report-empty">No notes for this day.</p>
            ) : (
              <table className="report-data-table">
                <thead><tr><th>Type</th><th>Title</th><th>Author</th><th>Time</th><th>Content</th></tr></thead>
                <tbody>
                  {day.notes.map((n, i) => (
                    <tr key={i}>
                      <td>{n.noteType}</td>
                      <td>{n.title || '—'}</td>
                      <td>{n.authorName}</td>
                      <td>{formatIst(n.createdAt)}</td>
                      <td>{n.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </article>
  );
}

export default function ReportPreview({ report, reportType }) {
  if (!report) {
    return (
      <div className="report-preview-empty">
        <p>Configure parameters and generate a report to preview real backend data.</p>
      </div>
    );
  }

  const isComplete = reportType === 'COMPLETE_PATIENT' || report.reportType === 'COMPLETE_PATIENT';
  const title = isComplete ? 'Complete ICU Patient Report' : 'Clinical Summary';

  return (
    <div className="report-preview" id="report-print-root">
      <div className="report-preview-title">
        <h2>{title}</h2>
        <p className="muted">{report.fileName}.pdf</p>
      </div>
      <PatientHeader report={report} />
      {(report.dailyReports || []).map((day) => (
        <DayReport key={day.date} day={day} showFull={isComplete || reportType !== 'OPERATIONAL_REPORT'} />
      ))}
      <footer className="report-footer">
        <p>Sentra ICU — Confidential patient record</p>
        <p>Timezone: Asia/Kolkata (IST) · Indian date format dd/MM/yyyy</p>
      </footer>
    </div>
  );
}
