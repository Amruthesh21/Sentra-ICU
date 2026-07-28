/** Sentra ICU wordmark — clinical monitoring + intelligence */
export default function PulseLogo({ variant = 'light', size = 'md' }) {
  const isDark = variant === 'dark';
  const heights = { sm: 18, md: 22, lg: 28 };
  const h = heights[size] || heights.md;

  return (
    <div className={`pulse-logo pulse-logo--${variant} pulse-logo--${size}`} aria-label="Sentra ICU">
      <svg
        className="pulse-logo-icon"
        width={h * 1.35}
        height={h}
        viewBox="0 0 36 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 12 H10 L13 12 L16 4 L20 20 L23 12 H35"
          stroke={isDark ? '#F4F5F7' : '#0A0D14'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="pulse-logo-word">
        <strong>Sentra</strong>
        <span>ICU</span>
      </span>
    </div>
  );
}
