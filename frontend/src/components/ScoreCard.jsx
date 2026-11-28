/**
 * @param {number|null} percent  0..100, or null to show "Unable to score"
 * @param {string} [display]     overrides the big number (e.g. "64/100")
 */
export default function ScoreCard({ label, percent, display, caption, emptyText = "Unable to score", children }) {
  const scored = percent != null;
  return (
    <div className="card score-card">
      <div className="score-label">{label}</div>
      <div className={`score-value ${scored ? "" : "unscored"}`}>
        {scored ? display ?? `${Math.round(percent)}%` : emptyText}
      </div>
      {scored && (
        <div className="meter"><div className="meter-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
      )}
      {caption && <div className="score-caption">{caption}</div>}
      {children}
    </div>
  );
}
