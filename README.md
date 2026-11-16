# Resume Maxxer

AI resume advice, formatting, and creation. CS 450 project by Jason, Prakhar, Titus, Adyant, and Dominic.

Create a resume from a questionnaire, or improve a draft with writing advice and a consistent template. Built for students and recent graduates turning coursework and early experience into clear, relevant resumes.

**Status: skeleton.** The app runs end to end, but the LLM is not connected yet, so bullets come back unchanged. Search the code for `TODO` to find what needs filling in.

## Run it locally

Requires Python 3.11+.

```
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

The app opens at http://localhost:8501.

Other commands:

```
pytest                          # unit tests
python -m evaluation.run_eval   # test plan, writes evaluation/results.csv
```

## How it fits together

| Piece | File | State |
| --- | --- | --- |
| Web app entry, sidebar job description, two tabs | `app.py` | works |
| Tab 1: questionnaire to resume to DOCX | `resume_maxxer/ui/create.py` | works, basic |
| Tab 2: upload or paste a draft, get score and advice | `resume_maxxer/ui/improve.py` | works, advice is a stub |
| Shared data model (`Resume`, `Entry`, ...) | `resume_maxxer/models.py` | works |
| LLM writing advice | `resume_maxxer/llm.py` | **stub** |
| TF-IDF + cosine similarity against a target job | `resume_maxxer/similarity.py` | baseline |
| DOCX template export (python-docx) | `resume_maxxer/docx_export.py` | basic template |
| Read uploaded drafts (.docx, .txt) | `resume_maxxer/parser.py` | text only, no structure |
| Test plan: 20 synthetic resumes, before vs. after | `evaluation/` | 1 of 20 cases, 1 of 3 metrics |

Data flow for the Create tab: questionnaire → `Resume` (raw `facts` per entry) → `llm.draft_bullets` fills `bullets` → `similarity.match_score` against the job description → `docx_export.build_docx`.

## What needs doing

Pick one and put your name next to it.

- [ ] **LLM** (`llm.py`): choose a provider, implement `_complete`, then the prompts for `draft_bullets`, `revise_bullets`, and `advise`. The model must use only the facts the user supplied.
- [ ] **Similarity** (`similarity.py`): improve on the baseline (bigrams, a real job-posting corpus for IDF, synonyms) and explain the score in the UI.
- [ ] **Template** (`docx_export.py`): polish the layout, keep it to one page.
- [ ] **Draft parsing** (`parser.py`): PDF support, and `parse_resume` so an uploaded draft can be re-exported in our template.
- [ ] **UI** (`ui/`): input validation, a better preview, editing bullets before export, before/after view on the Improve tab.
- [ ] **Evaluation** (`evaluation/`): write 19 more synthetic resumes, define the clarity and factual accuracy metrics.

## LLM setup

Copy `.env.example` to `.env` and fill it in once a provider is chosen. `.env` is git-ignored; never commit API keys. While `LLM_API_KEY` is empty the app falls back to passing text through unchanged.
