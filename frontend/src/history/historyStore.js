/**
 * Submission history, saved only in this browser (localStorage).
 *
 * The server stores nothing, so each device keeps its own history and no
 * one else can see it. Clearing site data in the browser erases it.
 *
 * Rules:
 * - At most MAX_SUBMISSIONS (30) are kept. Past that, the oldest drafts are
 *   deleted automatically.
 * - One submission can be the primary resume. It is never deleted
 *   automatically and counts toward the 30. Its extracted text is stored, so
 *   it can be re-checked against a new job without uploading again.
 * - scrapOlderDrafts(keep) deletes all but the newest `keep` drafts, plus
 *   keeps the primary.
 *
 * @typedef {Object} Submission
 * @property {string}  id
 * @property {string}  createdAt      ISO timestamp
 * @property {string}  fileName
 * @property {string}  jobDescription
 * @property {boolean} isPrimary
 * @property {string}  resumeText     text extracted from the file
 * @property {object}  revisedResume  Resume.to_dict() with rewritten bullets, for .docx export
 * @property {import("../api/client").Evaluation} evaluation
 */

export const MAX_SUBMISSIONS = 30;
const KEY = "resume-maxxer.history";

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

/** Writes the list; if the browser's storage is full, drops the oldest drafts until it fits. */
function write(list) {
  let attempt = [...list];
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify(attempt));
      return attempt;
    } catch (error) {
      const oldestDraft = attempt.findLastIndex((s) => !s.isPrimary);
      if (oldestDraft <= 0) {
        throw new Error("This browser's storage is full, so the submission couldn't be saved to history.", { cause: error });
      }
      attempt.splice(oldestDraft, 1);
    }
  }
}

/** @returns {Promise<Submission[]>} newest first */
export async function listSubmissions() {
  return read();
}

/** @returns {Promise<Submission|null>} */
export async function getSubmission(id) {
  return read().find((s) => s.id === id) ?? null;
}

/** @returns {Promise<Submission>} */
export async function addSubmission({ fileName, jobDescription, resumeText, revisedResume, evaluation, makePrimary = false }) {
  const submission = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fileName,
    jobDescription,
    isPrimary: Boolean(makePrimary),
    resumeText,
    revisedResume,
    evaluation,
  };
  let list = read();
  if (makePrimary) list = list.map((s) => ({ ...s, isPrimary: false }));
  list = [submission, ...list];
  while (list.length > MAX_SUBMISSIONS) {
    const oldestDraft = list.findLastIndex((s) => !s.isPrimary);
    if (oldestDraft === -1) break;
    list.splice(oldestDraft, 1);
  }
  write(list);
  return submission;
}

export async function deleteSubmission(id) {
  write(read().filter((s) => s.id !== id));
}

/** Delete all but the newest `keep` drafts (the primary is always kept). @returns {Promise<number>} deleted */
export async function scrapOlderDrafts(keep) {
  const list = read();
  const keepIds = new Set(list.filter((s) => !s.isPrimary).slice(0, keep).map((s) => s.id));
  const kept = list.filter((s) => s.isPrimary || keepIds.has(s.id));
  write(kept);
  return list.length - kept.length;
}

/** @returns {Promise<Submission|null>} */
export async function getPrimary() {
  return read().find((s) => s.isPrimary) ?? null;
}

export async function setPrimary(id) {
  write(read().map((s) => ({ ...s, isPrimary: s.id === id })));
}

export async function clearPrimary() {
  write(read().map((s) => ({ ...s, isPrimary: false })));
}
