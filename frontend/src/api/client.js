/**
 * Backend connection points.
 *
 * Every function the UI needs from the backend lives here. None are wired up
 * yet: with VITE_API_BASE_URL unset, each one returns mock data so the whole
 * flow can be clicked through. To connect a function, fill in its TODO and
 * keep the return shape the same.
 *
 * Python counterparts (see resume_maxxer/):
 *   validateFile    -> parser.SUPPORTED_EXTENSIONS, parser.extract_text errors
 *   evaluateResume  -> parser.extract_text + similarity.match_score/score_band/missing_keywords
 *                      + metrics.resume_clarity + llm.advise
 *                      + parser.parse_resume + llm.revise_bullets + factcheck.unsupported_claims
 *   downloadRevised -> docx_export.build_docx
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const USING_MOCK = !API_BASE_URL;

export const SUPPORTED_EXTENSIONS = ["docx", "pdf", "txt"];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Check a file before sending it anywhere. Runs entirely in the browser.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateFile(file) {
  if (!file) return { ok: false, reason: "No file was selected." };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      reason: `".${extension}" files are not supported. Upload a ${SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")} file.`,
    };
  }
  if (file.size === 0) return { ok: false, reason: "That file is empty." };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: `That file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  }
  return { ok: true };
}

/** Thrown when the backend reads the file but cannot use it (corrupt, scanned PDF, no text). */
export class IncompatibleFileError extends Error {}

/**
 * Send a resume (and optional job description) for evaluation.
 *
 * @param {File} file
 * @param {string} jobDescription
 * @param {AbortSignal} [signal]
 * @returns {Promise<Evaluation>}
 *
 * @typedef {Object} Evaluation
 * @property {number|null} matchScore      0..1 cosine similarity, null without a job description
 * @property {string|null} matchBand       "Strong" | "Moderate" | "Weak"
 * @property {string[]}    missingKeywords job terms absent from the resume
 * @property {number}      clarityScore    0..1
 * @property {string}      advice          markdown writing advice
 * @property {{ section: string, title: string, bullets: { original: string, revised: string, flags: string[] }[] }[]} entries
 */
export async function evaluateResume(file, jobDescription, signal) {
  if (USING_MOCK) return mockEvaluate(file, jobDescription, signal);

  // TODO: connect to the backend. Expected contract:
  //   POST {API_BASE_URL}/evaluate  multipart/form-data { file, job_description }
  //   200 -> Evaluation JSON, 422 -> { detail: "why the file can't be used" }
  const form = new FormData();
  form.append("file", file);
  form.append("job_description", jobDescription);
  const response = await fetch(`${API_BASE_URL}/evaluate`, { method: "POST", body: form, signal });
  if (response.status === 422) {
    const body = await response.json().catch(() => ({}));
    throw new IncompatibleFileError(body.detail || "The file could not be read.");
  }
  if (!response.ok) throw new Error(`Evaluation failed (${response.status}).`);
  return response.json();
}

/**
 * Download the rewritten resume as .docx.
 * @param {string} submissionId
 */
export async function downloadRevised(submissionId) {
  if (USING_MOCK) {
    alert("Download is not connected yet (docx_export.build_docx).");
    return;
  }
  // TODO: connect to the backend. Expected contract:
  //   GET {API_BASE_URL}/submissions/{id}/docx -> .docx bytes
  const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}/docx`);
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "resume.docx" });
  link.click();
  URL.revokeObjectURL(url);
}

// --- mock ---------------------------------------------------------------

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

async function mockEvaluate(file, jobDescription, signal) {
  await wait(2500, signal);
  // Lets you see the backend-rejection path: name a file "corrupt.pdf".
  if (file.name.toLowerCase().includes("corrupt")) {
    throw new IncompatibleFileError("Could not read that file. Try saving it again.");
  }
  const hasJob = jobDescription.trim().length > 0;
  return {
    matchScore: hasJob ? 0.62 : null,
    matchBand: hasJob ? "Moderate" : null,
    missingKeywords: hasJob ? ["Kubernetes", "CI/CD", "TypeScript", "REST APIs"] : [],
    clarityScore: 0.74,
    advice:
      "- Lead each bullet with a strong action verb.\n" +
      "- Add numbers where you have them (users, time saved, team size).\n" +
      "- Move Skills above Projects so recruiters see them sooner.",
    entries: [
      {
        section: "Experience",
        title: "Software Intern, Acme Corp",
        bullets: [
          {
            original: "worked on the backend team doing api stuff",
            revised: "Built REST endpoints in Flask for the internal inventory service",
            flags: [],
          },
          {
            original: "helped fix bugs",
            revised: "Resolved 40+ bug reports across the order pipeline",
            flags: ["40+"],
          },
        ],
      },
      {
        section: "Projects",
        title: "Course Planner",
        bullets: [
          {
            original: "made a website to plan classes",
            revised: "Developed a React course planner that checks prerequisites",
            flags: [],
          },
        ],
      },
    ],
  };
}
