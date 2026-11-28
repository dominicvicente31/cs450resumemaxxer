import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MIN_JOB_DESCRIPTION_CHARS, jobDescriptionProblem } from "../api/client.js";
import { useUpload } from "../context/UploadContext.jsx";
import { MAX_PROMPTS, deletePrompt, listPrompts, savePrompt, updatePrompt } from "../prompts/promptStore.js";

function timeAgo(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

/** Edit form shared by "New job description" and "Edit". */
function PromptForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const length = text.trim().length;
  return (
    <form
      className="prompt-form"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ title, text }); }}
    >
      <input
        className="prompt-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional, defaults to the first line)"
        aria-label="Title"
      />
      <textarea
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the full job posting."
        aria-label="Job description"
        autoFocus
      />
      <span className={`field-help ${length < MIN_JOB_DESCRIPTION_CHARS ? "" : "ok"}`}>
        {length} / {MIN_JOB_DESCRIPTION_CHARS} characters minimum
      </span>
      <div className="prompt-actions">
        <button type="submit" className="button small primary" disabled={Boolean(jobDescriptionProblem(text))}>
          {submitLabel}
        </button>
        <button type="button" className="button small" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function PromptsPage() {
  const navigate = useNavigate();
  const { jobDescription, setJobDescription } = useUpload();
  const [prompts, setPrompts] = useState(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null); // prompt id, or "new"
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = () => listPrompts().then(setPrompts);
  useEffect(() => { refresh(); }, []);

  const run = async (action, doneNotice = "") => {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(doneNotice);
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const use = (text) => {
    setJobDescription(text);
    navigate("/upload");
  };

  if (prompts === null) return <p className="muted">Loading…</p>;

  const q = query.trim().toLowerCase();
  const shown = q ? prompts.filter((p) => (p.title + " " + p.text).toLowerCase().includes(q)) : prompts;

  return (
    <section>
      <div className="results-header">
        <div>
          <h1>Saved job descriptions</h1>
          <p className="muted">
            {prompts.length} of {MAX_PROMPTS} saved on this device. Every job description you evaluate against is
            saved here automatically. Use one to fill in the upload form, or edit it first.
          </p>
        </div>
        {editingId !== "new" && (
          <button className="button primary" onClick={() => { setEditingId("new"); setError(""); }}>
            New job description
          </button>
        )}
      </div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="notice error">{error}</p>}

      {editingId === "new" && (
        <div className="card">
          <h2>New job description</h2>
          <PromptForm
            initial={{ title: "", text: "" }}
            submitLabel="Save"
            onSubmit={({ title, text }) => run(() => savePrompt(text, { title }), "Saved.")}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {prompts.length > 0 && (
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search saved job descriptions"
          aria-label="Search saved job descriptions"
        />
      )}

      {prompts.length === 0 ? (
        <div className="card center">
          <p>No saved job descriptions yet.</p>
          <p className="muted">They're saved automatically when you evaluate a resume, or you can add one now.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted">No saved job descriptions match "{query}".</p>
      ) : (
        <ul className="prompt-list">
          {shown.map((p) => {
            const inUse = p.text === jobDescription.trim();
            return (
              <li key={p.id} className={`card prompt-item ${inUse ? "active" : ""}`}>
                {editingId === p.id ? (
                  <PromptForm
                    initial={p}
                    submitLabel="Save changes"
                    onSubmit={(changes) => run(() => updatePrompt(p.id, changes), "Saved your changes.")}
                    onCancel={() => { setEditingId(null); setError(""); }}
                  />
                ) : (
                  <>
                    <div className="prompt-head">
                      <h3>{p.title} {inUse && <span className="badge">In the upload form</span>}</h3>
                      <span className="muted small">
                        Used {p.useCount} time{p.useCount === 1 ? "" : "s"} · last {timeAgo(p.lastUsed)}
                      </span>
                    </div>
                    <p className="prompt-text">{p.text}</p>
                    <div className="prompt-actions">
                      <button className="button small primary" onClick={() => use(p.text)}>Use</button>
                      <button className="button small" onClick={() => { setEditingId(p.id); setError(""); }}>Edit</button>
                      <button
                        className="button small danger"
                        onClick={() => confirm(`Delete "${p.title}"?`) && run(() => deletePrompt(p.id), "Deleted.")}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
