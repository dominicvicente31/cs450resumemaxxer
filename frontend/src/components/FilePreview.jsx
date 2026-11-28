import { useEffect, useState } from "react";
import { SUPPORTED_EXTENSIONS, fileExtension } from "../api/client.js";

// Uploads can be up to 5 GB, so never load a whole large file into the tab.
const TEXT_PREVIEW_BYTES = 256 * 1024; // .txt: show only the start
const DOCX_PREVIEW_MAX_BYTES = 50 * 1024 * 1024; // .docx must be unzipped whole, so skip big ones

/**
 * Shows what was picked before it is sent anywhere:
 *  .pdf  -> the browser's own PDF viewer
 *  .txt  -> the text
 *  .docx -> the text, extracted in the browser with mammoth
 * Other types get a notice; submitting them goes to the Incompatible page.
 */
export default function FilePreview({ file }) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState({ kind: "loading" });
  const extension = fileExtension(file);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    const done = (next) => !cancelled && setState(next);
    setState({ kind: "loading" });

    if (extension === "pdf") {
      objectUrl = URL.createObjectURL(file);
      done({ kind: "pdf", url: objectUrl });
    } else if (extension === "txt") {
      const truncated = file.size > TEXT_PREVIEW_BYTES;
      file.slice(0, TEXT_PREVIEW_BYTES).text().then(
        (text) => done({ kind: "text", text: truncated ? `${text}\n\n… (preview shows the first 256 KB)` : text }),
        () => done({ kind: "error" })
      );
    } else if (extension === "docx" && file.size > DOCX_PREVIEW_MAX_BYTES) {
      done({ kind: "too-large" });
    } else if (extension === "docx") {
      // Loaded on demand so it isn't in the main bundle.
      Promise.all([import("mammoth/mammoth.browser.js"), file.arrayBuffer()])
        .then(([module, arrayBuffer]) => (module.default ?? module).extractRawText({ arrayBuffer }))
        .then((result) => done({ kind: "text", text: result.value }), () => done({ kind: "error" }));
    } else {
      done({ kind: "unsupported" });
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, extension]);

  // Close the expanded view with Escape.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const body = (() => {
    switch (state.kind) {
      case "loading":
        return <p className="muted preview-note">Loading preview…</p>;
      case "pdf":
        return <iframe className="preview-frame" src={state.url} title={`Preview of ${file.name}`} />;
      case "text":
        return state.text.trim()
          ? <pre className="preview-text">{state.text}</pre>
          : <p className="muted preview-note">No text found in this file. It may be a scanned image.</p>;
      case "unsupported":
        return (
          <p className="muted preview-note">
            No preview for this file type. Only {SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")} files can be evaluated.
          </p>
        );
      case "too-large":
        return <p className="muted preview-note">This .docx is too large to preview in the browser. You can still evaluate it.</p>;
      default:
        return <p className="muted preview-note">Couldn't preview this file. It may be damaged.</p>;
    }
  })();

  return (
    <>
      <div className="preview">
        <div className="preview-bar">
          <span>Preview</span>
          {(state.kind === "pdf" || state.kind === "text") && (
            <button type="button" className="button small" onClick={() => setExpanded(true)}>Expand</button>
          )}
        </div>
        <div className="preview-body">{body}</div>
      </div>

      {expanded && (
        <div className="modal-backdrop" onClick={() => setExpanded(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`} onClick={(e) => e.stopPropagation()}>
            <div className="preview-bar">
              <strong>{file.name}</strong>
              <button type="button" className="button small" onClick={() => setExpanded(false)} autoFocus>Close</button>
            </div>
            <div className="modal-body">{body}</div>
          </div>
        </div>
      )}
    </>
  );
}
