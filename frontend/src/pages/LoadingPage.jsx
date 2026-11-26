import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { IncompatibleFileError, evaluateResume } from "../api/client.js";
import { saveSubmission } from "../history/historyStore.js";
import { useUpload } from "../context/UploadContext.jsx";

const STEPS = [
  "Reading your file",
  "Splitting it into sections",
  "Scoring clarity and job match",
  "Rewriting bullets",
];

export default function LoadingPage() {
  const navigate = useNavigate();
  const { file, jobDescription, setRejection, reset } = useUpload();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);

    evaluateResume(file, jobDescription, controller.signal)
      .then(async (evaluation) => {
        const saved = await saveSubmission({ fileName: file.name, jobDescription, evaluation });
        navigate(`/results/${saved.id}`, { replace: true });
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
    // Run once per file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  if (!file) return <Navigate to="/upload" replace />;

  const cancel = () => {
    controllerRef.current?.abort();
    navigate("/upload");
  };

  if (error) {
    return (
      <section className="narrow center">
        <div className="status-icon error" aria-hidden>!</div>
        <h1>Evaluation failed</h1>
        <p>{error}</p>
        <div className="actions">
          <button className="button primary" onClick={() => navigate("/upload")}>Back to upload</button>
        </div>
      </section>
    );
  }

  return (
    <section className="narrow center">
      <div className="spinner" aria-label="Loading" />
      <h1>Evaluating {file.name}</h1>
      <ol className="steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? "done" : i === step ? "active" : ""}>{label}</li>
        ))}
      </ol>
      <div className="actions">
        <button className="button" onClick={cancel}>Cancel</button>
      </div>
    </section>
  );
}
