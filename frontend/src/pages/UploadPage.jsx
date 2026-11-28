import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FilePreview from "../components/FilePreview.jsx";
import {
  MIN_JOB_DESCRIPTION_CHARS,
  evaluateResume,
  SUPPORTED_EXTENSIONS,
  jobDescriptionProblem,
  validateFile,
} from "../api/client.js";
import { getPrimary } from "../history/historyStore.js";
import { useUpload } from "../context/UploadContext.jsx";

export default function UploadPage() {
  const navigate = useNavigate();
  const {
    file, setFile, jobDescription, setJobDescription,
    usePrimary, setUsePrimary, makePrimary, setMakePrimary,
    setPending, setRejection,
  } = useUpload();
  const [primary, setPrimaryState] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [jobTouched, setJobTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    getPrimary().then(setPrimaryState).catch(() => setPrimaryState(null));
  }, []);

  const jobProblem = jobDescriptionProblem(jobDescription);
  const jobLength = jobDescription.trim().length;
  const ready = !jobProblem && (usePrimary ? Boolean(primary) : Boolean(file));

  const pick = (picked) => {
    if (!picked) return;
    setFile(picked);
    setUsePrimary(false);
  };

  const submit = (event) => {
    event.preventDefault();
    setJobTouched(true);
    if (!ready) return;
    if (!usePrimary) {
      const check = validateFile(file);
      if (!check.ok) {
        setRejection(check.reason);
        navigate("/incompatible");
        return;
      }
    }
    const controller = new AbortController();
    const promise = evaluateResume({ file, usePrimary, makePrimary, jobDescription }, controller.signal);
    promise.catch(() => {}); // handled on the Loading page; this avoids an unhandled-rejection warning
    setPending({ promise, controller });
    navigate("/loading");
  };

  return (
    <section className="narrow">
      <h1>Upload your resume</h1>
      <p className="muted">Accepted formats: {SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")}</p>

      <form onSubmit={submit} noValidate>
        {primary && (
          <div className="source-toggle" role="radiogroup" aria-label="Resume to evaluate">
            <label className={`source-option ${!usePrimary ? "selected" : ""}`}>
              <input type="radio" checked={!usePrimary} onChange={() => setUsePrimary(false)} />
              Upload a file
            </label>
            <label className={`source-option ${usePrimary ? "selected" : ""}`}>
              <input type="radio" checked={usePrimary} onChange={() => setUsePrimary(true)} />
              Use my primary resume <span className="muted">({primary.fileName})</span>
            </label>
          </div>
        )}

        {!usePrimary && (
          <>
            <div
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            >
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <span className="muted">{(file.size / 1024).toFixed(1)} KB · click to change</span>
                </>
              ) : (
                <>
                  <strong>Drop a file here</strong>
                  <span className="muted">or click to browse</span>
                </>
              )}
              {/* No `accept` filter on purpose: wrong file types go to the Incompatible page. */}
              <input ref={inputRef} type="file" hidden onChange={(e) => pick(e.target.files[0])} />
            </div>

            {file && <FilePreview file={file} />}

            {file && (
              <label className="checkbox">
                <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} />
                Save this as my primary resume
                <span className="muted"> · reuse it for other job postings without uploading again</span>
              </label>
            )}
          </>
        )}

        <label className="field">
          <span className="field-label-row">
            <span>Target job description <span className="required">(required)</span></span>
            <Link to="/prompts" className="small">Choose a saved job description</Link>
          </span>
          <textarea
            rows={7}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            onBlur={() => setJobTouched(true)}
            aria-invalid={jobTouched && Boolean(jobProblem)}
            aria-describedby="job-help"
            placeholder="Paste the full job posting: responsibilities, required skills, and qualifications."
          />
          <span id="job-help" className={`field-help ${jobTouched && jobProblem ? "error" : ""}`}>
            {jobLength} / {MIN_JOB_DESCRIPTION_CHARS} characters minimum
            {jobTouched && jobProblem ? ` · ${jobProblem}` : ""}
          </span>
        </label>

        <div className="actions">
          <button type="submit" className="button primary" disabled={!ready}>Evaluate resume</button>
        </div>
      </form>
    </section>
  );
}
