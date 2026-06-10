import { useEffect, useRef } from 'react';
import { formatVitalValue, normalizeParamName } from '../api/hub';

/** Padding when all points are equal — gives a clinically sensible Y-axis span. */
function clinicalPadding(paramName, value) {
  const key = normalizeParamName(paramName || '');
  const name = paramName || key;
  if (name === 'SpO2') return 2;
  if (name.startsWith('Temp')) return 0.5;
  if (name === 'Inf Rate') return 2;
  if (name === 'Inf Vol' || name === 'Bolus Vol') return 5;
  if (name === 'Heart Rate' || key === 'HeartRate' || name === 'Pulse' || name === 'Resp.Rate') return 8;
  if (name === 'Bolus Rate') return 200;
  if (name === 'PEEP' || name === 'Peak') return 4;
  if (name === 'FiO2') return 5;
  return Math.max(Math.abs(value) * 0.08, 1);
}

function computeAxisRange(values, paramName) {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = dataMax - dataMin;

  if (span > 0.001) {
    const margin = Math.max(span * 0.12, clinicalPadding(paramName, dataMin) * 0.25);
    return { axisMin: dataMin - margin, axisMax: dataMax + margin };
  }

  const pad = clinicalPadding(paramName, dataMin);
  return { axisMin: dataMin - pad, axisMax: dataMax + pad };
}

function valueToY(value, axisMin, axisMax, plotTop, plotH) {
  const range = axisMax - axisMin || 1;
  return plotTop + plotH - ((value - axisMin) / range) * plotH;
}

export default function TrendChart({ series, paramName, color = '#0ea5e9', height = 120 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !series?.length) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = height;
    const padding = { top: 10, right: 12, bottom: 22, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const values = series.map((p) => Number(p.value)).filter((v) => !Number.isNaN(v));
    if (!values.length) return;

    const { axisMin, axisMax } = computeAxisRange(values, paramName);
    const range = axisMax - axisMin || 1;
    const latest = values[values.length - 1];

    ctx.clearRect(0, 0, w, h);

    // Horizontal grid + Y-axis labels (top / mid / bottom)
    const ticks = [axisMax, axisMin + range / 2, axisMin];
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';

    ticks.forEach((tick, i) => {
      const y = valueToY(tick, axisMin, axisMax, padding.top, plotH);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const label = formatVitalValue(paramName, tick);
      ctx.fillText(label, 4, y + (i === 0 ? 10 : i === ticks.length - 1 ? 4 : 3));
    });

    // Axes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.lineTo(w - padding.right, h - padding.bottom);
    ctx.stroke();

    // Latest value badge (right)
    ctx.fillStyle = color;
    ctx.font = 'bold 11px Inter, sans-serif';
    const latestLabel = formatVitalValue(paramName, latest);
    ctx.fillText(latestLabel, w - padding.right - ctx.measureText(latestLabel).width, padding.top + 10);

    // Trend line + fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '05');

    ctx.beginPath();
    series.forEach((point, i) => {
      const x = padding.left + (i / Math.max(series.length - 1, 1)) * plotW;
      const y = valueToY(Number(point.value), axisMin, axisMax, padding.top, plotH);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(padding.left + plotW, h - padding.bottom);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [series, color, height, paramName]);

  if (!series?.length) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 13 }}>
        Collecting trend points…
      </div>
    );
  }

  return <canvas ref={canvasRef} className="chart-canvas" style={{ height }} />;
}
