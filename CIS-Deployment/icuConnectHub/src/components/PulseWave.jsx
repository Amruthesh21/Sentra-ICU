import { useEffect, useRef } from 'react';

const COLORS = {
  critical: '#e11d2e',
  warning: '#e59a2b',
  stable: '#22c55e',
};

/** Build one ECG-like beat (normalized y: 0 baseline, up = QRS peak) */
function beatSamples(kind, samplesPerBeat) {
  const out = new Array(samplesPerBeat);
  for (let i = 0; i < samplesPerBeat; i++) {
    const t = i / samplesPerBeat;
    let y = 0;
    // P wave
    if (t > 0.08 && t < 0.18) {
      const u = (t - 0.08) / 0.1;
      y += 0.18 * Math.sin(Math.PI * u);
    }
    // QRS
    if (t > 0.28 && t < 0.42) {
      const u = (t - 0.28) / 0.14;
      if (u < 0.15) y -= 0.15 * (u / 0.15);
      else if (u < 0.45) y += -0.15 + 1.35 * ((u - 0.15) / 0.3);
      else if (u < 0.65) y += 1.2 - 1.55 * ((u - 0.45) / 0.2);
      else y += -0.35 + 0.35 * ((u - 0.65) / 0.35);
    }
    // T wave
    if (t > 0.52 && t < 0.78) {
      const u = (t - 0.52) / 0.26;
      y += 0.28 * Math.sin(Math.PI * u);
    }
    // Status character
    if (kind === 'critical') {
      y *= 1.15;
      if (t > 0.2 && t < 0.25) y += (Math.random() - 0.5) * 0.35;
      if (t > 0.85) y += Math.sin(t * 40) * 0.08;
    } else if (kind === 'warning') {
      y *= 0.95;
      if (t > 0.9) y += Math.sin(t * 28) * 0.05;
    } else {
      y *= 0.85;
    }
    out[i] = y;
  }
  return out;
}

/**
 * Live scrolling ECG-style waveform (canvas), not a static image.
 * status: critical | warning | stable | offline
 * live: false = no device signal — baseline only, never a fake heartbeat.
 */
export default function PulseWave({ status = 'stable', height = 48, live = true }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const color = live ? (COLORS[status] || COLORS.stable) : '#9aa3b2';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Ring buffer of y samples (-1..1-ish)
    const capacity = 480;
    const buf = new Float32Array(capacity);
    let write = 0;
    let filled = 0;

    const bpm = status === 'critical' ? 118 : status === 'warning' ? 96 : 78;
    const samplesPerBeat = Math.max(28, Math.round(3600 / bpm));
    let beat = beatSamples(status, samplesPerBeat);
    let beatIdx = 0;
    let sampleAcc = 0;

    // px/sec scroll — looks like a bedside monitor
    const scrollPxPerSec = status === 'critical' ? 95 : status === 'warning' ? 78 : 62;
    // sample rate ~ one sample per ~2px at typical width
    let last = performance.now();

    function resize() {
      const parent = canvas.parentElement;
      const cssW = Math.max(120, parent?.clientWidth || 280);
      const cssH = height;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: cssW, h: cssH };
    }

    let size = resize();
    const onResize = () => {
      size = resize();
    };
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { size = resize(); })
      : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);

    function pushSample(v) {
      buf[write] = v;
      write = (write + 1) % capacity;
      if (filled < capacity) filled += 1;
    }

    function draw() {
      const { w, h } = size;
      ctx.clearRect(0, 0, w, h);

      // faint baseline
      ctx.strokeStyle = 'rgba(150, 160, 175, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      ctx.lineTo(w, h * 0.55);
      ctx.stroke();

      const n = Math.min(filled, Math.floor(w / 1.6));
      if (n < 2) return;

      const mid = h * 0.55;
      const amp = h * (status === 'critical' ? 0.42 : 0.36);

      ctx.beginPath();
      ctx.lineWidth = 1.85;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;

      for (let i = 0; i < n; i++) {
        // oldest → left, newest → right (sweep feel)
        const idx = (write - n + i + capacity) % capacity;
        const x = (i / (n - 1)) * w;
        const y = mid - buf[idx] * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // soft glow trail
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!live) {
        pushSample(0);
        draw();
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // How many samples to advance based on scroll speed
      const samplesNeeded = scrollPxPerSec * dt / 1.6;
      sampleAcc += samplesNeeded;
      while (sampleAcc >= 1) {
        sampleAcc -= 1;
        if (beatIdx >= beat.length) {
          beat = beatSamples(status, samplesPerBeat);
          beatIdx = 0;
        }
        pushSample(beat[beatIdx++]);
      }

      draw();
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [status, height, live]);

  return (
    <div className="pulse-wave-wrap" style={{ height }} aria-hidden="true">
      <canvas ref={canvasRef} className="pulse-wave" />
    </div>
  );
}
