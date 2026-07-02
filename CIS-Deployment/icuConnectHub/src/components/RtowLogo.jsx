export default function RtowLogo({ blend = false }) {
  return (
    <div className="rtwo-logo">
      <img
        src={blend ? '/rtwo-logo-transparent.png' : '/rtwo-logo.png'}
        alt="Rtwo Global Healthcare"
        className="rtwo-logo-img"
        draggable={false}
      />
    </div>
  );
}
