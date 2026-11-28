import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UNSCORABLE } from "../api/client.js";
import {
  MAX_SUBMISSIONS,
  clearPrimary,
  deleteSubmission,
  listSubmissions,
  scrapOlderDrafts,
  setPrimary,
} from "../history/historyStore.js";

const KEEP_OPTIONS = [0, 1, 3, 5, 10, 20];

function alignmentText(ev) {
  const score = ev.alignment?.score;
  if (score == null) return "—";
  return score === UNSCORABLE ? "-1" : `${score}/100`;
}

export default function HistoryPage() {
  const [submissions, setSubmissions] = useState(null);
  const [keep, setKeep] = useState(5);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = () =>
    listSubmissions()
      .then(setSubmissions)
      .catch((err) => { setError(err.message); setSubmissions([]); });
  useEffect(() => { refresh(); }, []);

  const run = async (action, doneMessage = "") => {
    setError("");
    setMessage("");
    try {
      const result = await action();
      setMessage(typeof doneMessage === "function" ? doneMessage(result) : doneMessage);
    } catch (err) {
      setError(err.message);
    }
    refresh();
  };

  const scrap = () => {
    const label = keep === 0 ? "all drafts" : `all but the newest ${keep} draft${keep === 1 ? "" : "s"}`;
    if (!confirm(`Delete ${label}? Your primary resume is kept.`)) return;
    run(() => scrapOlderDrafts(keep), (deleted) => `Deleted ${deleted} older draft${deleted === 1 ? "" : "s"}.`);
  };

  if (submissions === null) return <p className="muted">Loading…</p>;

  const primary = submissions.find((s) => s.isPrimary);
  const drafts = submissions.filter((s) => !s.isPrimary).length;
  const full = submissions.length >= MAX_SUBMISSIONS;

  return (
    <section>
      <div className="results-header">
        <div>
          <h1>Submission history</h1>
          <p className="muted">
            {submissions.length} of {MAX_SUBMISSIONS} saved on this device only.
            {full
              ? " You're at the limit: your next submission will remove the oldest draft."
              : ` Past ${MAX_SUBMISSIONS}, the oldest drafts are removed automatically.`}
            {" "}Your primary resume is never removed automatically.
          </p>
        </div>
        {drafts > 0 && (
          <div className="scrap">
            <label>
              Keep newest{" "}
              <select value={keep} onChange={(e) => setKeep(Number(e.target.value))}>
                {KEEP_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>{" "}
              drafts
            </label>
            <button className="button danger" onClick={scrap}>Scrap older drafts</button>
          </div>
        )}
      </div>

      {message && <p className="notice">{message}</p>}
      {error && <p className="notice error">{error}</p>}

      {primary && (
        <div className="card primary-card">
          <div>
            <span className="badge">Primary resume</span>
            <h2>{primary.fileName}</h2>
            <p className="muted">Saved {new Date(primary.createdAt).toLocaleString()}. Choose "Use my primary resume" on the upload page to check it against a new job.</p>
          </div>
          <div className="actions">
            <Link to="/upload" className="button primary">Check against a new job</Link>
            <button className="button" onClick={() => run(clearPrimary, "Primary resume unset.")}>Unset primary</button>
          </div>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="card center">
          <p>No submissions yet.</p>
          <Link to="/upload" className="button primary">Upload a resume</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="history">
            <thead>
              <tr><th>File</th><th>Date</th><th>Alignment</th><th>Clarity</th><th /></tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/results/${s.id}`}>{s.fileName}</Link>
                    {s.isPrimary && <span className="badge">Primary</span>}
                  </td>
                  <td data-label="Date">{new Date(s.createdAt).toLocaleString()}</td>
                  <td data-label="Alignment">{alignmentText(s.evaluation)}</td>
                  <td data-label="Clarity">{Math.round(s.evaluation.clarityScore * 100)}%</td>
                  <td className="row-actions">
                    <Link to={`/results/${s.id}`} className="button small">View</Link>
                    {!s.isPrimary && (
                      <button className="button small" onClick={() => run(() => setPrimary(s.id), `${s.fileName} is now your primary resume.`)}>
                        Make primary
                      </button>
                    )}
                    <button
                      className="button small danger"
                      onClick={() => confirm(`Delete ${s.fileName}?`) && run(() => deleteSubmission(s.id))}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
