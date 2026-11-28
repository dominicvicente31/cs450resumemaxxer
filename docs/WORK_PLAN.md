# Work plan

The project is split into six areas, one per team member, with the stories for each area and when they are due.

> **Assigned so far:** Dominic Vicente (Backend API and React frontend) and Titus (Evaluation and integration). The other four areas still need owners; write your name in the Owner column once the team agrees. Unclaimed areas were re-scoped on Nov 27 to fit the React app, the model-graded alignment score, and history stored on each device (see "What changed on Nov 27"). The dates were filled in without the course deadline, so shift the weeks to match the real due date. The stories and their order still hold.

## Where the project stands (Nov 28, 2026)

The app runs locally end to end: a React frontend backed by a FastAPI server. The original Streamlit app was retired on Nov 28. 35 backend tests and a 35-check browser walkthrough pass without an API key.

- **Done:** 20 synthetic resumes for the test plan (E1). React app with upload preview, results, history, primary resume, and saved job descriptions (B1 to B7). Model-graded job alignment, 0-100 or -1 when it can't grade (B3). CI builds the frontend (B9). A 35-check browser walkthrough, `npm run e2e`, passes without a key (B8, real-key run still open).
- **Still open:** the LLM code, including the new alignment grader, has **never been run against the real API**. Job matching is still **untrained** (no postings in `data/`). The clarity score, fact guard, alignment score, and score bands have **not been checked against human judgment**.

### What changed on Nov 27

These changes affect several areas; the stories below already account for them.

- **The React app (`frontend/`) is the main front end.** It covers the "improve a draft" flow.
- **Job fit is graded by the model.** `llm.score_alignment` scores keyword coverage, the evidence behind those keywords, and fit to the posting. TF-IDF from `similarity.py` is now a secondary "wording overlap" number and the offline baseline.
- **A job description is required, at least 50 characters**, everywhere: UI, API, pipeline, and evaluation cases.
- **History stays on the user's device.** Submissions (30 max), the primary resume, and saved job descriptions live in the browser's localStorage. The server stores nothing, so there is no database.
- **One pipeline.** `resume_maxxer/evaluate.py` runs every step for the API. Anything a student should see goes in its result; problems go in `evaluation.warnings`, which the Results page already shows.
- **Uploads are capped at 5 GB.** Files are parsed in memory on the server.

### What changed on Nov 28

- **The Streamlit app is retired.** `app.py`, `resume_maxxer/ui/`, and their tests were removed; they're in git history before Nov 28. React is now the only front end.
- **Creating a resume from scratch is gone for now.** The Create questionnaire lived only in Streamlit. The app now only improves an existing draft. This was the "creation" in the project's tagline, so either W8 gets an owner before the freeze or the presentation lists it as future work. `llm.draft_bullets` is kept: `run_eval.py` uses it and W8 will need it.

## Schedule

| Week | Dates | Goal | Checkpoint |
| --- | --- | --- | --- |
| 1 | Nov 16 to 22 | Real inputs: API key working, data fetched, 20 synthetic cases | Sun Nov 22: first full evaluation run with the real LLM |
| 2 | Nov 23 to 29 | Quality: tune prompts, train matching, harden parsing and UI | Sun Nov 29: feature freeze (short week, Thanksgiving is Nov 26) |
| 3 | Nov 30 to Dec 6 | Proof: human ratings, final numbers, bug fixes only | Sun Dec 6: final evaluation results locked |
| 4 | Dec 7 to 13 | Report, slides, demo rehearsal | Demo and submission |

The week 1 checkpoint slipped: there has been no run with the real key yet. L1 and E2 are the first priority.

## Areas

| Area | Stories | Owner | Main files |
| --- | --- | --- | --- |
| LLM and truthfulness | L1 to L7 | _unassigned_ | `llm.py`, `factcheck.py` |
| Job matching and training data | M1 to M7 | _unassigned_ | `similarity.py`, `train.py`, `data/` |
| Draft parsing and DOCX template | T1 to T8 | _unassigned_ | `parser.py`, `docx_export.py` |
| Web experience | W1 to W8 | _unassigned_ | `frontend/src/pages/`, `frontend/src/components/` |
| Evaluation and integration | E1 to E9 | Titus | `evaluation/`, `metrics.py`, CI, report |
| Backend API and React frontend | B1 to B9 | Dominic Vicente | `api.py`, `evaluate.py`, `frontend/src/api/`, `frontend/src/history/`, `frontend/src/prompts/` |

Everyone: branch from `main`, open a pull request, get one review from the person whose module you touch. Tests must pass without an API key.

---

## LLM and truthfulness

**Starting point.** `llm.py` has five prompts, all going through `_complete`: draft bullets, revise bullets, writing advice, structure a draft, and `score_alignment` (0-100 job fit, -1 when it can't grade). `factcheck.py` flags numbers and named terms that are in a bullet but not in the user's facts; the React Results page shows these flags next to each rewritten bullet. None of it has been tried on real model output.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| L1 | 1 | As a teammate, I can set one key and have every LLM feature work. | All five `llm.py` functions have been run against the real API (four through `POST /api/evaluate`, `draft_bullets` through `run_eval.py`), and any request errors fixed. The team has agreed how keys and cost are shared, and the README says so. |
| L2 | 1 | As a student, my rough notes come back as bullets that sound professional and say nothing I did not say. | Drafted bullets for the 20 synthetic cases have been read by hand. Every invented detail is logged in an issue with the prompt change that fixed it. |
| L3 | 2 | As a student, I am warned when a bullet claims something I did not tell the app. | `factcheck.py` is measured on a hand-labeled set of at least 40 bullets (half with a planted invented claim). Its catch rate and false alarm rate are reported. |
| L4 | 2 | As a student, invented claims made of ordinary words ("improved efficiency") are caught too. | An LLM-as-judge check is added alongside the rules, behind the same `unsupported_claims` interface, and measured on the L3 set. Its flags show up on the React Results page with no frontend change. |
| L5 | 2 | As a student, the advice I get points at specific lines and tells me what to change. | Advice for five drafts has been reviewed by two teammates. The prompt is revised until both rate it useful for at least four of five. |
| L6 | 3 | As the team, we know what a session costs. | Tokens and cost per evaluation are measured (one evaluation now makes at least three calls: alignment, advice, and one rewrite per entry). A cheaper model is tried through `RESUME_MAXXER_MODEL` and the quality difference noted. |
| L7 | 2 | As a student, my alignment grade is stable and fair. | `score_alignment` run three times on each of 10 cases varies by 5 points or less; the rubric prompt is tightened if not. It returns -1 for a non-resume, a non-posting, and gibberish. Keyword lists use the posting's wording. Results shared with E9. |

## Job matching and training data

**Starting point.** Job fit is now graded by the model (`llm.score_alignment`). TF-IDF in `similarity.py` stays as the secondary "wording overlap" score on the Results page, the relevance metric in `run_eval.py`, and the only job-fit signal when the model can't grade. `train.py` fits the vectorizer on `data/job_postings/`. There are no postings yet, so scoring runs untrained and the Weak/Fair/Strong bands are placeholders. The smaller role of TF-IDF means less corpus work and more comparison work.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| M1 | 1 | As the team, we have a job-posting corpus to train on. | At least 100 entry-level and internship postings (down from 300, since TF-IDF is now secondary) are in a shared folder as one `.txt` each, with the source and terms of use recorded in `data/README.md`. A fetch or cleaning script is in the repo. |
| M2 | 2 | As a student, boilerplate like "team player" does not inflate my score. | `python -m resume_maxxer.train` runs on the corpus. A short before/after comparison shows how wording-overlap scores changed on the 20 synthetic cases. |
| M3 | 2 | As a student, the wording-overlap label means something. | The band thresholds in `similarity.py` are set from data: score well-matched and mismatched resume/job pairs and choose cut-offs that separate them. The method is written up in two or three sentences. |
| M4 | 2 | As a student, "C++", "C#", and ".NET" count as skills. | The tokenizer keeps these tokens, with tests. The synonym table is extended from the most common abbreviations found in the corpus. |
| M5 | 2 | As a student, I still see missing keywords when the model can't grade. | When alignment is -1, `evaluate.py` fills the missing keywords from `similarity.missing_keywords` (ranked with the trained IDF weights, two-word terms included, generic words filtered), and the Results page labels them as a fallback. Coordinate the field with the backend owner. |
| M6 | 3 | As the team, we can say why the model grade replaced TF-IDF. | For the report: model alignment, TF-IDF overlap, and a human relevance rating compared on at least 20 resume/job pairs (shared with E9), with two or three example disagreements. |
| M7 | 2 | As a student, the job description minimum is set at the right length. | Ten real postings are cut to 25, 50, 100, and 200 characters and graded. The minimum (`llm.MIN_JOB_DESCRIPTION_CHARS`, now 50) is kept or changed based on where grades become unstable, and the reason written down. |

## Draft parsing and DOCX template

**Starting point.** `parser.py` reads `.docx` (including tables), `.pdf`, and `.txt`, then splits the text into a `Resume`: with the LLM when a key is set, otherwise with rules based on section headings, bullet markers, and dates. `docx_export.py` writes a single-column template, served by `POST /api/docx` for the React app's download button. Uploads can now be up to 5 GB and are parsed in memory on the server. Real-world resumes have not been tried.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| T1 | 1 | As a student, I can upload the resume I already have and the app reads it correctly. | At least 10 real-layout resumes (templates from Word, Google Docs, Overleaf; fake content) are collected as test files. A table records what each parser gets right and wrong per file. |
| T2 | 2 | As a student with a two-column PDF, my text does not come out scrambled. | The worst failures from T1 are fixed in the rule-based parser, each with a test. Two-column PDFs are either handled or detected and reported through `evaluation.warnings`, which the Results page shows. |
| T3 | 2 | As a student, sections like Awards or Certifications are not silently dropped. | Unknown sections are kept (an "other sections" field on `Resume`, exported as written). Coordinate the model change with everyone, since all modules use `Resume` and the browser stores it as `revisedResume`. |
| T4 | 2 | As a student, my exported resume looks finished. | Spacing, fonts, and alignment are polished. The file from the React download button opens cleanly in Word, Google Docs, and LibreOffice. Two teammates sign off on the look. |
| T5 | 3 | As a student, I am told when my resume runs past one page. | A length estimate is added to the evaluation result and shown on the Results page before download. Checked against Word's real page count on five resumes. |
| T6 | 3 | As a student, my resume survives an applicant tracking system. | The exported DOCX is run through at least one free resume parser, and the fields it extracts are compared with the input. Results go in the report. |
| T7 | stretch | As a student, I can pick a second template or export a PDF. | Only if T1 to T6 are done. |
| T8 | 2 | As the team, a huge or strange upload can't take the server down. | A 1 GB PDF and a 1 GB `.txt` are tried against the API. Parsing stops early with a clear 422 message (for example, a page or character limit) instead of running out of memory. The limits are written in the README. |

## Web experience

**Starting point.** The React app has every page of the "improve a draft" flow: Welcome, Upload (with preview), Incompatible, Loading, Results, History, and Prompts. The backend owner maintains the API calls and storage (`frontend/src/api/`, `history/`, `prompts/`); this area owns how the pages look and behave. The Streamlit app, and with it the Create questionnaire, was retired on Nov 28. `npm run e2e` checks every page in a browser, so extend it when you change a page.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| W1 | 2 | As a first-time user, I know what to do without reading the README. | One person outside the team uses the React app while we watch. Every point of confusion is filed, and the top three are fixed (copy, empty states, error wording). |
| W2 | 2 | As a student, I can accept or reject each suggested bullet. | Accept, revert to original, and edit per bullet on the Results page. Choices are saved with the submission in local history, and the .docx download uses them. Regenerate needs a per-bullet `llm.py` function and an API route (coordinate with the LLM and backend owners). |
| W3 | 2 | As a student, I understand why a bullet was flagged or scored low. | The Results page shows which clarity checks each bullet fails and explains fact warnings in plain words. Needs `metrics.bullet_issues` added per bullet in `evaluate.py` (coordinate with the backend owner). |
| W4 | 2 | As a student, I don't lose what I typed on refresh. | The job description box and upload choices on the Upload page survive a reload. History and saved prompts already do. |
| W5 | 3 | As a presenter, the demo runs smoothly. | A scripted demo path with prepared resume files and saved job descriptions, loading states for every wait, and no raw error traces anywhere. |
| W6 | 3 | As a student, I know where my resume goes and what's kept. | A notice before the first evaluation says the text goes to the LLM provider and that history stays on this device. The History page has a "Clear all my data" button. |
| W7 | 3 | As a student on a phone or using a keyboard, the app still works. | Every page is checked at phone width and with keyboard only. The preview window and confirm dialogs work with Escape and Tab. |
| W8 | stretch | As a student, I can build a resume from scratch in the React app. | The Create questionnaire is rebuilt in React from the retired Streamlit version (`resume_maxxer/ui/create.py` in git history before Nov 28). Needs a `POST /api/draft` route around `llm.draft_bullets` (coordinate with the backend owner). Until then the app only improves existing drafts. |

## Evaluation and integration

**Owner: Titus.** `evaluation/run_eval.py` runs each synthetic case before and after the LLM and reports alignment (model grade, -1 rows left out of the mean), relevance (TF-IDF), clarity, and factual accuracy. All 20 cases are in. `metrics.py` scores clarity with five rule checks. CI runs the Python tests on every pull request.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| E1 | 1 | As the team, we have the 20 synthetic resumes the proposal promised. | 20 cases in `evaluation/synthetic/`, each paired with a job description of at least 50 characters, varied by major, experience level, and how messy the facts are. No real people's data. **Done (Nov 27).** |
| E2 | 1 | As the team, we see our first real numbers. | A full evaluation run with the real LLM, including the alignment columns, shared with the team with the three worst cases called out. Overdue; first priority once L1 is done. |
| E3 | 2 | As a grader, I can trust the clarity score. | Three teammates rate a sample of at least 40 bullets with a written rubric. Agreement between raters, and between raters and `metrics.py`, is reported. Checks are adjusted if they disagree with people. |
| E4 | 2 | As a grader, I can trust the factual accuracy number. | Every "after" bullet in the 20 cases is hand-checked against its facts. The manual rate is reported next to the automatic one from `factcheck.py` (shared with L3). |
| E5 | 3 | As a grader, I can see the before/after result at a glance. | A results table and one chart per metric (alignment included), generated by a script from `results.csv`, with a note on whether each difference is larger than run-to-run variation. |
| E6 | 3 | As the team, the final numbers are reproducible. | The model, prompts (including the alignment rubric), and trained vectorizer used for the final run are recorded. The run is repeated once to confirm the numbers hold. |
| E7 | all | As the team, `main` always works. | Pull requests reviewed within a day, CI green, and merge conflicts on `models.py` and `evaluate.py` resolved by talking to both sides. |
| E8 | 4 | As the team, the report and slides are done on time. | Sections assigned by Dec 7, a draft by Dec 10, and a demo rehearsal before submission. |
| E9 | 3 | As a grader, I can trust the alignment score. | On at least 20 resume/job pairs, two teammates rate fit 0-100 with the same rubric the model uses. Agreement between raters and between raters and `score_alignment` is reported, with how often it returned -1 and why. Uses L7's stability numbers; shared with M6. |

---

## Backend API and React frontend

**Owner: Dominic Vicente.** A React (Vite) frontend in `frontend/` talks to a FastAPI server in `resume_maxxer/api.py`. The server reuses the existing modules through one pipeline (`resume_maxxer/evaluate.py`) and is stateless: submission history, the primary resume, and saved job descriptions are kept in each user's browser (localStorage), so there is no database and no one sees anyone else's history. The Anthropic key stays on the server in `.env`; the browser never sees it. Run with `uvicorn resume_maxxer.api:app --port 8000` and `npm run dev` in `frontend/`. This area also owns the API routes other areas need (W2, W3, W8, M5, T5).

| # | Week | Story | Done when | Status |
| --- | --- | --- | --- | --- |
| B1 | 2 | As a student, I go from a welcome page to an upload, a loading screen, and my results, and a bad file sends me back to upload with the reason. | Welcome, Upload, Incompatible, Loading and Results pages, with a demo mode that runs without the backend. | Done (Nov 26) |
| B2 | 2 | As a student, I can check the file I picked before sending it. | The Upload page previews .pdf (browser viewer), .txt and .docx (text extracted in the browser) in a panel that expands to a full window. Large files are previewed partly or not at all so the tab doesn't freeze. | Done (Nov 27) |
| B3 | 2 | As a student, I get one grade for how well my resume fits the job. | `llm.score_alignment` grades 0-100 on keyword coverage (40), evidence behind those keywords (40), and fit to the posting's expectations (20), and lists matched and missing keywords. It returns -1 when it cannot grade (no key, thin posting, ungradable input, LLM error). TF-IDF overlap is still shown as a secondary number. | Done (Nov 27) |
| B4 | 2 | As a student, I'm graded against a real posting, not a one-liner. | Job descriptions under 50 characters are refused in the UI (live counter) and by the API (400) and the pipeline. | Done (Nov 27) |
| B5 | 2 | As a student, I can look back at my earlier evaluations, and no one else can. | The last 30 submissions are kept on my device; past 30 the oldest drafts are removed automatically. History page with view, delete, and "Scrap older drafts" (keep the newest N). | Done (Nov 27) |
| B6 | 2 | As a student, I can save my main resume once and check it against new jobs. | One submission can be the primary resume. It is never removed automatically, and the Upload page can evaluate it against a new posting without uploading again. | Done (Nov 27) |
| B7 | 2 | As a student, I can reuse or tweak a job description I pasted before. | Every job description used is saved on my device (30 max, same text stored once). A Prompts page lists them with search, Use (fills the upload form), Edit, Delete, and New. | Done (Nov 27) |
| B8 | 3 | As a presenter, the React app works end to end with the real key. | Every page walked through in a browser with the backend and a real key, including a bad file, a short job description, the 30 limit, the primary resume, and saved prompts. Every bug filed and the blocking ones fixed. Automated as `npm run e2e` (35 checks in `frontend/e2e/walkthrough.mjs`). | Without a key: done (Nov 28), 35/35 pass, 5 bugs fixed. With a real key: run `E2E_EXPECT_KEY=1 npm run e2e` once a key is in `.env`. |
| B9 | 2 | As the team, a broken frontend can't be merged. | CI also runs `npm ci` and `npm run build` in `frontend/` on every pull request. | Done (Nov 28) |

## Where the work crosses over

- **`Resume` in `models.py` is shared by everything,** and the browser now stores it with each submission (`revisedResume`). Announce any field change before making it (T3 is the one planned change), and keep old saved submissions loading.
- **`evaluate.py` feeds the React app.** Adding a field there (W3 clarity checks, M5 fallback keywords, T5 page length) is a change to the backend owner's module; renaming or removing one means updating the `Evaluation` typedef in `frontend/src/api/client.js` and the Results page.
- **Alignment is shared by three areas:** L7 tunes the rubric prompt, E9 checks it against people, and M6 compares it with TF-IDF. Use the same 20 pairs for E9 and M6.
- **LLM and evaluation** share the truthfulness numbers: L3 builds the labeled set, E4 uses it.
- **Matching and evaluation:** retraining changes every relevance score, so the vectorizer is frozen at the Nov 29 feature freeze.
- **Parsing and web experience:** parser problems reach the student through `evaluation.warnings` on the Results page. Agree on the wording when a draft can't be split into sections.
- **LLM, backend, and web experience:** W2 (regenerate one bullet) needs a per-bullet function in `llm.py` and an API route.

## Risks

| Risk | What we do about it |
| --- | --- |
| The LLM invents facts despite the prompt | The fact guard warns on the Results page, L3 and E4 measure it, and the user can revert to their own wording (W2). |
| API cost or no shared key | Decide now (L1 is overdue). The app and all tests run without a key; alignment then shows -1, so no one is blocked. |
| The alignment grade varies between runs or disagrees with people | L7 measures stability and E9 measures agreement. If it's unreliable, report it and lean on TF-IDF and the human ratings. |
| Not enough job postings, or terms forbid using them | Untrained scoring still works, and TF-IDF is now secondary. Report it as a limitation rather than scraping against terms. |
| A very large upload exhausts server memory | T8 adds parse limits. For the demo, run the server on a machine with spare RAM. |
| A student clears their browser and loses history | History on the device is a deliberate privacy choice. W6 says so on screen. |
| Retiring Streamlit dropped resume creation, which the tagline promises | Decide this week: give W8 an owner, or present creation as future work and say so on the slides. |
| The before/after difference is small | Report it honestly. The human ratings (E3, E4, E9) say more than the automatic scores. |
| Short week 2 | Feature freeze on Nov 29 holds even if a story slips. Unfinished stories move to stretch. |

## Contributions outside the owner's area

Work a teammate did in an area they don't own, so credit is clear in the report.

**Dominic Vicente**

- **Whole project (before areas were split):** wrote the project skeleton and the first version of every module: the LLM prompts, parser, TF-IDF matching, clarity metric, fact guard, DOCX export, the Streamlit app, the evaluation script, and this work plan.
- **LLM and truthfulness:** added `llm.score_alignment` (the model-graded alignment score, -1 when unscorable) and its rubric prompt. Made `llm.is_configured` ignore the `.env.example` placeholder key, so copying the file without editing it doesn't break the app.
- **Job matching:** set the 50-character minimum for job descriptions (`llm.MIN_JOB_DESCRIPTION_CHARS`). Kept the TF-IDF score as a secondary "wording overlap" number next to the model grade.
- **Evaluation and integration:** added `alignment_before` and `alignment_after` columns to `evaluation/run_eval.py` (-1 rows left out of the mean), and made the run fail on a job description under 50 characters. Added `tests/test_backend.py` (alignment grading, pipeline, API).
- **Web experience:** built every page of the React frontend, including the upload preview, History, and Prompts pages, and the `npm run e2e` browser walkthrough. Retired the Streamlit app on Nov 28.
- **Work plan:** re-scoped the unclaimed areas on Nov 27 to fit the React app, model-graded alignment, and on-device history.
