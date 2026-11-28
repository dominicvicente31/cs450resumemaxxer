# Resume Maxxer frontend (React)

A React + Vite frontend for the API in `resume_maxxer/api.py`. Without the API it runs in demo mode on sample data.

```
# 1. API, from the repo root (needs .env with ANTHROPIC_API_KEY for grading and rewrites)
uvicorn resume_maxxer.api:app --reload --port 8000

# 2. Frontend
cd frontend
cp .env.example .env      # then set VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev               # http://localhost:5173
```

## Pages

| Route | Page | Goes to |
| --- | --- | --- |
| `/` | Welcome: what the app does | `/upload` |
| `/upload` | Upload a file (with preview) or use the primary resume, plus the job description (required, 50+ characters) | `/incompatible` or `/loading` |
| `/incompatible` | Why the file was rejected | `/upload` |
| `/loading` | Evaluation in progress (can be cancelled) | `/results/:id` or `/incompatible` |
| `/results/:id` | Alignment grade, clarity, wording overlap, keywords, advice, rewritten bullets; set as primary; reuse the job description; download .docx | `/` |
| `/history` | Past submissions (separate from the main flow): primary resume, make primary, delete, scrap older drafts | `/results/:id` |
| `/prompts` | Saved job descriptions: search, use, edit, delete, add new | `/upload` |

## Where things live

- `src/api/client.js`: every backend call, the `Evaluation` shape, and the demo-mode mock.
- `src/history/historyStore.js`: submission history and the primary resume.
- `src/prompts/promptStore.js`: saved job descriptions.
- Both use `localStorage`, so history stays on the device. The API stores nothing.
- `src/components/FilePreview.jsx`: the upload preview. PDFs use the browser's viewer; `.txt` and `.docx` show their text (`.docx` is read in the browser with mammoth, loaded only when needed).

## Rules the UI follows

- **API key:** only on the server (`ANTHROPIC_API_KEY` in the repo-root `.env`). The frontend just shows a banner when `/api/status` says none is set.
- **Job description:** at least 50 characters, enforced here, in the API (400), and in `evaluate.py`.
- **Alignment score:** 0-100 from the model. `-1` means it couldn't be graded, and the reason is shown.
- **History is per device:** submissions and saved job descriptions are kept in this browser only. Clearing site data erases them, and they don't sync between devices.
- **Submissions:** at most 30. Past 30, the oldest drafts are removed automatically. The primary resume is never removed automatically; its text is stored so it can be re-checked without uploading again.
- **Saved job descriptions:** at most 30, least recently used removed first. Each one used in an evaluation is saved automatically; the same text is stored once.
- **File size:** up to 5 GB. Large `.txt` files preview only their first 256 KB; `.docx` over 50 MB isn't previewed.

## End-to-end walkthrough

`npm run e2e` drives the app in a headless browser and checks every page: upload validation, the Incompatible page, previews, results, download, the primary resume, the 30-submission limit, scrapping drafts, saved prompts, phone width, and dark mode. It uses a fresh browser profile, so your own history is untouched.

```
npx playwright install chromium        # once
# with the API on :8000 and `npm run dev` on :5173:
npm run e2e                            # no API key: expects alignment -1
E2E_EXPECT_KEY=1 npm run e2e           # with a key in .env: expects a real grade and rewrites
```

Screenshots are saved to `e2e/shots/` (git-ignored). Fixtures are in `e2e/fixtures/`.

## Trying the edge cases in demo mode

- A file with "corrupt" in its name: the backend rejects it, so you land on the Incompatible page.
- "unscorable" anywhere in the job description: the alignment score comes back as -1.
