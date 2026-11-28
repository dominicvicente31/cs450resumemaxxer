# Resume Maxxer

AI resume advice, formatting, and creation. CS 450 project by Jason, Prakhar, Titus, Adyant, and Dominic.

Create a resume from a questionnaire, or improve a draft with writing advice and a consistent template. Built for students and recent graduates turning coursework and early experience into clear, relevant resumes.

**Who does what, and by when: [docs/WORK_PLAN.md](docs/WORK_PLAN.md).**

## Run it locally

Requires Python 3.11+.

```
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

The app opens at http://localhost:8501. It runs without an API key; bullets are then passed through unchanged instead of rewritten.

### React frontend and API (alternative to Streamlit)

```
uvicorn resume_maxxer.api:app --reload --port 8000    # API, from the repo root
cd frontend && npm install && npm run dev            # http://localhost:5173
```

Set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env` to use the API; without it the frontend runs on sample data. See [frontend/README.md](frontend/README.md).

Other commands:

```
pytest                          # unit tests and headless app tests
python -m evaluation.run_eval   # test plan, writes evaluation/results.csv
python -m resume_maxxer.train   # fit TF-IDF on data/job_postings/
```

## LLM setup

The app uses Claude through the Anthropic SDK. Copy `.env.example` to `.env` and replace the placeholder `ANTHROPIC_API_KEY=sk-ant-REPLACE_ME` with your key (the placeholder counts as no key). Both the Streamlit app and the API read it; the key never reaches the browser. `.env` is git-ignored; never commit a key. The model defaults to `claude-opus-5-5`; set `RESUME_MAXXER_MODEL` to use a different one.

Resume text is sent to the Anthropic API when a key is set. Tell anyone whose resume you test with.

## How it fits together

| Piece | File |
| --- | --- |
| Web app entry, sidebar job description, two tabs | `app.py` |
| Tab 1: questionnaire, validation, save and load answers | `resume_maxxer/ui/create.py` |
| Tab 2: upload or paste a draft, advice, rebuild in template | `resume_maxxer/ui/improve.py` |
| Shared review screen: before/after, editable bullets, scores, downloads | `resume_maxxer/ui/common.py` |
| Data model (`Resume`, `Entry`, ...) | `resume_maxxer/models.py` |
| LLM prompts and the one provider call | `resume_maxxer/llm.py` |
| Fact guard: flags numbers and names not in the user's input | `resume_maxxer/factcheck.py` |
| Clarity score for bullets | `resume_maxxer/metrics.py` |
| TF-IDF + cosine similarity against a target job | `resume_maxxer/similarity.py` |
| Training the TF-IDF vectorizer on job postings | `resume_maxxer/train.py` |
| Reading drafts (.docx, .pdf, .txt) and splitting them into sections | `resume_maxxer/parser.py` |
| DOCX template export (python-docx) | `resume_maxxer/docx_export.py` |
| Test plan: synthetic resumes, before vs. after | `evaluation/` |
| HTTP API for the React frontend | `resume_maxxer/api.py` |
| One-call evaluation pipeline used by the API (alignment, advice, rewrites, fact guard, clarity) | `resume_maxxer/evaluate.py` |
| React frontend (upload with preview, results, history, saved prompts). History and prompts are stored in each browser; the API stores nothing. | `frontend/` |
| Where fetched data goes (not committed) | `data/README.md` |

**Create tab:** questionnaire → `Resume` (raw `facts` per entry) → `llm.draft_bullets` fills `bullets` → review screen (fact guard, clarity, job match) → `docx_export.build_docx`.

**Improve tab:** file or pasted text → `parser.extract_text` → job match and `llm.advise` → `parser.parse_resume` (the draft's bullets become `facts`) → `llm.revise_bullets` → same review screen and export.

Each entry keeps the user's original wording in `facts` and the resume wording in `bullets`. Everything that checks truthfulness compares the two, so do not overwrite `facts`.

## Working on it

- Branch from `main`, open a pull request, get one review. CI runs `pytest` on every pull request.
- Tests must pass without an API key or network. Fake the LLM the way `tests/test_core.py` does (`fake_llm` fixture).
- Known gaps are marked `TODO` in the code and tracked as stories in the work plan.
