/**
 * Saved job descriptions ("prompts"), saved only in this browser (localStorage).
 *
 * - Every job description used in an evaluation is saved automatically.
 *   The same text is stored once; using it again moves it to the top.
 * - Users can add, rename, edit, and delete them on the Prompts page.
 *   Editing a prompt never changes past submissions.
 * - At most MAX_PROMPTS are kept; the least recently used go first.
 *
 * @typedef {Object} Prompt
 * @property {string} id
 * @property {string} title
 * @property {string} text
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} lastUsed
 * @property {number} useCount
 */

import { jobDescriptionProblem } from "../api/client.js";

export const MAX_PROMPTS = 30;
const KEY = "resume-maxxer.prompts";
const TITLE_CHARS = 60;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_PROMPTS)));
  } catch (error) {
    throw new Error("This browser's storage is full, so the job description couldn't be saved.", { cause: error });
  }
}

function check(text) {
  const problem = jobDescriptionProblem(text);
  if (problem) throw new Error(problem);
  return text.trim();
}

export function defaultTitle(text) {
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) || "Untitled";
  return first.length <= TITLE_CHARS ? first : first.slice(0, TITLE_CHARS - 1).trimEnd() + "…";
}

/** @returns {Promise<Prompt[]>} most recently used first */
export async function listPrompts() {
  return read();
}

/**
 * Save a prompt, or bump an identical one to the top.
 * @param {string} text
 * @param {{ title?: string, used?: boolean }} [options]  used: count it as used in an evaluation
 * @returns {Promise<Prompt>}
 */
export async function savePrompt(rawText, { title = "", used = false } = {}) {
  const text = check(rawText);
  const now = new Date().toISOString();
  const list = read();
  const existing = list.find((p) => p.text === text);
  const prompt = existing
    ? { ...existing, title: title.trim() || existing.title, lastUsed: now, useCount: existing.useCount + (used ? 1 : 0) }
    : { id: crypto.randomUUID(), title: title.trim() || defaultTitle(text), text, createdAt: now, updatedAt: now, lastUsed: now, useCount: used ? 1 : 0 };
  write([prompt, ...list.filter((p) => p.id !== prompt.id)]);
  return prompt;
}

/** @param {{ text?: string, title?: string }} changes @returns {Promise<Prompt>} */
export async function updatePrompt(id, { text, title }) {
  const list = read();
  const current = list.find((p) => p.id === id);
  if (!current) throw new Error("Saved job description not found.");
  const newText = text !== undefined ? check(text) : current.text;
  if (list.some((p) => p.id !== id && p.text === newText)) {
    throw new Error("Another saved job description already has this exact text.");
  }
  const updated = { ...current, text: newText, title: title?.trim() || current.title, updatedAt: new Date().toISOString() };
  write(list.map((p) => (p.id === id ? updated : p)));
  return updated;
}

export async function deletePrompt(id) {
  write(read().filter((p) => p.id !== id));
}
