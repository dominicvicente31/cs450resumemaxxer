import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUpload } from "../context/UploadContext.jsx";
import Markdown from "../components/Markdown.jsx";
import ScoreCard from "../components/ScoreCard.jsx";
import { UNSCORABLE, downloadRevised } from "../api/client.js";
import { clearPrimary, getSubmission, setPrimary } from "../history/historyStore.js";

function Advice({ text }) {
  if (!text?.trim()) return <p className="muted">No writing advice is available for this submission.</p>;
  return <Markdown text={text} />;
}

function clarityCaption(before, after) {
  if (before == null) return "How direct and specific your bullets are";
  const b = Math.round(before * 100);
  const a = Math.round(after * 100);
  if (a > b) return `Up from ${b}% in your original bullets`;
  if (a < b) return `Down from ${b}% in your original bullets`;
  return "Same as your original bullets";
}

function Chips({ items, kind }) {
  return <div className="chips">{items.map((k) => <span key={k} className={`chip ${kind}`}>{k}</span>)}</div>;
}

export default function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setJobDescription } = useUpload();
  const [submission, setSubmission] = useState(undefined); // undefined = loading, null = missing
  const [actionError, setActionError] = useState("");

  const load = () => getSubmission(id).then(setSubmission);
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (submission === undefined) return <p className="muted">Loading…</p>;
  if (submission === null) {
    return (
      <section className="narrow center">
        <h1>Submission not found</h1>
        <p className="muted">It may have been removed to stay under the 30-submission limit.</p>
        <div className="actions"><Link to="/" className="button primary">Return to welcome page</Link></div>
      </section>
    );
  }

  const { evaluation: ev, fileName, createdAt, isPrimary } = submission;
  const alignment = ev.alignment ?? { score: UNSCORABLE, matchedKeywords: [], missingKeywords: [], summary: "" };
  const scored = alignment.score !== UNSCORABLE;

  const togglePrimary = async () => {
    setActionError("");
    try {
      await (isPrimary ? clearPrimary() : setPrimary(submission.id));
      load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const download = () => downloadRevised(submission).catch((err) => setActionError(err.message));

  return (
    <section>
      <div className="results-header">
        <div>
          <h1>Evaluation results {isPrimary && <span className="badge">Primary</span>}</h1>
          <p className="muted">{fileName} · {new Date(createdAt).toLocaleString()}</p>
        </div>
        <div className="actions">
          <button className="button" onClick={togglePrimary}>
            {isPrimary ? "Unset primary resume" : "Set as primary resume"}
          </button>
          <button className="button" onClick={() => { setJobDescription(submission.jobDescription); navigate("/upload"); }}>
            Reuse job description
          </button>
          <button className="button" onClick={download}>Download revised .docx</button>
          <Link to="/" className="button primary">Return to welcome page</Link>
        </div>
      </div>
      {actionError && <p className="notice error">{actionError}</p>}

      {ev.warnings?.length > 0 && (
        <div className="notice">
          {ev.warnings.map((w) => <p key={w}>{w}</p>)}
        </div>
      )}

      <div className="score-grid">
        <ScoreCard
          label="Job alignment (graded by the model)"
          percent={scored ? alignment.score : null}
          display={`${alignment.score}/100`}
          caption={scored ? `${alignment.band} alignment` : "Score: -1"}
        >
          {alignment.summary && <p className="score-summary">{alignment.summary}</p>}
        </ScoreCard>
        <ScoreCard
          label="Clarity"
          percent={ev.clarityScore * 100}
          caption={clarityCaption(ev.clarityBefore, ev.clarityScore)}
        />
        {ev.wordingMatch && (
          <ScoreCard
            label="Wording overlap"
            percent={ev.wordingMatch.score * 100}
            caption={`${ev.wordingMatch.band}. Shared words with the posting (TF-IDF); doesn't judge context.`}
          />
        )}
      </div>

      {scored && (alignment.matchedKeywords.length > 0 || alignment.missingKeywords.length > 0) && (
        <div className="card">
          <h2>Job keywords</h2>
          {alignment.matchedKeywords.length > 0 && (
            <>
              <h3>Shown in your resume</h3>
              <Chips items={alignment.matchedKeywords} kind="matched" />
            </>
          )}
          {alignment.missingKeywords.length > 0 && (
            <>
              <h3 className="spaced">Missing</h3>
              <Chips items={alignment.missingKeywords} kind="missing" />
              <p className="muted small">Only add a keyword if it's true for you.</p>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>Writing advice</h2>
        <Advice text={ev.advice} />
      </div>

      <div className="card">
        <h2>Rewritten bullets</h2>
        {ev.entries.length === 0 && <p className="muted">No experience or project bullets were found.</p>}
        {ev.entries.map((entry) => (
          <div key={entry.section + entry.title} className="entry">
            <h3>{entry.title} <span className="muted">· {entry.section}</span></h3>
            {entry.bullets.map((b, i) => (
              <div key={i} className="bullet-row">
                <div><span className="tag">Original</span>{b.original || <span className="muted">(none)</span>}</div>
                <div>
                  {b.revised && b.revised === b.original ? (
                    <><span className="tag">Revised</span><span className="muted">Unchanged</span></>
                  ) : (
                    <><span className="tag new">Revised</span>{b.revised || <span className="muted">(removed)</span>}</>
                  )}
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
