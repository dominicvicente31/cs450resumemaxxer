// End-to-end walkthrough (work plan story B8): drives the React app in headless
// Chromium against the live API and checks every page and edge case.
//
// One-time setup:   npx playwright install chromium
// Run (from frontend/, with the API on :8000 and `npm run dev` on :5173):
//   npm run e2e
// Screenshots go to e2e/shots/. Uses a fresh browser profile, so it never touches your own history.
//
// Without an API key it expects alignment -1 and unrewritten bullets. With a key
// (E2E_EXPECT_KEY=1) it expects a 0-100 grade and rewritten bullets instead.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const SHOTS = path.join(HERE, "shots");
const FIXTURES = path.join(HERE, "fixtures");
const WITH_KEY = process.env.E2E_EXPECT_KEY === "1";
fs.mkdirSync(SHOTS, { recursive: true });
const APP = "http://localhost:5173";
const JD = "Data analyst intern. Write SQL queries, build Tableau dashboards, clean spreadsheets, and present findings to business partners.";
const file = (name) => path.join(FIXTURES, name);

const results = [];
const consoleErrors = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (error) {
    results.push(["FAIL", name, String(error.message || error).split("\n")[0]]);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && consoleErrors.push(`console: ${m.text()}`));
page.on("requestfailed", (r) => consoleErrors.push(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
let evaluateRequests = 0;
page.on("request", (r) => r.method() === "POST" && r.url().endsWith("/api/evaluate") && evaluateRequests++);
page.on("dialog", (d) => d.accept()); // confirm() for deletes/scrap

const go = (p) => page.goto(APP + p, { waitUntil: "networkidle" });
const evaluateBtn = () => page.getByRole("button", { name: "Evaluate resume" });
const jdBox = () => page.locator("textarea").first();
async function pick(name) { await page.locator('input[type="file"]').setInputFiles(file(name)); }
async function waitResults() { await page.waitForURL(/\/results\//, { timeout: 180000 }); await page.getByRole("heading", { name: /Evaluation results/ }).waitFor(); }

// --- 1. Welcome ----------------------------------------------------------
await check(WITH_KEY ? "Welcome page loads with no warning banner" : "Welcome page loads and shows the no-key banner", async () => {
  await go("/");
  await page.getByRole("heading", { level: 1 }).waitFor();
  const banner = await page.getByText("No Anthropic API key is set on the server").isVisible();
  expect(WITH_KEY ? !banner : banner, WITH_KEY ? "server says no key is set" : "no-key banner missing");
  await page.screenshot({ path: path.join(SHOTS, "01-welcome.png"), fullPage: true });
});
await check("Get started goes to Upload", async () => {
  await page.getByRole("link", { name: "Get started" }).click();
  await page.waitForURL(/\/upload$/);
});

// --- 2. Upload validation -----------------------------------------------
await check("Evaluate is disabled with no file and no job description", async () => {
  expect(await evaluateBtn().isDisabled(), "button should be disabled");
});
await check("Short job description keeps Evaluate disabled and shows the minimum", async () => {
  await pick("resume.txt");
  await jdBox().fill("Intern wanted.");
  await jdBox().blur();
  expect(await evaluateBtn().isDisabled(), "button should be disabled for a short JD");
  expect(await page.getByText(/more characters/).isVisible(), "help text missing");
});
await check(".txt preview shows the file text", async () => {
  await page.locator(".preview-text").getByText("Student Assistant").waitFor({ timeout: 5000 });
});
await check("Unsupported .png goes to the Incompatible page with the reason", async () => {
  await pick("photo.png");
  await page.getByText("No preview for this file type").waitFor();
  await jdBox().fill(JD);
  await evaluateBtn().click();
  await page.waitForURL(/\/incompatible$/);
  expect(await page.getByText('".png" files are not supported').isVisible(), "reason missing");
  await page.screenshot({ path: path.join(SHOTS, "02-incompatible.png") });
});
await check("Upload a different file returns to Upload and keeps the job description", async () => {
  await page.getByRole("button", { name: "Upload a different file" }).click();
  await page.waitForURL(/\/upload$/);
  expect((await jdBox().inputValue()) === JD, "job description was lost");
});
await check("Corrupt PDF is rejected by the backend (422) and lands on Incompatible", async () => {
  await pick("corrupt.pdf");
  await evaluateBtn().click();
  await page.waitForURL(/\/incompatible$/, { timeout: 30000 });
  expect(await page.getByText(/Could not read that file|No text found/).isVisible(), "backend reason missing");
  await page.getByRole("button", { name: "Upload a different file" }).click();
});

// --- 3. Real evaluation with .docx, saved as primary ----------------------
let firstId = "";
await check(".docx preview shows text extracted in the browser", async () => {
  await pick("resume.docx");
  await page.locator(".preview-text").getByText("Student Assistant").waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, "03-upload-preview.png"), fullPage: true });
});
await check("Expand opens the preview window and Escape closes it", async () => {
  await page.getByRole("button", { name: "Expand" }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
});
await check("Evaluating a .docx with 'save as primary' reaches Results", async () => {
  await page.getByLabel(/Save this as my primary resume/).check();
  await jdBox().fill(JD);
  await evaluateBtn().click();
  await page.waitForURL(/\/loading$/);
  await waitResults();
  firstId = page.url().split("/results/")[1];
});
if (WITH_KEY) {
  await check("Results: alignment is a real 0-100 grade with keywords and a summary", async () => {
    const card = page.locator(".score-card").first();
    const text = await card.innerText();
    const match = text.match(/(\d{1,3})\/100/);
    expect(match && Number(match[1]) <= 100, `no 0-100 grade on the card: ${text}`);
    expect(await page.getByRole("heading", { name: "Job keywords" }).isVisible(), "keywords card missing");
    expect((await card.locator(".score-summary").innerText()).length > 20, "summary missing");
  });
  await check("Results: bullets were rewritten and advice came back", async () => {
    expect(await page.locator(".bullet-row").count() > 0, "no bullets");
    expect(await page.getByText("Unchanged").count() < (await page.locator(".bullet-row").count()), "nothing was rewritten");
    expect(await page.locator(".markdown").isVisible(), "no writing advice");
    expect(await page.locator("h1 .badge", { hasText: "Primary" }).isVisible(), "primary badge missing");
    await page.screenshot({ path: path.join(SHOTS, "04-results.png"), fullPage: true });
  });
} else {
  await check("Results: alignment shows Unable to score / -1 without a key", async () => {
    expect(await page.getByText("Unable to score").isVisible(), "unscorable text missing");
    expect(await page.getByText("Score: -1").isVisible(), "-1 caption missing");
    expect(await page.getByText(/No Anthropic API key is set, so alignment could not be graded/).first().isVisible(), "reason missing");
  });
  await check("Results: original bullets, warnings, Primary badge", async () => {
    expect(await page.getByText("organized circulation records").first().isVisible(), "bullet missing");
    expect(await page.getByText(/bullets were not rewritten/).isVisible(), "no-key warning missing");
    expect(await page.locator("h1 .badge", { hasText: "Primary" }).isVisible(), "primary badge missing");
    await page.screenshot({ path: path.join(SHOTS, "04-results.png"), fullPage: true });
  });
  await check("Results: unchanged bullets are labelled Unchanged, clarity says Same", async () => {
    expect(await page.getByText("Unchanged").first().isVisible(), "Unchanged label missing");
    expect(await page.getByText("Same as your original bullets").isVisible(), "clarity caption wrong");
  });
}
await check("Advice renders markdown (numbered list, bold, quote) without raw symbols", async () => {
  const url = page.url();
  await page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem("resume-maxxer.history"));
    const s = list.find((x) => x.id === id);
    s.evaluation.advice = [
      "## Top changes",
      "1. **Lead with action verbs.** Change:",
      "> organized circulation records",
      "2. Add a number, such as *how many* records.",
      "- Use `SQL` where it's true.",
    ].join("\n");
    localStorage.setItem("resume-maxxer.history", JSON.stringify(list));
  }, url.split("/results/")[1]);
  await page.reload({ waitUntil: "networkidle" });
  expect(await page.locator(".markdown ol li strong", { hasText: "Lead with action verbs." }).isVisible(), "bold in list missing");
  expect(await page.locator(".markdown ol li blockquote").isVisible(), "quote should sit inside its list item");
  expect(await page.locator(".markdown ol").count() === 1, "numbered list was split");
  expect((await page.locator(".markdown ol > li").count()) === 2, "expected items 1 and 2 in one list");
  expect(await page.locator(".markdown h3", { hasText: "Top changes" }).isVisible(), "heading missing");
  const text = await page.locator(".markdown").innerText();
  expect(!/\*\*|##|^>/m.test(text), "raw markdown symbols shown: " + text);
  await page.screenshot({ path: path.join(SHOTS, "04b-advice.png"), fullPage: true });
});
await check("Download revised .docx produces a Word file", async () => {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: "Download revised .docx" }).click(),
  ]);
  const saved = path.join(SHOTS, "downloaded.docx");
  await download.saveAs(saved);
  expect(fs.readFileSync(saved).subarray(0, 2).toString() === "PK", "not a .docx (zip) file");
});
await check("Reuse job description fills the Upload form", async () => {
  await page.getByRole("button", { name: "Reuse job description" }).click();
  await page.waitForURL(/\/upload$/);
  expect((await jdBox().inputValue()) === JD, "JD not filled");
});

// --- 4. Primary resume re-check -------------------------------------------
await check("'Use my primary resume' evaluates without a file", async () => {
  await page.getByLabel(/Use my primary resume/).check();
  expect(await page.locator(".dropzone").count() === 0, "dropzone should hide");
  await evaluateBtn().click();
  await waitResults();
  expect(await page.getByText(/^resume\.docx ·/).isVisible(), "file name should be the primary's");
  expect(await page.locator("h1 .badge").count() === 0, "re-check should not be primary");
});

// --- 5. History ---------------------------------------------------------
await check("History lists both submissions with the primary card", async () => {
  await go("/history");
  await page.getByText("2 of 30 saved on this device only.").waitFor();
  expect(await page.locator(".primary-card").isVisible(), "primary card missing");
  await page.screenshot({ path: path.join(SHOTS, "05-history.png"), fullPage: true });
});
await check("History survives a page reload", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("2 of 30 saved").waitFor();
});
await check("30 limit: oldest draft removed, primary kept", async () => {
  // Seed 29 old drafts behind the existing 2 (31 total would exceed; seed to exactly 30 first).
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem("resume-maxxer.history"));
    const template = list.find((s) => !s.isPrimary);
    for (let i = 0; i < 28; i++) {
      list.push({ ...template, id: `seed-${i}`, isPrimary: false, fileName: `old-${i}.txt`, createdAt: new Date(2026, 0, 1, 0, i).toISOString() });
    }
    localStorage.setItem("resume-maxxer.history", JSON.stringify(list));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/30 of 30 saved/).waitFor();
  expect(await page.getByText("You're at the limit").isVisible(), "limit notice missing");
  await go("/upload");
  await pick("resume.txt");
  await jdBox().fill(JD);
  await evaluateBtn().click();
  await waitResults();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("resume-maxxer.history")));
  expect(after.length === 30, `expected 30, got ${after.length}`);
  expect(after.some((s) => s.isPrimary), "primary was removed");
  expect(!after.some((s) => s.id === "seed-27"), "oldest draft was not removed");
});
await check("Scrap older drafts keeps the newest 3 plus the primary", async () => {
  await go("/history");
  await page.locator(".scrap select").selectOption("3");
  await page.getByRole("button", { name: "Scrap older drafts" }).click();
  await page.getByText(/Deleted 26 older drafts/).waitFor();
  await page.getByText(/4 of 30 saved/).waitFor();
});
await check("Make primary and unset primary", async () => {
  await page.getByRole("button", { name: "Make primary" }).first().click();
  await page.getByText(/is now your primary resume/).waitFor();
  await page.getByRole("button", { name: "Unset primary" }).click();
  await page.getByText("Primary resume unset.").waitFor();
  expect(await page.locator(".primary-card").count() === 0, "primary card should be gone");
});
await check("Delete one submission", async () => {
  await page.getByRole("button", { name: "Delete" }).first().click();
  await page.getByText(/3 of 30 saved/).waitFor();
});

// --- 6. Saved prompts ---------------------------------------------------
await check("Prompts page lists the used job description with its use count", async () => {
  await go("/prompts");
  await page.getByText(/Used [3-9] times/).first().waitFor();
  await page.screenshot({ path: path.join(SHOTS, "06-prompts.png"), fullPage: true });
});
await check("Edit a prompt's title", async () => {
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByLabel("Title").fill("Data analyst intern (Acme)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("heading", { name: /Data analyst intern \(Acme\)/ }).waitFor();
});
await check("New job description: Save disabled under 50 characters, works above", async () => {
  await page.getByRole("button", { name: "New job description" }).click();
  await page.getByLabel("Job description", { exact: true }).fill("Too short");
  expect(await page.getByRole("button", { name: "Save", exact: true }).isDisabled(), "save should be disabled");
  await page.getByLabel("Job description", { exact: true }).fill("Frontend intern. Build React components, write unit tests, and review pull requests weekly.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved.").waitFor();
});
await check("Search filters saved prompts", async () => {
  await page.getByLabel("Search saved job descriptions").fill("frontend");
  expect(await page.locator(".prompt-item").count() === 1, "search should leave one");
  await page.getByLabel("Search saved job descriptions").fill("");
});
await check("Use fills the Upload form", async () => {
  await page.locator(".prompt-item", { hasText: "Frontend intern" }).getByRole("button", { name: "Use" }).click();
  await page.waitForURL(/\/upload$/);
  expect((await jdBox().inputValue()).startsWith("Frontend intern"), "JD not filled");
});

// --- 7. Edge pages ------------------------------------------------------
await check("Unknown submission id shows Not found", async () => {
  await go("/results/does-not-exist");
  await page.getByText("Submission not found").waitFor();
});
await check("Opening /loading directly redirects to Upload", async () => {
  await go("/loading");
  await page.waitForURL(/\/upload$/);
});

// --- 8. Phone width and dark mode --------------------------------------
await check("No sideways scrolling at phone width on any page", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const lastId = await page.evaluate(() => JSON.parse(localStorage.getItem("resume-maxxer.history"))[0].id);
  const bad = [];
  for (const p of ["/", "/upload", "/history", "/prompts", `/results/${lastId}`]) {
    await go(p);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) bad.push(`${p} (+${over}px)`);
  }
  await page.screenshot({ path: path.join(SHOTS, "07-results-phone.png"), fullPage: true });
  await go("/history");
  await page.screenshot({ path: path.join(SHOTS, "08-history-phone.png"), fullPage: true });
  expect(bad.length === 0, `overflow on ${bad.join(", ")}`);
  expect(await page.locator('td[data-label="Clarity"]').first().isVisible(), "history clarity hidden on phone");
  expect(await page.getByRole("button", { name: "Delete" }).first().isVisible(), "history actions hidden on phone");
});
await check("Dark mode renders", async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  const lastId = await page.evaluate(() => JSON.parse(localStorage.getItem("resume-maxxer.history"))[0].id);
  await go(`/results/${lastId}`);
  await page.screenshot({ path: path.join(SHOTS, "09-results-dark.png"), fullPage: true });
});

await check("Each evaluation sent exactly one request (4 evaluations)", async () => {
  expect(evaluateRequests === 4, `expected 4 POST /api/evaluate, saw ${evaluateRequests}`);
});
await check("No console or page errors during the walkthrough", async () => {
  const real = consoleErrors.filter((e) => !/status of 422|status of 400|requestfailed: GET blob:/.test(e)); // expected API rejections
  expect(real.length === 0, real.join(" | "));
});

await browser.close();
for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `  ->  ${detail}` : ""}`);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
if (consoleErrors.length) console.log("Console:", consoleErrors);
process.exit(failed ? 1 : 0);
