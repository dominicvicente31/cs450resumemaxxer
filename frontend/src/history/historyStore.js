/**
 * Submission history.
 *
 * Kept apart from the page flow: pages only call these four functions, so the
 * storage can move from the browser to the backend without touching the UI.
 * Today it uses localStorage, so history is per browser.
 *
 * @typedef {Object} Submission
 * @property {string} id
 * @property {string} createdAt       ISO timestamp
 * @property {string} fileName
 * @property {string} jobDescription
 * @property {import("../api/client").Evaluation} evaluation
 */

const KEY = "resume-maxxer.history";
const MAX_ENTRIES = 50;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage full or blocked; history is a convenience, so carry on.
  }
}

/** @returns {Promise<Submission[]>} newest first */
export async function listSubmissions() {
  // TODO(backend): GET /submissions
  return read();
}

/** @returns {Promise<Submission|null>} */
export async function getSubmission(id) {
  // TODO(backend): GET /submissions/{id}
  return read().find((s) => s.id === id) ?? null;
}

/** @returns {Promise<Submission>} */
export async function saveSubmission({ fileName, jobDescription, evaluation }) {
  // TODO(backend): the backend should create this record during POST /evaluate
  // and return its id; then this becomes a no-op.
  const submission = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fileName,
    jobDescription,
    evaluation,
  };
  write([submission, ...read()]);
  return submission;
}

export async function deleteSubmission(id) {
  // TODO(backend): DELETE /submissions/{id}
  write(read().filter((s) => s.id !== id));
}

export async function clearSubmissions() {
  // TODO(backend): DELETE /submissions
  write([]);
}
