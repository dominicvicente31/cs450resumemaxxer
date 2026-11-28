/**
 * Backend connection points (server: resume_maxxer/api.py).
 *
 * With VITE_API_BASE_URL unset, every function here runs on mock data so the
 * whole flow can be clicked through without the Python server.
 *
 * The Anthropic API key lives only on the server, in the repo-root .env
 * (ANTHROPIC_API_KEY). The browser never sees it; getStatus() only reports
 * whether one is set.
 *
 * The server stores nothing. After each evaluation the result is saved in
 * this browser (history/historyStore.js, prompts/promptStore.js).
 */

import { addSubmission, getPrimary } from "../history/historyStore.js";
import { savePrompt } from "../prompts/promptStore.js";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export const USING_MOCK = !API_BASE_URL;

export const SUPPORTED_EXTENSIONS = ["docx", "pdf", "txt"];
export const MAX_FILE_BYTES = 5 * 1024 ** 3; // 5 GB, matches MAX_UPLOAD_BYTES in api.py
export const MIN_JOB_DESCRIPTION_CHARS = 50; // matches llm.MIN_JOB_DESCRIPTION_CHARS
export const UNSCORABLE = -1; // alignment score when the model can't grade

export function fileExtension(file) {
  return file?.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
}

/**
 * Check a file before sending it anywhere. Runs entirely in the browser.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateFile(file) {
  if (!file) return { ok: false, reason: "No file was selected." };
  const extension = fileExtension(file);
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      reason: `"${extension ? "." + extension : file.name}" files are not supported. Upload a ${SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")} file.`,
    };
  }
  if (file.size === 0) return { ok: false, reason: "That file is empty." };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: "That file is larger than 5 GB." };
  }
  return { ok: true };
}

/** @returns {string|null} why the job description can't be used, or null */
export function jobDescriptionProblem(text) {
  const length = text.trim().length;
  if (length < MIN_JOB_DESCRIPTION_CHARS) {
    return `Add at least ${MIN_JOB_DESCRIPTION_CHARS - length} more characters. Paste the full posting so your resume is graded against real requirements.`;
  }
  return null;
}

/** Thrown when the backend reads the file but cannot use it (corrupt, scanned PDF, no text). */
export class IncompatibleFileError extends Error {}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (response.ok) return response.status === 204 ? null : response.json();
  const body = await response.json().catch(() => ({}));
  const message = typeof body.detail === "string" ? body.detail : `Request failed (${response.status}).`;
  if (response.status === 422 && path === "/api/evaluate") throw new IncompatibleFileError(message);
  throw new Error(message);
}

/**
 * @returns {Promise<{ llmConfigured: boolean, model: string, maxSubmissions: number, minJobDescriptionChars: number }>}
 */
export async function getStatus() {
  if (USING_MOCK) return { llmConfigured: false, model: "mock", maxSubmissions: 30, minJobDescriptionChars: 50 };
  return request("/api/status");
}

/**
 * Evaluate a resume and save it to history. Returns the new Submission
 * (see history/historyStore.js).
 *
 * @param {{ file?: File, usePrimary?: boolean, makePrimary?: boolean, jobDescription: string }} input
 * @param {AbortSignal} [signal]
 *
 * @typedef {Object} Alignment          model-graded fit to the job (llm.score_alignment)
 * @property {number}      score          0..100, or -1 (UNSCORABLE) when it could not be graded
 * @property {string|null} band           "Weak" | "Fair" | "Strong", null when unscorable
 * @property {string[]}    matchedKeywords
 * @property {string[]}    missingKeywords
 * @property {string}      summary        strengths and gaps, or why it couldn't be graded
 *
 * @typedef {Object} Evaluation
 * @property {Alignment} alignment
 * @property {{ score: number, band: string }} wordingMatch  TF-IDF overlap, 0..1
 * @property {number} clarityScore   0..1, after rewriting
 * @property {number} clarityBefore  0..1, the user's original bullets
 * @property {string} advice         markdown
 * @property {{ section: string, title: string, bullets: { original: string, revised: string, flags: string[] }[] }[]} entries
 * @property {string[]} warnings
 * @property {boolean} llmConfigured
 */
export async function evaluateResume({ file, usePrimary = false, makePrimary = false, jobDescription }, signal) {
  let primary = null;
  if (usePrimary) {
    primary = await getPrimary();
    if (!primary) throw new Error("No primary resume is set.");
  }

  let result; // { fileName, resumeText, evaluation, revisedResume }
  if (USING_MOCK) {
    result = await mockEvaluate({ fileName: primary?.fileName ?? file.name, jobDescription }, signal);
  } else {
    const form = new FormData();
    form.append("job_description", jobDescription);
    if (primary) {
      // Re-check the saved text; the original file isn't kept.
      form.append("resume_text", primary.resumeText ?? "");
      form.append("file_name", primary.fileName);
    } else {
      form.append("file", file);
    }
    result = await request("/api/evaluate", { method: "POST", body: form, signal });
  }

  // Saving prompt history is best effort; a full browser storage shouldn't hide the results.
  await savePrompt(jobDescription, { used: true }).catch(() => {});
  return addSubmission({ ...result, jobDescription, makePrimary: makePrimary && !usePrimary });
}

/** Download the rewritten resume as .docx. @param {import("../history/historyStore").Submission} submission */
export async function downloadRevised(submission) {
  if (USING_MOCK) {
    alert("Downloads need the backend. Start it with: uvicorn resume_maxxer.api:app --port 8000");
    return;
  }
  if (!submission.revisedResume) throw new Error("This submission has no rewritten resume to download.");
  const response = await fetch(`${API_BASE_URL}/api/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume: submission.revisedResume }),
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const url = URL.createObjectURL(await response.blob());
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

async function mockEvaluate({ fileName, jobDescription }, signal) {
  await wait(2500, signal);
  // Lets you see the backend-rejection path: name a file "corrupt.pdf".
  if (fileName.toLowerCase().includes("corrupt")) {
    throw new IncompatibleFileError("Could not read that file. Try saving it again.");
  }
  // Lets you see the unscorable path: put "unscorable" in the job description.
  const unscorable = jobDescription.toLowerCase().includes("unscorable");
  const evaluation = {
    alignment: unscorable
      ? { score: UNSCORABLE, band: null, matchedKeywords: [], missingKeywords: [], summary: "The posting is too vague to grade against." }
      : {
          score: 64,
          band: "Fair",
          matchedKeywords: ["REST APIs", "Python", "React"],
          missingKeywords: ["Kubernetes", "CI/CD", "TypeScript"],
          summary: "Your backend internship lines up well with the API work in this posting. The posting stresses deployment, which your resume never mentions.",
        },
    wordingMatch: { score: 0.31, band: "Strong" },
    clarityScore: 0.74,
    clarityBefore: 0.42,
    advice:
      "- Lead each bullet with a strong action verb.\n" +
      "- Add numbers where you have them (users, time saved, team size).\n" +
      "- Move Skills above Projects so recruiters see them sooner.",
    entries: [
      {
        section: "Experience",
        title: "Software Intern, Acme Corp",
        bullets: [
          { original: "worked on the backend team doing api stuff", revised: "Built REST endpoints in Flask for the internal inventory service", flags: ["Flask"] },
          { original: "helped fix bugs", revised: "Resolved 40+ bug reports across the order pipeline", flags: ["40+"] },
        ],
      },
      {
        section: "Projects",
        title: "Course Planner",
        bullets: [{ original: "made a website to plan classes", revised: "Developed a React course planner that checks prerequisites", flags: [] }],
      },
    ],
    warnings: ["Demo mode: these are sample results, not an evaluation of your file."],
    llmConfigured: false,
  };
  return { fileName, resumeText: "(demo mode: file text isn't read)", evaluation, revisedResume: null };
}
