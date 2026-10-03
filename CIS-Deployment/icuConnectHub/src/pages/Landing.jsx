import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PulseLogo from '../components/PulseLogo';
import PulseWave from '../components/PulseWave';

const MARQUEE = ['Precision', 'Vigilance', 'Clarity', 'Continuity', 'Signal', 'Care'];

const INSTRUMENT = [
  { value: '< 1S', label: 'Alert latency' },
  { value: '24/7', label: 'Continuous telemetry' },
  { value: '6', label: 'Vital streams / bed' },
  { value: '100%', label: 'Keyboard driven' },
];

const MANIFESTO = [
  {
    n: '01',
    title: 'Signal over noise',
    body: 'Eight beds. Forty vitals. One screen. We strip the interface down to the pulse that matters, so clinicians read the room in a glance.',
  },
  {
    n: '02',
    title: 'Time is tissue',
    body: 'The moment a threshold breaks, it surfaces — no digging through tabs. Every alert is one tap from the patient it belongs to.',
  },
  {
    n: '03',
    title: 'Built for the bay',
    body: 'Sharp grids, tabular numerals, zero decoration. An instrument, not a dashboard. Engineered for the pressure of the unit.',
  },
];

const MODULES = [
  {
    id: 'vitals',
    title: 'Live Vitals',
    text: 'ECG, SpO2, BP & respiration streamed as continuous waveforms.',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3.5 12h3l2-5 3 10 2.5-5H20.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 4.5c-1.8-2-5-1.6-6.2.8C4.2 8.5 7.2 12.2 12 16c4.8-3.8 7.8-7.5 6.2-10.7-1.2-2.4-4.4-2.8-6.2-.8Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'alerts',
    title: 'Critical Alerts',
    text: 'Threshold breaches surfaced the instant they happen.',
    highlight: true,
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 18.5c.5 1.4 1.7 2 3 2s2.5-.6 3-2" strokeLinecap="round" />
        <path d="M6 9.5a6 6 0 1 1 12 0c0 4.2 1.4 5.5 1.4 5.5H4.6S6 13.7 6 9.5Z" strokeLinejoin="round" />
        <path d="M4 15.2h16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'beds',
    title: 'Bed Command',
    text: 'Real-time occupancy across every bay and ward.',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 17V10.5A2.5 2.5 0 0 1 5.5 8H10a3 3 0 0 1 3 3v1h5.5A2.5 2.5 0 0 1 21 14.5V17" strokeLinecap="round" />
        <path d="M3 17h18M6 17v2M18 17v2" strokeLinecap="round" />
        <circle cx="8" cy="6.5" r="1.8" />
      </svg>
    ),
  },
  {
    id: 'ai',
    title: 'AI Insights',
    text: 'Clinical summaries synthesized from live patient telemetry.',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3c3.5 0 6 2.7 6 6.2 0 2.2-1 3.8-2.4 5.1-.8.8-1.4 1.6-1.6 2.7H10c-.2-1.1-.8-1.9-1.6-2.7C7 13 6 11.4 6 9.2 6 5.7 8.5 3 12 3Z" />
        <path d="M10 19h4M11 21.5h2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'staff',
    title: 'Staff Grid',
    text: "Who's on duty, who's assigned, at a glance.",
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="9" cy="8" r="2.4" />
        <circle cx="16" cy="9" r="2" />
        <path d="M3.5 19c.4-3 2.6-4.8 5.5-4.8S14 16 14.4 19" strokeLinecap="round" />
        <path d="M14.2 14.6c1.4-.6 3-.5 4.4.4 1.4 1.7 1.7 3.2 1.8 3.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    title: 'Analytics',
    text: 'Occupancy, acuity and trends distilled into signal.',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 18V6M4 18h16" strokeLinecap="round" />
        <path d="M7 14l3.5-4 3 2.5L17.5 7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

function NavJump({ to, children }) {
  return (
    <a
      href={`#${to}`}
      onClick={(e) => {
        e.preventDefault();
        scrollToSection(to);
      }}
    >
      {children}
    </a>
  );
}

function LiveMonitorBar() {
  const [bpm, setBpm] = useState(72);

  useEffect(() => {
    // Simulated bedside HR — drifts slightly so it feels live, not real telemetry
    const id = setInterval(() => {
      setBpm((prev) => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return Math.max(68, Math.min(78, next));
      });
    }, 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pulse-livebar">
      <div className="pulse-livebar-left">
        <span className="pulse-live-dot" />
        <span>BED-05 · LIVE</span>
      </div>
      <div className="pulse-livebar-wave">
        <PulseWave status="stable" height={28} />
      </div>
      <div className="pulse-livebar-right">{bpm} BPM</div>
    </div>
  );
}

export default function Landing() {
  useEffect(() => {
    document.title = 'Sentra ICU';
    document.documentElement.classList.add('pulse-landing-active');
    document.body.classList.add('pulse-landing-active');
    const id = window.location.hash.replace('#', '');
    if (id) {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    return () => {
      document.documentElement.classList.remove('pulse-landing-active');
      document.body.classList.remove('pulse-landing-active');
    };
  }, []);

  return (
    <div className="pulse-landing">
      <header className="pulse-nav">
        <PulseLogo size="md" />
        <nav className="pulse-nav-links" aria-label="Landing">
          <NavJump to="system">System</NavJump>
          <NavJump to="manifesto">Manifesto</NavJump>
          <NavJump to="features">Features</NavJump>
        </nav>
        <Link to="/login" className="pulse-btn pulse-btn--solid">
          Launch <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className="pulse-hero">
        <div className="pulse-hero-copyblock">
          <p className="pulse-eyebrow">Critical care intelligence platform</p>
          <h1 className="pulse-hero-title">
            <span>The unit,</span>
            <em>in one</em>
            <span>heartbeat.</span>
          </h1>
          <p className="pulse-hero-copy">
            A next-generation critical care command surface. Real-time vitals, smart alerts,
            and AI-ready clinical insight — rendered with the precision the unit demands.
          </p>
        </div>
        <div className="pulse-hero-shot">
          <img src="/pulse-hero-team.png" alt="Doctors and nurses" />
        </div>
      </section>

      <section className="pulse-marquee" aria-hidden="true">
        <div className="pulse-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((word, i) => (
            <span key={`${word}-${i}`}>
              {word}
              <i>·</i>
            </span>
          ))}
        </div>
      </section>

      <section className="pulse-system" id="system">
        <header className="pulse-section-head">
          <p className="pulse-section-label">System</p>
          <h2>The instrument behind the bay.</h2>
        </header>
        <div className="pulse-visual" aria-label="Live unit preview">
          <div className="pulse-visual-frame">
            <img
              src="/pulse-icu-hero-room.png"
              alt="ICU room"
              className="pulse-visual-img"
            />
            <LiveMonitorBar />
          </div>
        </div>
        <div className="pulse-instrument">
          <div className="pulse-instrument-grid">
            {INSTRUMENT.map((item) => (
              <div key={item.label} className="pulse-instrument-cell">
                <div className="pulse-instrument-value">{item.value}</div>
                <div className="pulse-instrument-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pulse-manifesto" id="manifesto">
        <header className="pulse-section-head">
          <p className="pulse-section-label">Manifesto</p>
          <h2>System manifesto</h2>
        </header>
        {MANIFESTO.map((item) => (
          <article key={item.n} className="pulse-manifesto-row">
            <div className="pulse-manifesto-num">{item.n}</div>
            <div className="pulse-manifesto-body">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="pulse-modules" id="features">
        <header className="pulse-section-head pulse-modules-head">
          <div>
            <p className="pulse-section-label">Features</p>
            <h2>Everything, on screen.</h2>
          </div>
          <span>06 modules</span>
        </header>
        <div className="pulse-modules-grid">
          {MODULES.map((m) => (
            <article key={m.id} className={`pulse-module${m.highlight ? ' is-dark' : ''}`}>
              <div className="pulse-module-icon">{m.icon}</div>
              <h3>{m.title}</h3>
              <p>{m.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pulse-close">
        <h2>
          Step into
          <br />
          the unit.
        </h2>
        <Link to="/login" className="pulse-btn pulse-btn--light">
          Launch Sentra ICU <span aria-hidden="true">↗</span>
        </Link>
        <footer className="pulse-footer">
          <span>Sentra ICU — clinical intelligence</span>
          <span>Built for critical care · 2026</span>
        </footer>
      </section>
    </div>
  );
}
