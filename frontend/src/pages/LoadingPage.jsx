import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { IncompatibleFileError } from "../api/client.js";
import { useUpload } from "../context/UploadContext.jsx";

const STEPS = [
  "Reading your resume",
  "Grading alignment with the job",
  "Splitting it into sections",
  "Rewriting and fact-checking bullets",
  "Scoring clarity",
];

export default function LoadingPage() {
  const navigate = useNavigate();
  const { file, usePrimary, pending, setPending, setRejection, reset } = useUpload();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  // The request was started by the Upload page; this only waits for it. Cleanup
  // ignores a stale result instead of aborting, so React StrictMode's double
  // mount in development doesn't cancel and resend the request.
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);

    pending.promise
      .then((submission) => {
        if (!active) return;
        navigate(`/results/${submission.id}`, { replace: true });
        reset();
      })
      .catch((err) => {
        if (!active || err.name === "AbortError") return;
        if (err instanceof IncompatibleFileError) {
          setRejection(err.message);
          navigate("/incompatible", { replace: true });
          return;
        }
        setError(err.message || "Something went wrong.");
      })
      .finally(() => clearInterval(ticker));

    return () => {
      active = false;
      clearInterval(ticker);
    };
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pending && !error) return <Navigate to="/upload" replace />;

  const backToUpload = () => {
    pending?.controller.abort();
    setPending(null);
    navigate("/upload");
  };

  if (error) {
    return (
      <section className="narrow center">
        <div className="status-icon error" aria-hidden>!</div>
        <h1>Evaluation failed</h1>
        <p>{error}</p>
        <div className="actions">
          <button className="button primary" onClick={backToUpload}>Back to upload</button>
        </div>
      </section>
    );
  }

  return (
    <section className="narrow center">
      <div className="spinner" aria-label="Loading" />
      <h1>Evaluating {usePrimary ? "your primary resume" : file?.name}</h1>
      <ol className="steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? "done" : i === step ? "active" : ""}>{label}</li>
        ))}
      </ol>
      <div className="actions">
        <button className="button" onClick={backToUpload}>Cancel</button>
      </div>
    </section>
  );
}
