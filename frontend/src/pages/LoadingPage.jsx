import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { IncompatibleFileError, evaluateResume } from "../api/client.js";
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
  const { file, usePrimary, makePrimary, jobDescription, submitted, setSubmitted, setRejection, reset } = useUpload();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!submitted) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);

    evaluateResume({ file, usePrimary, makePrimary, jobDescription }, controller.signal)
      .then((submission) => {
        navigate(`/results/${submission.id}`, { replace: true });
        reset();
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (err instanceof IncompatibleFileError) {
          setRejection(err.message);
          navigate("/incompatible", { replace: true });
          return;
        }
        setError(err.message || "Something went wrong.");
      })
      .finally(() => clearInterval(ticker));

    return () => {
      controller.abort();
      clearInterval(ticker);
    };
    // Run once per submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  if (!submitted && !error) return <Navigate to="/upload" replace />;

  const backToUpload = () => {
    controllerRef.current?.abort();
    setSubmitted(false);
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
