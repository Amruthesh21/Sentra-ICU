import { useEffect, useRef } from 'react';
import { formatVitalValue, normalizeParamName } from '../api/hub';

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

function parseTs(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function formatTimeLabel(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TrendChart({ series, paramName, color = '#0ea5e9', height = 140 }) {
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
    const padding = { top: 10, right: 12, bottom: 28, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const points = series
      .map((p) => ({ ...p, t: parseTs(p.timestamp), v: Number(p.value) }))
      .filter((p) => p.t != null && !Number.isNaN(p.v));
    if (!points.length) return;

    const values = points.map((p) => p.v);
    const { axisMin, axisMax } = computeAxisRange(values, paramName);
    const range = axisMax - axisMin || 1;
    const latest = values[values.length - 1];

    const tMin = points[0].t;
    const tMax = points[points.length - 1].t;
    const tSpan = Math.max(tMax - tMin, 60000);

    const timeToX = (t) => padding.left + ((t - tMin) / tSpan) * plotW;

    ctx.clearRect(0, 0, w, h);

    const ticks = [axisMax, axisMin + range / 2, axisMin];
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, Arial, sans-serif';

    ticks.forEach((tick, i) => {
      const y = valueToY(tick, axisMin, axisMax, padding.top, plotH);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      const label = formatVitalValue(paramName, tick);
      ctx.fillText(label, 4, y + (i === 0 ? 10 : i === ticks.length - 1 ? 4 : 3));
    });

    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.lineTo(w - padding.right, h - padding.bottom);
    ctx.stroke();

    const xLabels = [];
    if (tSpan <= 10 * 60 * 1000) {
      const step = 60 * 1000;
      for (let t = Math.ceil(tMin / step) * step; t <= tMax; t += step) {
        xLabels.push(t);
      }
      if (xLabels.length === 0) xLabels.push(tMin, tMax);
    } else {
      xLabels.push(tMin, tMin + tSpan / 2, tMax);
    }
    xLabels.forEach((t) => {
      const label = formatTimeLabel(t);
      const x = timeToX(t);
      ctx.fillText(label, x - 16, h - 8);
    });

    ctx.fillStyle = color;
    ctx.font = 'bold 11px Inter, Arial, sans-serif';
    const latestLabel = formatVitalValue(paramName, latest);
    ctx.fillText(latestLabel, w - padding.right - ctx.measureText(latestLabel).width, padding.top + 10);

    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '05');

    ctx.beginPath();
    points.forEach((point, i) => {
      const x = timeToX(point.t);
      const y = valueToY(point.v, axisMin, axisMax, padding.top, plotH);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(timeToX(points[points.length - 1].t), h - padding.bottom);
    ctx.lineTo(timeToX(points[0].t), h - padding.bottom);
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
