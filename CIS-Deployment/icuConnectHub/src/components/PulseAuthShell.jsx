import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PulseLogo from './PulseLogo';

function NetworkMesh() {
  const nodes = [
    [20, 30], [35, 18], [55, 22], [72, 15], [88, 28],
    [15, 55], [32, 48], [50, 52], [68, 45], [85, 58],
    [22, 78], [42, 72], [60, 80], [78, 70], [92, 82],
    [48, 38], [40, 62],
  ];
  const links = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9],
    [5, 6], [6, 7], [7, 8], [8, 9], [5, 10], [6, 11], [7, 12], [8, 13], [9, 14],
    [10, 11], [11, 12], [12, 13], [13, 14], [15, 1], [15, 7], [16, 6], [16, 11],
  ];

  return (
    <svg className="pulse-auth-mesh" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {links.map(([a, b], i) => (
        <line
          key={`l-${i}`}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.25"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={`n-${i}`} cx={x} cy={y} r={i === 15 ? 1.4 : 0.9} fill="rgba(255,255,255,0.85)" />
      ))}
    </svg>
  );
}

export function PulseAuthShell({ children, eyebrowRight = 'V2.4 — HL7 READY' }) {
  useEffect(() => {
    document.documentElement.classList.add('pulse-auth-active');
    document.body.classList.add('pulse-auth-active');
    return () => {
      document.documentElement.classList.remove('pulse-auth-active');
      document.body.classList.remove('pulse-auth-active');
    };
  }, []);

  return (
    <div className="pulse-auth">
      <section className="pulse-auth-left">
        <div className="pulse-auth-left-top">
          <Link to="/" aria-label="Sentra ICU home">
            <PulseLogo size="md" />
          </Link>
        </div>
        <div className="pulse-auth-form-wrap">{children}</div>
      </section>

      <aside className="pulse-auth-right">
        <div className="pulse-auth-right-top">
          <span>Realtime monitoring</span>
          <span>{eyebrowRight}</span>
        </div>
        <NetworkMesh />
        <div className="pulse-auth-right-bottom">
          <p className="pulse-auth-tagline">Every second monitored. Every anomaly surfaced.</p>
        </div>
      </aside>
    </div>
  );
}
