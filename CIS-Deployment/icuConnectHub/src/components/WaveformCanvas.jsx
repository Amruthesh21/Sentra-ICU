import { useEffect, useRef } from 'react';

function gauss(t, c, w, amp) {
  const d = (t - c) / w;
  return amp * Math.exp(-d * d);
}

/** Lead-specific ECG morphology (Lead I / II / III) — all upright QRS for monitor display. */
function ecgSample(beatPhase, lead = 2) {
  const t = ((beatPhase % 1) + 1) % 1;
  let y = 0;

  const rAmp = lead === 1 ? 0.72 : lead === 3 ? 0.78 : 1.0;
  const sAmp = lead === 1 ? 0.22 : lead === 3 ? 0.42 : 0.32;
  const pAmp = lead === 3 ? 0.09 : 0.12;
  const tAmp = lead === 1 ? 0.22 : lead === 3 ? 0.2 : 0.28;
  const phaseShift = lead === 1 ? 0.01 : lead === 3 ? 0.008 : 0;
  const tt = ((t + phaseShift) % 1 + 1) % 1;

  y += gauss(tt, 0.16, 0.035, pAmp);
  y -= gauss(tt, 0.27, 0.018, 0.14);
  y += gauss(tt, 0.31, 0.022, rAmp);
  y -= gauss(tt, 0.36, 0.02, sAmp);
  y += gauss(tt, 0.52, 0.07, tAmp);
  y += Math.sin(tt * Math.PI * 2 * 0.4) * 0.012;
  return y;
}

/** Pleth pulse — continuous at beat wrap (t=0 and t=1 match). */
function plethSample(beatPhase) {
  const t = ((beatPhase % 1) + 1) % 1;
  // Smooth arterial pulse: rise → notch → settle back to baseline
  const rise = Math.exp(-Math.pow((t - 0.12) / 0.055, 2)) * 0.95;
  const notch = Math.exp(-Math.pow((t - 0.28) / 0.04, 2)) * 0.22;
  const settle = Math.exp(-t * 3.2) * 0.08;
  return rise - notch + settle * (1 - t);
}

/** Respiration — continuous sine-like breath, no step at cycle wrap. */
function respSample(breathPhase) {
  const t = ((breathPhase % 1) + 1) % 1;
  // Pure continuous cycle (insp/exp) — no piecewise jump at boundaries
  return Math.sin(t * Math.PI * 2) * 0.85 + Math.sin(t * Math.PI * 4) * 0.08;
}

function sampleWaveform(phase, kind, ecgLead) {
  if (kind === 'ecg') return ecgSample(phase, ecgLead);
  if (kind === 'pleth') return plethSample(phase);
  return respSample(phase);
}

/**
 * Bedside-style erase-bar waveform.
 * Critical: never connect the path across the sweep gap (that caused the vertical glitch).
 *
 * Two data sources, same rendering:
 *  - Real samples (`realSamples`/`realSampleRate`): what deviceIngestion
 *    actually decoded off the wire for this bed/channel (see
 *    api/deviceIngestion.js's getWaveforms) — auto-scaled per refresh to
 *    that window's own min/max, since raw sample units vary by device and
 *    there's no universal calibration to hardcode. The buffer is short
 *    (deviceIngestion keeps ~the last 500 samples, refreshed on each ~1s
 *    poll — that cadence tracks how often real devices actually batch
 *    waveform segments, not an arbitrary polling choice), so the visible
 *    sweep window shrinks to whatever duration is actually buffered rather
 *    than staying at the fixed synthetic-mode width — a real, short window
 *    refreshed every second reads better than a mostly-frozen long one.
 *    Playback holds on the last real sample (does not fabricate motion) if
 *    a poll is late.
 *  - No real samples for this channel (device connected but this trace
 *    isn't something it outputs, or no poll has landed yet): unchanged
 *    fallback to the modeled curve, paced by the real numeric rate.
 */
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
  realSamples = null,
  realSampleRate = null,
}) {
  const canvasRef = useRef(null);
  const sweepRef = useRef(0);
  const lastTsRef = useRef(null);
  const timeSecRef = useRef(0); // monotonic seconds — tip of sweep samples "now"
  const rateRef = useRef({
    hr: heartRate, rr: respiratoryRate, mode, ecgLead, color, active, realSamples, realSampleRate,
  });
  // Real-sample playback: readPos advances through `samples` at
  // realSampleRate while `active`; a fresh array (new poll) resets it so
  // each refresh plays from its own start rather than skipping ahead.
  const playbackRef = useRef({ samples: null, sampleRate: null, readPos: 0, min: 0, max: 1 });

  // Keep latest props without restarting RAF (vitals poll was remounting the loop → flow glitches)
  useEffect(() => {
    rateRef.current = {
      hr: heartRate, rr: respiratoryRate, mode, ecgLead, color, active, realSamples, realSampleRate,
    };
  }, [heartRate, respiratoryRate, mode, ecgLead, color, active, realSamples, realSampleRate]);

  const displayValue = active && statusValue != null && statusValue !== ''
    ? statusValue
    : '--';
  const isRealData = active && Array.isArray(realSamples) && realSamples.length > 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let animId;
    let running = true;

    function yAt(secondsAgo, rateHz, amp, h, mid, kind, lead) {
      const pb = playbackRef.current;
      if (pb.samples && pb.samples.length > 1 && pb.sampleRate) {
        // secondsAgo behind the sweep tip -> an index behind the current
        // real-sample read position, at the real sample rate.
        const idx = Math.round(pb.readPos - secondsAgo * pb.sampleRate);
        const clamped = Math.max(0, Math.min(pb.samples.length - 1, idx));
        const v = pb.samples[clamped];
        const span = pb.max - pb.min;
        const yNorm = span > 0 ? ((v - pb.min) / span) * 2 - 1 : 0; // flat signal -> flat line, honestly
        return mid - yNorm * (h * amp);
      }
      // Phosphor trail: fixed x stays frozen; only the sweep tip advances in time.
      const phase = (timeSecRef.current - secondsAgo) * rateHz;
      const yNorm = sampleWaveform(phase, kind, lead);
      return mid - yNorm * (h * amp);
    }

    function strokeSegment(x0, x1, w, h, mid, sweepX, sweepSeconds, rateHz, amp, kind, lead) {
      if (x1 <= x0 + 0.5) return;
      const span = x1 - x0;
      const steps = Math.max(12, Math.ceil(span * 1.6));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = x0 + (i / steps) * span;
        // Distance behind the sweep tip (0 = newest). Never wrap inside a segment.
        const lookbackPx = sweepX >= x ? (sweepX - x) : (sweepX + w - x);
        const secondsAgo = (lookbackPx / w) * sweepSeconds;
        const y = yAt(secondsAgo, rateHz, amp, h, mid, kind, lead);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function draw(ts) {
      if (!running) return;

      const {
        hr, rr, mode: m, ecgLead: lead, color: col, active: isLive, realSamples: rs, realSampleRate: rsr,
      } = rateRef.current;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(1, rect.width);
      const cssH = 88;

      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = cssW;
      const h = cssH;
      const mid = h / 2;

      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(Math.max((ts - lastTsRef.current) / 1000, 0), 0.05);
      lastTsRef.current = ts;

      const usingReal = isLive && Array.isArray(rs) && rs.length > 1 && rsr > 0;
      const pb = playbackRef.current;

      if (usingReal) {
        if (pb.samples !== rs) {
          // A genuinely new window arrived (fresh poll) — play it from its
          // own start, and auto-scale to its own min/max since raw sample
          // units differ per device/channel and there's no shared
          // calibration to assume.
          let min = Infinity;
          let max = -Infinity;
          for (let i = 0; i < rs.length; i++) {
            if (rs[i] < min) min = rs[i];
            if (rs[i] > max) max = rs[i];
          }
          playbackRef.current = { samples: rs, sampleRate: rsr, readPos: 0, min, max };
        } else {
          // Same window still buffered — keep advancing; hold at the last
          // sample rather than fabricate motion if we outrun the buffer
          // before the next poll refreshes it.
          pb.readPos = Math.min(pb.samples.length - 1, pb.readPos + dt * pb.sampleRate);
        }
      } else if (pb.samples) {
        playbackRef.current = { samples: null, sampleRate: null, readPos: 0, min: 0, max: 1 };
      }

      // Bedside monitors: ECG/Pleth default ~25 mm/s; RESP often slower (6.25–12.5 mm/s).
      // On a ~panel-width trace that maps to ~7.5s (ECG) / ~12s (RESP) — calmer than a 4s race.
      // Real-sample mode instead sweeps at whatever duration is actually
      // buffered (clamped to a sane range) so the trace reads as populated
      // rather than mostly-frozen after a short real-data window.
      const sweepSeconds = usingReal
        ? Math.max(1, Math.min(4, playbackRef.current.samples.length / playbackRef.current.sampleRate))
        : (m === 'resp' ? 12 : 7.5);
      const bpm = Math.max(40, Math.min(Number(hr) || 72, 180));
      const resp = Math.max(6, Math.min(Number(rr) || 16, 40));
      const rateHz = m === 'resp' ? resp / 60 : bpm / 60;
      const amp = m === 'resp' ? 0.34 : m === 'pleth' ? 0.42 : 0.42;

      if (isLive) {
        sweepRef.current += dt / sweepSeconds;
        if (sweepRef.current >= 1) sweepRef.current -= 1;
        timeSecRef.current += dt;
      }

      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      if (isLive) {
        const sweepX = sweepRef.current * w;
        // Blank erase band — never stroke across it (that vertical jump was the glitch)
        const gap = Math.max(8, Math.min(16, w * 0.02));

        ctx.strokeStyle = col;
        ctx.lineWidth = m === 'ecg' ? 1.6 : 1.8;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const leftEnd = Math.max(0, sweepX - gap);
        if (leftEnd > 1) {
          strokeSegment(0, leftEnd, w, h, mid, sweepX, sweepSeconds, rateHz, amp, m, lead);
        }

        const rightStart = Math.min(w, sweepX + 0.5);
        if (rightStart < w - 1) {
          strokeSegment(rightStart, w, w, h, mid, sweepX, sweepSeconds, rateHz, amp, m, lead);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sweepX, 0);
        ctx.lineTo(sweepX, h);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(animId);
      lastTsRef.current = null;
    };
  }, []); // mount once — live rates/colors come from refs

  return (
    <div className={`waveform-panel${active ? '' : ' waveform-panel--inactive'}`}>
      <div className="waveform-panel-head">
        <div className="waveform-label" style={{ color: active ? color : '#64748b' }}>
          {label}
          {isRealData && <span className="waveform-real-badge" title="Real device samples, not simulated">LIVE</span>}
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
