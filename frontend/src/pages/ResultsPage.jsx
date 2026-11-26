import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ScoreCard from "../components/ScoreCard.jsx";
import { downloadRevised } from "../api/client.js";
import { getSubmission } from "../history/historyStore.js";

/** Renders "- item" lines as a list and anything else as paragraphs. */
function Advice({ text }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items = lines.filter((l) => /^[-*]\s/.test(l)).map((l) => l.replace(/^[-*]\s+/, ""));
  const paragraphs = lines.filter((l) => !/^[-*]\s/.test(l));
  return (
    <>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      {items.length > 0 && <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
    </>
  );
}

export default function ResultsPage() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(undefined); // undefined = loading, null = missing

  useEffect(() => {
    getSubmission(id).then(setSubmission);
  }, [id]);

  if (submission === undefined) return <p className="muted">Loading…</p>;
  if (submission === null) {
    return (
      <section className="narrow center">
        <h1>Submission not found</h1>
        <div className="actions"><Link to="/" className="button primary">Return to welcome page</Link></div>
      </section>
    );
  }

  const { evaluation: ev, fileName, createdAt } = submission;

  return (
    <section>
      <div className="results-header">
        <div>
          <h1>Evaluation results</h1>
          <p className="muted">{fileName} · {new Date(createdAt).toLocaleString()}</p>
        </div>
        <div className="actions">
          <button className="button" onClick={() => downloadRevised(submission.id)}>Download revised .docx</button>
          <Link to="/" className="button primary">Return to welcome page</Link>
        </div>
      </div>

      <div className="score-grid">
        <ScoreCard label="Clarity" value={ev.clarityScore} caption="How direct and specific your bullets are" />
        <ScoreCard
          label="Job match"
          value={ev.matchScore}
          caption={ev.matchBand ? `${ev.matchBand} match` : "Add a job description to see this"}
        />
      </div>

      {ev.missingKeywords.length > 0 && (
        <div className="card">
          <h2>Missing keywords</h2>
          <div className="chips">{ev.missingKeywords.map((k) => <span key={k} className="chip">{k}</span>)}</div>
        </div>
      )}

      <div className="card">
        <h2>Writing advice</h2>
        <Advice text={ev.advice} />
      </div>

      <div className="card">
        <h2>Rewritten bullets</h2>
        {ev.entries.map((entry) => (
          <div key={entry.section + entry.title} className="entry">
            <h3>{entry.title} <span className="muted">· {entry.section}</span></h3>
            {entry.bullets.map((b, i) => (
              <div key={i} className="bullet-row">
                <div><span className="tag">Original</span>{b.original}</div>
                <div>
                  <span className="tag new">Revised</span>{b.revised}
                  {b.flags.length > 0 && (
                    <div className="flag">Check: {b.flags.join(", ")} isn't in your original. Confirm it's true.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
