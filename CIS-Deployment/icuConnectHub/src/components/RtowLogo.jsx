export default function RtowLogo({ blend = false }) {
  return (
    <div className="rtwo-logo">
      <img
        src={blend ? '/rtwo-logo-transparent.png' : '/rtwo-logo.png'}
        alt="Sentra ICU"
        className="rtwo-logo-img"
        draggable={false}
      />
    </div>
  );
}
