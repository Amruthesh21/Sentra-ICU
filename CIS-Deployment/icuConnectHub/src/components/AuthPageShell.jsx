import RtowLogo from './RtowLogo';
import '../styles/auth-login.css';

export default function AuthPageShell({ title, subtitle, children, cardClassName = '' }) {
  return (
    <div className="auth-shell">
      <div className="auth-shell-inner">
        <section className="auth-brand">
          <RtowLogo blend />
          <h1 className="auth-product-title">Sentra ICU — Critical Care Intelligence Platform</h1>
          <p className="auth-product-tagline">Live Vitals. Faster Decisions. Zero Delays.</p>
        </section>

        <section className="auth-card-wrap">
          <div className={`auth-card${cardClassName ? ` ${cardClassName}` : ''}`}>
            <h2 className="auth-card-title">{title}</h2>
            {subtitle ? <p className="auth-card-sub">{subtitle}</p> : null}
            {children}
          </div>
        </section>
      </div>

      <footer className="auth-footer">
        <span>V2.0</span>
        <span>Privacy Policy</span>
        <span>© Sentra ICU</span>
      </footer>
    </div>
  );
}
