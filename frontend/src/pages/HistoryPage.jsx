import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clearSubmissions, deleteSubmission, listSubmissions } from "../history/historyStore.js";

const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function HistoryPage() {
  const [submissions, setSubmissions] = useState(null);

  const refresh = () => listSubmissions().then(setSubmissions);
  useEffect(() => { refresh(); }, []);

  const remove = async (id) => { await deleteSubmission(id); refresh(); };
  const clearAll = async () => {
    if (confirm("Delete all past submissions?")) { await clearSubmissions(); refresh(); }
  };

  if (submissions === null) return <p className="muted">Loading…</p>;

  return (
    <section>
      <div className="results-header">
        <h1>Submission history</h1>
        {submissions.length > 0 && <button className="button danger" onClick={clearAll}>Clear all</button>}
      </div>

      {submissions.length === 0 ? (
        <div className="card center">
          <p>No submissions yet.</p>
          <Link to="/upload" className="button primary">Upload a resume</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="history">
            <thead>
              <tr><th>File</th><th>Date</th><th>Clarity</th><th>Job match</th><th /></tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/results/${s.id}`}>{s.fileName}</Link></td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{pct(s.evaluation.clarityScore)}</td>
                  <td>{pct(s.evaluation.matchScore)}</td>
                  <td className="row-actions">
                    <Link to={`/results/${s.id}`} className="button small">View</Link>
                    <button className="button small danger" onClick={() => remove(s.id)}>Delete</button>
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
