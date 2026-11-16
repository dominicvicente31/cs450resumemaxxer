# Work plan

The project split into five areas, one per team member, with the stories for each area and when they are due.

> **Nothing here is assigned yet.** Each of us picks one area; write your name in the Owner column once the team agrees. The dates were filled in without the course deadline, so shift the weeks to match the real due date. The stories and their order still hold.

## Where the project stands (Nov 15, 2026)

The app runs locally end to end. Both tabs work, a first version of every module exists, and 17 tests pass. What is missing is mostly data, tuning, and proof:

- The LLM code is written but has **never been run against the real API**. No one has set a key yet.
- Job matching is **untrained**: there are no job postings in `data/` yet.
- The test plan has **1 of 20** synthetic resumes.
- The clarity score, fact guard, and score bands are rule-based first drafts that **no one has checked against human judgment**.

## Schedule

| Week | Dates | Goal | Checkpoint |
| --- | --- | --- | --- |
| 1 | Nov 16 to 22 | Real inputs: API key working, data fetched, 20 synthetic cases | Sun Nov 22: first full evaluation run with the real LLM |
| 2 | Nov 23 to 29 | Quality: tune prompts, train matching, harden parsing and UI | Sun Nov 29: feature freeze (short week, Thanksgiving is Nov 26) |
| 3 | Nov 30 to Dec 6 | Proof: human ratings, final numbers, bug fixes only | Sun Dec 6: final evaluation results locked |
| 4 | Dec 7 to 13 | Report, slides, demo rehearsal | Demo and submission |

## Areas

| Area | Stories | Owner | Main files |
| --- | --- | --- | --- |
| LLM and truthfulness | L1 to L6 | _unassigned_ | `llm.py`, `factcheck.py` |
| Job matching and training data | M1 to M6 | _unassigned_ | `similarity.py`, `train.py`, `data/` |
| Draft parsing and DOCX template | T1 to T7 | _unassigned_ | `parser.py`, `docx_export.py` |
| Web app | W1 to W7 | _unassigned_ | `app.py`, `ui/` |
| Evaluation and integration | E1 to E8 | _unassigned_ | `evaluation/`, `metrics.py`, CI, report |

Everyone: branch from `main`, open a pull request, get one review from the person whose module you touch. Tests must pass without an API key.

---

## LLM and truthfulness

**Starting point.** `llm.py` has prompts for drafting bullets, revising bullets, writing advice, and structuring a draft, all going through `_complete`. `factcheck.py` flags numbers and named terms (tools, companies) that are in a bullet but not in the user's facts. Neither has been tried on real model output.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| L1 | 1 | As a teammate, I can set one key and have every LLM feature work. | Each of the four `llm.py` functions has been run against the real API and any request errors fixed. The team has agreed how keys and cost are shared, and the README says so. |
| L2 | 1 | As a student, my rough notes come back as bullets that sound professional and say nothing I did not say. | Drafted bullets for the 20 synthetic cases have been read by hand. Every invented detail is logged in an issue with the prompt change that fixed it. |
| L3 | 2 | As a student, I am warned when a bullet claims something I did not tell the app. | `factcheck.py` is measured on a hand-labeled set of at least 40 bullets (half with a planted invented claim). Its catch rate and false alarm rate are reported. |
| L4 | 2 | As a student, invented claims made of ordinary words ("improved efficiency") are caught too. | An LLM-as-judge check is added alongside the rules, behind the same `unsupported_claims` interface, and measured on the L3 set. |
| L5 | 2 | As a student, the advice I get points at specific lines and tells me what to change. | Advice for five drafts has been reviewed by two teammates. The prompt is revised until both rate it useful for at least four of five. |
| L6 | 3 | As the team, we know what a session costs. | Tokens and cost per resume are measured and reported. A cheaper model is tried through `RESUME_MAXXER_MODEL` and the quality difference noted. |

## Job matching and training data

**Starting point.** `similarity.py` scores a resume against a job description with TF-IDF (unigrams and bigrams, a small synonym table) and lists missing keywords. `train.py` fits the vectorizer on `data/job_postings/` and saves `models/tfidf.joblib`, which is picked up automatically. There are no postings yet, so scoring runs untrained and the Weak/Fair/Strong bands are placeholders.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| M1 | 1 | As the team, we have a job-posting corpus to train on. | At least 300 entry-level and internship postings are in a shared folder as one `.txt` each, with the source and terms of use recorded in `data/README.md`. A fetch or cleaning script is in the repo. |
| M2 | 1 | As a student, boilerplate like "team player" does not inflate my score. | `python -m resume_maxxer.train` runs on the corpus. A short before/after comparison shows how scores changed on the 20 synthetic cases. |
| M3 | 2 | As a student, my score comes with a label I can trust. | The band thresholds in `similarity.py` are set from data: score well-matched and mismatched resume/job pairs and choose cut-offs that separate them. The method is written up in two or three sentences. |
| M4 | 2 | As a student, "C++", "C#", and ".NET" count as skills. | The tokenizer keeps these tokens, with tests. The synonym table is extended from the most common abbreviations found in the corpus. |
| M5 | 2 | As a student, I see the missing terms that matter, not every missing word. | Missing keywords are ranked with the trained IDF weights and include two-word terms. Generic words are filtered out. Checked by eye on five cases. |
| M6 | 3 | As the team, we can say how well TF-IDF works for this. | For the report: where the score agrees and disagrees with a human judgment of relevance on at least 20 pairs, with two or three example failures. |

## Draft parsing and DOCX template

**Starting point.** `parser.py` reads `.docx` (including tables), `.pdf`, and `.txt`, then splits the text into a `Resume`: with the LLM when a key is set, otherwise with rules based on section headings, bullet markers, and dates. `docx_export.py` writes a single-column template with ruled section headings. A resume exported by the app parses back to the same structure; real-world resumes have not been tried.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| T1 | 1 | As a student, I can upload the resume I already have and the app reads it correctly. | At least 10 real-layout resumes (templates from Word, Google Docs, Overleaf; fake content) are collected as test files. A table records what each parser gets right and wrong per file. |
| T2 | 2 | As a student with a two-column PDF, my text does not come out scrambled. | The worst failures from T1 are fixed in the rule-based parser, each with a test. Two-column PDFs are either handled or detected and reported to the user. |
| T3 | 2 | As a student, sections like Awards or Certifications are not silently dropped. | Unknown sections are kept (an "other sections" field on `Resume`, exported as written). Coordinate the model change with everyone, since all modules use `Resume`. |
| T4 | 2 | As a student, my exported resume looks finished. | Spacing, fonts, and alignment are polished. The file opens cleanly in Word, Google Docs, and LibreOffice. Two teammates sign off on the look. |
| T5 | 3 | As a student, I am told when my resume runs past one page. | A length estimate warns in the UI before export. Checked against Word's real page count on five resumes. |
| T6 | 3 | As a student, my resume survives an applicant tracking system. | The exported DOCX is run through at least one free resume parser, and the fields it extracts are compared with the input. Results go in the report. |
| T7 | stretch | As a student, I can pick a second template or export a PDF. | Only if T1 to T6 are done. |

## Web app

**Starting point.** Two tabs. Create: a questionnaire with validation, and saving and loading answers as JSON. Improve: upload or paste a draft, get advice, rebuild it in the template. Both end in a shared review screen with the user's input beside editable bullets, fact warnings, clarity and match scores, and downloads. It has headless tests but has **not been clicked through in a browser by anyone**.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| W1 | 1 | As a student, nothing breaks when I use the app the way a real person would. | Both tabs are walked through in a browser, including save and load, changing entry counts mid-form, and uploading a bad file. Every bug is filed and the blocking ones fixed. |
| W2 | 1 | As a first-time user, I know what to do without reading the README. | Short guidance on each tab, example placeholder text in the questionnaire, and a clear empty state. Tested by watching one person outside the team use it. |
| W3 | 2 | As a student, I can accept or reject each suggested bullet. | Per-bullet accept, revert to original, and regenerate. A rejected bullet falls back to the user's own wording. |
| W4 | 2 | As a student, I understand why a bullet was flagged or scored low. | The review screen shows which clarity checks each bullet fails (from `metrics.bullet_issues`) and explains fact warnings in plain words. |
| W5 | 2 | As a student, I do not lose my work on refresh. | Answers are kept across a page reload, or the app prompts to save before leaving. |
| W6 | 3 | As a presenter, the demo runs smoothly. | A scripted demo path with a prepared example for each tab, loading states for every LLM call, and no raw error traces anywhere. |
| W7 | 3 | As a student, I know where my resume goes. | A visible notice that text is sent to the LLM provider, shown before the first request. |

## Evaluation and integration

**Starting point.** `evaluation/run_eval.py` runs each synthetic case before and after the LLM and reports relevance, clarity, and factual accuracy, plus the means. There is one case. `metrics.py` scores clarity with five rule checks. CI runs the tests on every pull request.

| # | Week | Story | Done when |
| --- | --- | --- | --- |
| E1 | 1 | As the team, we have the 20 synthetic resumes the proposal promised. | 20 cases in `evaluation/synthetic/`, each paired with a job description, varied by major, experience level, and how messy the facts are. No real people's data. |
| E2 | 1 | As the team, we see our first real numbers. | A full evaluation run with the real LLM by the Nov 22 checkpoint, shared with the team with the three worst cases called out. |
| E3 | 2 | As a grader, I can trust the clarity score. | Three teammates rate a sample of at least 40 bullets with a written rubric. Agreement between raters, and between raters and `metrics.py`, is reported. Checks are adjusted if they disagree with people. |
| E4 | 2 | As a grader, I can trust the factual accuracy number. | Every "after" bullet in the 20 cases is hand-checked against its facts. The manual rate is reported next to the automatic one from `factcheck.py` (shared with L3). |
| E5 | 3 | As a grader, I can see the before/after result at a glance. | A results table and one chart per metric, generated by a script from `results.csv`, with a note on whether each difference is larger than run-to-run variation. |
| E6 | 3 | As the team, the final numbers are reproducible. | The model, prompts, and trained vectorizer used for the final run are recorded. The run is repeated once to confirm the numbers hold. |
| E7 | all | As the team, `main` always works. | Pull requests reviewed within a day, CI green, and merge conflicts on `models.py` resolved by talking to both sides. |
| E8 | 4 | As the team, the report and slides are done on time. | Sections assigned by Dec 7, a draft by Dec 10, and a demo rehearsal before submission. |

---

## Where the work crosses over

- **`Resume` in `models.py` is shared by everything.** Announce any field change before making it (T3 is the one planned change).
- **LLM and evaluation** share the truthfulness numbers: L3 builds the labeled set, E4 uses it.
- **Matching and evaluation:** retraining changes every relevance score, so the vectorizer is frozen at the Nov 29 feature freeze.
- **Parsing and web app:** parser failures surface in the Improve tab. Agree on what the user sees when a draft cannot be split into sections.
- **LLM and web app:** W3 (regenerate one bullet) needs a per-bullet function in `llm.py`.

## Risks

| Risk | What we do about it |
| --- | --- |
| The LLM invents facts despite the prompt | The fact guard warns in the UI, L3 and E4 measure it, and the user can always revert to their own wording (W3). |
| API cost or no shared key | Decide in week 1 (L1). The app and all tests run without a key, so no one is blocked. |
| Not enough job postings, or terms forbid using them | Untrained scoring still works. Report it as a limitation rather than scraping against terms. |
| The before/after difference is small | Report it honestly. The human ratings (E3, E4) say more than the automatic scores. |
| Short week 2 | Feature freeze on Nov 29 holds even if a story slips. Unfinished stories move to stretch. |
