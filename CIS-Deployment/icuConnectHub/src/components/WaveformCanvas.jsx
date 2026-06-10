import { useEffect, useRef } from 'react';

/**
 * Clinical-style scrolling waveforms (monitor sweep ~4 s viewport @ ~25 mm/s feel).
 * Morphology follows standard ICU monitor patterns for Lead II ECG, arterial PLETH,
 * and impedance/capnography-style RESP.
 */

/** Gaussian bump centred at c with half-width w */
function gauss(t, c, w, amp) {
  const d = (t - c) / w;
  return amp * Math.exp(-d * d);
}

/** Lead II ECG — P, QRS (Q-R-S), T with flat ST segment */
function ecgSample(beatPhase) {
  const t = ((beatPhase % 1) + 1) % 1;
  let y = 0;

  // P wave
  y += gauss(t, 0.16, 0.035, 0.12);
  // Q
  y -= gauss(t, 0.27, 0.018, 0.14);
  // R — dominant upward deflection (Lead II)
  y += gauss(t, 0.31, 0.022, 1.0);
  // S
  y -= gauss(t, 0.36, 0.02, 0.32);
  // T wave
  y += gauss(t, 0.52, 0.07, 0.28);

  // Baseline wander (very subtle)
  y += Math.sin(t * Math.PI * 2 * 0.4) * 0.012;
  return y;
}

/** Arterial pleth — fast upstroke, dicrotic notch, gradual runoff */
function plethSample(beatPhase) {
  const t = ((beatPhase % 1) + 1) % 1;
  let y = 0.05;

  if (t < 0.14) {
    // Rapid systolic upstroke
    const u = t / 0.14;
    y += Math.pow(Math.sin(u * Math.PI * 0.5), 0.65) * 0.82;
  } else if (t < 0.38) {
    // Downstroke + dicrotic notch
    const u = (t - 0.14) / 0.24;
    y += (1 - u * 0.55) * 0.82;
    y -= gauss(t, 0.28, 0.035, 0.18);
  } else {
    // Diastolic decay
    const u = (t - 0.38) / 0.62;
    y += (0.37 - u * 0.32);
  }

  return y;
}

/** Respiratory — asymmetric inspiration / expiration */
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

function sampleWaveform(phase, kind) {
  if (kind === 'ecg') return ecgSample(phase);
  if (kind === 'pleth') return plethSample(phase);
  return respSample(phase);
}

export default function WaveformCanvas({
  heartRate = 72,
  respiratoryRate = 16,
  color = '#22c55e',
  label = 'ECG II',
  mode = 'ecg',
}) {
  const canvasRef = useRef(null);
  const sweepRef = useRef(0);
  const lastTsRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let animId;

    function draw(ts) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 96 * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = 96;
      const mid = h / 2;

      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      const sweepSeconds = 4;
      sweepRef.current += dt / sweepSeconds;
      if (sweepRef.current > 1) sweepRef.current -= 1;

      const bpm = Math.max(40, Math.min(heartRate || 72, 180));
      const rr = Math.max(8, Math.min(respiratoryRate || 16, 40));
      const rateHz = mode === 'resp' ? rr / 60 : bpm / 60;

      const amp = mode === 'resp' ? 0.36 : mode === 'pleth' ? 0.44 : 0.42;

      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(0, 0, w, h);

      // Baseline grid
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = mode === 'ecg' ? 1.6 : 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      const sweepX = sweepRef.current * w;
      const points = Math.max(Math.floor(w * 1.5), 320);

      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const lookback = (sweepX - x + w) % w;
        const secondsAgo = (lookback / w) * sweepSeconds;
        const phase = secondsAgo * rateHz;
        const yNorm = sampleWaveform(phase, mode);
        const y = mid - yNorm * (h * amp);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Sweep bar
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, h);
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      lastTsRef.current = null;
    };
  }, [heartRate, respiratoryRate, color, mode]);

  return (
    <div className="waveform-panel">
      <div className="waveform-label">{label}</div>
      <canvas ref={canvasRef} className="waveform-canvas" style={{ height: 96 }} />
    </div>
  );
}
