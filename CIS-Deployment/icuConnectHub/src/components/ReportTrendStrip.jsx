import { useEffect, useRef } from 'react';
import { formatVitalValue } from '../api/hub';

function parseTs(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function formatIstTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

export default function ReportTrendStrip({ channel, color = '#0ea5e9', height = 100 }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const points = channel?.points || [];
  const label = channel?.label || 'Trend';
  const unit = channel?.unit || '';

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !points.length) return;

    function paint() {
      const rect = wrap?.getBoundingClientRect() || canvas.getBoundingClientRect();
      const w = Math.max(rect.width || 0, 320);

      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const h = height;
      const pad = { top: 14, right: 12, bottom: 26, left: 36 };
      const plotW = w - pad.left - pad.right;
      const plotH = h - pad.top - pad.bottom;

      const parsed = points
        .map((p) => ({ t: parseTs(p.timestamp), v: Number(p.value) }))
        .filter((p) => p.t != null && !Number.isNaN(p.v));
      if (!parsed.length) return;

      const vals = parsed.map((p) => p.v);
      const vMin = Math.min(...vals);
      const vMax = Math.max(...vals);
      const margin = Math.max((vMax - vMin) * 0.1, 1);
      const axisMin = vMin - margin;
      const axisMax = vMax + margin;
      const tMin = parsed[0].t;
      const tMax = parsed[parsed.length - 1].t;
      const tSpan = Math.max(tMax - tMin, 60000);

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      parsed.forEach((p, i) => {
        const x = pad.left + ((p.t - tMin) / tSpan) * plotW;
        const y = pad.top + plotH - ((p.v - axisMin) / (axisMax - axisMin)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatIstTime(parsed[0].t), pad.left, h - 6);
      ctx.textAlign = 'right';
      ctx.fillText(formatIstTime(parsed[parsed.length - 1].t), w - pad.right, h - 6);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(formatVitalValue(label, vMax), pad.left - 4, pad.top + 8);
      ctx.fillText(formatVitalValue(label, vMin), pad.left - 4, pad.top + plotH);
    }

    paint();

    let ro;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => paint());
      ro.observe(wrap);
    }

    return () => ro?.disconnect();
  }, [points, color, height, label]);

  if (!points.length) {
    return (
      <div className="report-trend-strip report-trend-strip--empty">
        <div className="report-trend-strip-head"><strong>{label}</strong></div>
        <p className="muted">No waveform data for this period</p>
      </div>
    );
  }

  const latest = points[points.length - 1];

  return (
    <div className="report-trend-strip">
      <div className="report-trend-strip-head">
        <strong style={{ color }}>{label}</strong>
        <span>
          Latest: {formatVitalValue(label, latest.value)} {unit}
          {' · '}
          {formatIstTime(latest.timestamp)} IST
        </span>
      </div>
      <div className="report-trend-canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="report-trend-canvas" style={{ height }} aria-label={`${label} waveform`} />
      </div>
      <div className="report-trend-strip-meta">
        <span>{channel.fromDisplay}</span>
        <span>→</span>
        <span>{channel.toDisplay}</span>
        <span>{points.length} samples</span>
      </div>
    </div>
  );
}
