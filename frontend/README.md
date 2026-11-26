# Resume Maxxer frontend (React)

A standalone React + Vite frontend. It isn't connected to the Python backend yet; until it is, it runs on sample data.

```
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## Pages

| Route | Page | Goes to |
| --- | --- | --- |
| `/` | Welcome: what the app does | `/upload` |
| `/upload` | Upload a file, plus an optional job description | `/incompatible` or `/loading` |
| `/incompatible` | Why the file was rejected | `/upload` |
| `/loading` | Evaluation in progress (can be cancelled) | `/results/:id` or `/incompatible` |
| `/results/:id` | Scores, missing keywords, advice, rewritten bullets | `/` |
| `/history` | Past submissions (separate from the main flow) | `/results/:id` |

## Connecting the backend

All backend calls are in `src/api/client.js`. Each function has a `TODO` describing the endpoint it expects:

- `validateFile(file)`: runs in the browser (extension, size). Mirrors `parser.SUPPORTED_EXTENSIONS`.
- `evaluateResume(file, jobDescription, signal)`: `POST /evaluate`. Returns the `Evaluation` shape documented in the file. A `422` response sends the user to the Incompatible page.
- `downloadRevised(id)`: `GET /submissions/{id}/docx`.

Set `VITE_API_BASE_URL` in `frontend/.env` (see `.env.example`) to switch off mock mode.

In mock mode, a file with "corrupt" in its name simulates the backend rejecting it.

## Submission history

`src/history/historyStore.js` is the only module that touches history. It currently stores submissions in the browser's `localStorage` (per browser, max 50). To move it to the backend, replace the bodies of `listSubmissions`, `getSubmission`, `saveSubmission`, `deleteSubmission` and `clearSubmissions`; the pages won't need changes.
