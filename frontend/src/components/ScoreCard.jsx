export default function ScoreCard({ label, value, caption }) {
  const percent = value == null ? null : Math.round(value * 100);
  return (
    <div className="card score-card">
      <div className="score-label">{label}</div>
      <div className="score-value">{percent == null ? "—" : `${percent}%`}</div>
      {percent != null && (
        <div className="meter"><div className="meter-fill" style={{ width: `${percent}%` }} /></div>
      )}
      {caption && <div className="score-caption">{caption}</div>}
    </div>
  );
}
