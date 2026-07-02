import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatIst(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function downloadReportCsv(report) {
  const rows = [];
  const push = (...cols) => rows.push(cols.map(csvCell).join(','));

  push('ICU Connect Hub — Patient Report');
  push('File', report.fileName);
  push('Report type', report.reportType);
  push('Generated', formatIst(report.generatedAt));
  push('');

  const s = report.patientSummary || {};
  const p = report.patient || {};
  push('PATIENT HEADER');
  push('Name', s.patientName || p.fullName);
  push('MRN', s.mrn || p.mrn);
  push('Admit date', report.admitDate);
  push('Discharge date', report.dischargeDate || '—');
  push('Bed', s.bedLabel || report.bedId);
  push('Diagnosis', s.primaryDiagnosis || s.diagnosis);
  push('Age/Gender', [s.age, s.gender].filter(Boolean).join(' / '));
  push('Weight', s.weightKg != null ? `${s.weightKg} kg` : '');
  push('Height', s.heightCm != null ? `${s.heightCm} cm` : '');
  push('Blood group', s.bloodGroup);
  push('Period', `${report.fromDate} — ${report.toDate}`);
  push('LOS days', report.losDays);
  push('');

  (report.dailyReports || []).forEach((day) => {
    push('');
    push(`DAY ${day.dayNumber}`, day.dateDisplay);

    const overview = day.overview || {};
    if (Object.keys(overview).length) {
      push('Overview');
      Object.entries(overview).forEach(([k, v]) => push(k, v));
    }

    (day.vitalsHourly || []).forEach((row) => {
      push('Vitals hourly', row.param, ...(row.hours || []).map((h) => (h != null ? h : '')));
      push('', '', 'Day avg', row.dayAvg);
    });

    if (day.fluids) {
      push('Fluids intake ml', day.fluids.totalIntakeMl);
      push('Fluids output ml', day.fluids.totalOutputMl);
      push('Balance ml', day.fluids.balance24hMl);
      (day.fluids.intake || []).forEach((f) => push('Intake', f.fluidName, f.category, f.volumeMl || f.dayTotal, formatIst(f.recordedAt)));
      (day.fluids.output || []).forEach((f) => push('Output', f.fluidName, f.category, f.volumeMl, formatIst(f.recordedAt)));
    }

    (day.labs || []).forEach((l) => push('Lab', l.testName, `${l.value} ${l.unit || ''}`, l.flag, l.referenceRange, formatIst(l.resultedAt)));
    (day.imaging || []).forEach((img) => push('Imaging', img.studyName, img.modality, img.impression || img.findings, formatIst(img.studyAt)));

    (day.orders || []).forEach((o) => push(
      'Order', o.orderText, o.orderType, o.status, o.route, o.dose, o.priority,
      formatIst(o.orderedAt), o.orderedBy, formatIst(o.discontinuedAt), o.discontinueReason
    ));

    (day.notes || []).forEach((n) => push('Note', n.noteType, n.title, n.authorName, formatIst(n.createdAt), n.content));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.fileName || 'ICUReport'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function replaceCanvasesWithImages(sourceRoot, cloneRoot) {
  const srcCanvases = sourceRoot.querySelectorAll('canvas');
  const cloneCanvases = cloneRoot.querySelectorAll('canvas');
  const dpr = window.devicePixelRatio || 1;

  srcCanvases.forEach((src, index) => {
    const canvas = cloneCanvases[index];
    if (!canvas) return;

    let dataUrl = '';
    try {
      if (src.width > 0 && src.height > 0) {
        dataUrl = src.toDataURL('image/png');
      }
    } catch {
      dataUrl = '';
    }

    const img = document.createElement('img');
    img.className = `${canvas.className} report-trend-canvas-img`.trim();
    img.alt = canvas.getAttribute('aria-label') || 'Waveform trend';
    img.src = dataUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    const displayH = src.height > 0 ? src.height / dpr : parseInt(canvas.style.height, 10) || 110;
    img.style.width = '100%';
    img.style.height = `${displayH}px`;
    img.style.display = 'block';
    img.style.objectFit = 'contain';

    canvas.replaceWith(img);
  });
}

function buildExportStyles(pageSize) {
  const gridFont = pageSize === 'portrait' ? '7px' : '8px';
  return `
    .report-pdf-export-slice,
    .report-pdf-block-group {
      display: block;
      width: 100%;
      background: #fff;
      padding: 0;
      margin: 0;
      box-sizing: border-box;
    }
    .report-pdf-block-group .report-section {
      margin: 0 0 6px 0 !important;
      padding: 0;
    }
    .report-pdf-block-group .report-day-banner {
      margin: 0 0 8px 0 !important;
    }
    .report-pdf-block-group .report-trend-strip {
      margin: 0 0 6px 0;
    }
    .report-pdf-block-group .report-section h4 {
      margin: 0 0 6px 0;
    }
    .report-pdf-export-slice .report-preview { padding: 0; margin: 0; background: #fff; }
    .report-pdf-export-slice .report-day-page {
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }
    .report-pdf-export-slice .report-table-scroll,
    .report-pdf-export-slice .report-hourly-grids {
      overflow: visible !important;
    }
    .report-pdf-export-slice .report-grid-sticky {
      position: static !important;
      background: #f8fafc !important;
    }
    .report-pdf-export-slice .report-grid {
      table-layout: fixed;
      width: 100%;
      font-size: ${gridFont};
    }
    .report-pdf-export-slice .report-grid th,
    .report-pdf-export-slice .report-grid td {
      min-width: 0 !important;
      padding: 2px 3px;
    }
    .report-pdf-export-slice .report-trend-canvas-img {
      width: 100%;
      display: block;
    }
    .report-pdf-export-slice .report-footer {
      margin-top: 4px !important;
    }
  `;
}

function waitForImages(root) {
  const images = [...root.querySelectorAll('img')];
  return Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

function wrapNodes(...nodes) {
  const wrap = document.createElement('div');
  wrap.className = 'report-pdf-block-group';
  nodes.filter(Boolean).forEach((node) => wrap.appendChild(node.cloneNode(true)));
  return wrap;
}

/** Split waveforms / hourly trends into small atomic units that must not be cut mid-chart. */
function collectSectionBlocks(section) {
  if (section.classList.contains('report-section--waveforms')) {
    const blocks = [];
    const strips = section.querySelectorAll('.report-trend-strip');
    const emptyMsg = section.querySelector('.report-empty');

    if (strips.length === 0) {
      return [wrapNodes(section.querySelector('h4'), emptyMsg)];
    }

    const head = wrapNodes(
      section.querySelector('h4'),
      section.querySelector('.report-waveform-summary')
    );
    if (head.childNodes.length) blocks.push(head);

    strips.forEach((strip) => blocks.push(wrapNodes(strip)));
    return blocks;
  }

  const hourlyTables = section.querySelectorAll('.report-table-scroll');
  const heading = section.querySelector('h4');

  if (hourlyTables.length > 1) {
    const blocks = [];
    hourlyTables.forEach((table, index) => {
      blocks.push(wrapNodes(index === 0 ? heading : null, table));
    });
    return blocks;
  }

  return [wrapNodes(section)];
}

function collectExportBlocks(clone) {
  const blocks = [];

  const title = clone.querySelector('.report-preview-title');
  const header = clone.querySelector('.report-patient-header');
  if (title || header) {
    blocks.push(wrapNodes(title, header));
  }

  clone.querySelectorAll('.report-day-page').forEach((dayPage) => {
    const dayBanner = dayPage.querySelector('.report-day-banner');
    const sections = [...dayPage.querySelectorAll('.report-section')];

    sections.forEach((section, index) => {
      if (index === 0 && dayBanner) {
        blocks.push(wrapNodes(dayBanner, section));
        return;
      }
      blocks.push(...collectSectionBlocks(section));
    });

    if (!sections.length && dayBanner) {
      blocks.push(wrapNodes(dayBanner));
    }
  });

  const footer = clone.querySelector('.report-footer');
  if (footer) blocks.push(wrapNodes(footer));

  return blocks;
}

function canvasImageMetrics(pdf, canvas, margin) {
  const usableW = pdf.internal.pageSize.getWidth() - margin * 2;
  const imgW = usableW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  return { imgW, imgH, imgData };
}

/** Only for blocks taller than a full page (e.g. very long tables). */
function placeSplittableBlock(pdf, canvas, state) {
  const { margin, gap } = state;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const { imgW, imgH, imgData } = canvasImageMetrics(pdf, canvas, margin);

  let y = state.cursorY;
  let srcOffset = 0;

  while (srcOffset < imgH - 0.5) {
    const spaceLeft = pageHeight - margin - y;
    if (spaceLeft < 6) {
      pdf.addPage();
      y = margin;
      continue;
    }

    const drawH = Math.min(imgH - srcOffset, spaceLeft);
    pdf.addImage(imgData, 'JPEG', margin, y - srcOffset, imgW, imgH);

    srcOffset += drawH;
    if (srcOffset < imgH - 0.5) {
      pdf.addPage();
      y = margin;
    } else {
      y += drawH + gap;
    }
  }

  state.cursorY = y;
}

/**
 * Place a block as one unit: fill gap on current page, or move entire block to next page.
 * Never splits a block that fits on a single page.
 */
function placeAtomicBlock(pdf, canvas, state) {
  const { margin, gap } = state;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableH = pageHeight - margin * 2;
  const { imgW, imgH, imgData } = canvasImageMetrics(pdf, canvas, margin);

  if (imgH < 1) return;

  if (imgH > usableH) {
    placeSplittableBlock(pdf, canvas, state);
    return;
  }

  const spaceLeft = pageHeight - margin - state.cursorY;
  if (imgH > spaceLeft - 1 && state.cursorY > margin + 1) {
    pdf.addPage();
    state.cursorY = margin;
  }

  pdf.addImage(imgData, 'JPEG', margin, state.cursorY, imgW, imgH);
  state.cursorY += imgH + gap;
}

async function captureBlock(block, contentWidth, pageSize) {
  const slice = document.createElement('div');
  slice.className = 'report-pdf-export-slice';
  slice.style.width = `${contentWidth}px`;
  slice.appendChild(block);

  const mount = document.createElement('div');
  mount.className = 'report-pdf-capture-mount';
  mount.style.cssText = `position:fixed;left:-30000px;top:0;width:${contentWidth}px;background:#fff;overflow:hidden;`;

  const styleEl = document.createElement('style');
  styleEl.textContent = buildExportStyles(pageSize);
  mount.appendChild(styleEl);
  mount.appendChild(slice);
  document.body.appendChild(mount);

  try {
    await waitForImages(slice);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const height = Math.max(slice.scrollHeight, slice.offsetHeight, 1);
    slice.style.height = `${height}px`;

    const canvas = await html2canvas(slice, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: contentWidth,
      height,
      windowWidth: contentWidth,
      windowHeight: height,
    });
    return canvas;
  } finally {
    mount.remove();
  }
}

function prepareExportClone(root) {
  const clone = root.cloneNode(true);
  clone.removeAttribute('id');
  replaceCanvasesWithImages(root, clone);
  return clone;
}

/**
 * Build a real PDF with smart pagination:
 * - sections grouped by heading (banner + overview, waveform strips, etc.)
 * - auto-fills remaining page space
 * - moves whole section to next page if it does not fit (no mid-chart cuts)
 */
export async function downloadReportPdf({ pageSize = 'landscape', fileName = 'ICUReport' } = {}) {
  const root = document.getElementById('report-print-root');
  if (!root) {
    throw new Error('Generate a report before downloading PDF');
  }

  const contentWidth = pageSize === 'portrait' ? 720 : 1040;
  const clone = prepareExportClone(root);
  const blocks = collectExportBlocks(clone);

  const orientation = pageSize === 'portrait' ? 'p' : 'l';
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
  const state = { margin: 8, cursorY: 8, gap: 2 };

  try {
    await waitForImages(root);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    for (const block of blocks) {
      const canvas = await captureBlock(block, contentWidth, pageSize);
      if (!canvas?.height) continue;
      placeAtomicBlock(pdf, canvas, state);
    }

    const safeName = `${fileName || 'ICUReport'}.pdf`.replace(/[<>:"/\\|?*]+/g, '_');
    pdf.save(safeName);
  } finally {
    clone.remove?.();
  }
}

export function printReportPdf({ pageSize = 'landscape' } = {}) {
  downloadReportPdf({ pageSize, fileName: 'ICUReport-print' }).catch(() => {
    window.print();
  });
}
