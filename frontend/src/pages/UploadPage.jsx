import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SUPPORTED_EXTENSIONS, validateFile } from "../api/client.js";
import { useUpload } from "../context/UploadContext.jsx";

export default function UploadPage() {
  const navigate = useNavigate();
  const { file, setFile, jobDescription, setJobDescription, setRejection } = useUpload();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const pick = (picked) => picked && setFile(picked);

  const submit = (event) => {
    event.preventDefault();
    const check = validateFile(file);
    if (!check.ok) {
      setRejection(check.reason);
      navigate("/incompatible");
      return;
    }
    navigate("/loading");
  };

  return (
    <section className="narrow">
      <h1>Upload your resume</h1>
      <p className="muted">Accepted formats: {SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")}</p>

      <form onSubmit={submit}>
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

        <label className="field">
          <span>Target job description <span className="muted">(optional)</span></span>
          <textarea
            rows={6}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job posting to get a match score and missing keywords."
          />
        </label>

        <div className="actions">
          <button type="submit" className="button primary" disabled={!file}>Evaluate resume</button>
        </div>
      </form>
    </section>
  );
}
