import { useNavigate } from "react-router-dom";
import { SUPPORTED_EXTENSIONS } from "../api/client.js";
import { useUpload } from "../context/UploadContext.jsx";

export default function IncompatiblePage() {
  const navigate = useNavigate();
  const { file, rejection, reset } = useUpload();

  const tryAgain = () => {
    reset();
    navigate("/upload");
  };

  return (
    <section className="narrow center">
      <div className="status-icon error" aria-hidden>!</div>
      <h1>We couldn't use that file</h1>
      {file && <p><strong>{file.name}</strong></p>}
      <p>{rejection || "The file could not be read."}</p>
      <p className="muted">
        Use a {SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")} file with selectable text.
        Scanned images inside a PDF can't be read.
      </p>
      <div className="actions">
        <button className="button primary" onClick={tryAgain}>Upload a different file</button>
      </div>
    </section>
  );
}
