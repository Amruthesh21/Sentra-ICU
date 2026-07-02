import { useEffect, useRef } from 'react';

function gauss(t, c, w, amp) {
  const d = (t - c) / w;
  return amp * Math.exp(-d * d);
}

/** Lead-specific ECG morphology (Lead I / II / III style differences). */
function ecgSample(beatPhase, lead = 2) {
  const t = ((beatPhase % 1) + 1) % 1;
  let y = 0;

  const rAmp = lead === 1 ? 0.72 : lead === 3 ? 0.88 : 1.0;
  const sAmp = lead === 1 ? 0.22 : lead === 3 ? 0.38 : 0.32;
  const pAmp = lead === 3 ? 0.08 : 0.12;
  const tAmp = lead === 1 ? 0.22 : 0.28;
  const phaseShift = lead === 1 ? 0.01 : lead === 3 ? -0.012 : 0;
  const tt = ((t + phaseShift) % 1 + 1) % 1;

  y += gauss(tt, 0.16, 0.035, pAmp);
  y -= gauss(tt, 0.27, 0.018, 0.14);
  y += gauss(tt, 0.31, 0.022, rAmp);
  y -= gauss(tt, 0.36, 0.02, sAmp);
  y += gauss(tt, 0.52, 0.07, tAmp);
  if (lead === 3) y *= -0.92;
  y += Math.sin(tt * Math.PI * 2 * 0.4) * 0.012;
  return y;
}

function plethSample(beatPhase) {
  const t = ((beatPhase % 1) + 1) % 1;
  let y = 0.05;

  if (t < 0.14) {
    const u = t / 0.14;
    y += Math.pow(Math.sin(u * Math.PI * 0.5), 0.65) * 0.82;
  } else if (t < 0.38) {
    const u = (t - 0.14) / 0.24;
    y += (1 - u * 0.55) * 0.82;
    y -= gauss(t, 0.28, 0.035, 0.18);
  } else {
    const u = (t - 0.38) / 0.62;
    y += (0.37 - u * 0.32);
  }

  return y;
}

function respSample(breathPhase) {
  const t = ((breathPhase % 1) + 1) % 1;
  const inspFraction = 0.42;

  if (t < inspFraction) {
    const u = t / inspFraction;
    return -0.55 + Math.sin(u * Math.PI * 0.5) * 1.1;
  }
  const u = (t - inspFraction) / (1 - inspFraction);
  return 0.55 - Math.pow(u, 0.75) * 1.1;
}

function sampleWaveform(phase, kind, ecgLead) {
  if (kind === 'ecg') return ecgSample(phase, ecgLead);
  if (kind === 'pleth') return plethSample(phase);
  return respSample(phase);
}

export default function WaveformCanvas({
  heartRate = 72,
  respiratoryRate = 16,
  color = '#22c55e',
  label = 'ECG 2',
  mode = 'ecg',
  ecgLead = 2,
  active = true,
  statusValue,
  statusUnit = '',
}) {
  const canvasRef = useRef(null);
  const sweepRef = useRef(0);
  const lastTsRef = useRef(null);

  const displayValue = active && statusValue != null && statusValue !== ''
    ? statusValue
    : '--';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let animId;

    function draw(ts) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 88 * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = 88;
      const mid = h / 2;

      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      const sweepSeconds = 4;
      if (active) {
        sweepRef.current += dt / sweepSeconds;
        if (sweepRef.current > 1) sweepRef.current -= 1;
      }

      const bpm = Math.max(40, Math.min(heartRate || 72, 180));
      const rr = Math.max(8, Math.min(respiratoryRate || 16, 40));
      const rateHz = mode === 'resp' ? rr / 60 : bpm / 60;
      const amp = mode === 'resp' ? 0.36 : mode === 'pleth' ? 0.44 : 0.42;

      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      const waveColor = active ? color : 'rgba(100, 116, 139, 0.45)';
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = mode === 'ecg' ? 1.6 : 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      const sweepX = sweepRef.current * w;
      const points = Math.max(Math.floor(w * 1.5), 320);

      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        let y = mid;

        if (active) {
          const lookback = (sweepX - x + w) % w;
          const secondsAgo = (lookback / w) * sweepSeconds;
          const phase = secondsAgo * rateHz;
          const yNorm = sampleWaveform(phase, mode, ecgLead);
          y = mid - yNorm * (h * amp);
        }

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (active) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sweepX, 0);
        ctx.lineTo(sweepX, h);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      lastTsRef.current = null;
    };
  }, [heartRate, respiratoryRate, color, mode, ecgLead, active]);

  return (
    <div className={`waveform-panel${active ? '' : ' waveform-panel--inactive'}`}>
      <div className="waveform-panel-head">
        <div className="waveform-label" style={{ color: active ? color : '#64748b' }}>
          {label}
        </div>
        <div className={`waveform-status${active ? ' waveform-status--live' : ''}`}>
          <span className="waveform-status-value">{displayValue}</span>
          {statusUnit && <span className="waveform-status-unit">{statusUnit}</span>}
          {!active && <span className="waveform-status-hint">No signal</span>}
        </div>
      </div>
      <canvas ref={canvasRef} className="waveform-canvas" style={{ height: 88 }} />
    </div>
  );
}
