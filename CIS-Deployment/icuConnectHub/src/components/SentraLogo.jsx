export default function SentraLogo({ blend = false }) {
  return (
    <div className="sentra-logo">
      <img
        src={blend ? '/sentra-logo-transparent.png' : '/sentra-logo.png'}
        alt="Sentra ICU"
        className="sentra-logo-img"
        draggable={false}
      />
    </div>
  );
}
