"""HTTP API for the React frontend (frontend/).

Run locally with:  uvicorn resume_maxxer.api:app --reload --port 8000

Stateless: the server stores nothing. Submission history, the primary resume,
and saved job descriptions live in each user's browser (frontend/src/history/
and frontend/src/prompts/), so no database is needed and one user's history
is never visible to another.

The Anthropic API key is read on the server from .env (ANTHROPIC_API_KEY);
it is never sent to or stored in the browser.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from resume_maxxer import docx_export, llm, parser
from resume_maxxer.evaluate import evaluate
from resume_maxxer.models import Resume

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
# 5 GB. Accepted files are parsed in memory, so the server needs RAM to match.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024

app = FastAPI(title="Resume Maxxer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("RESUME_MAXXER_CORS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def status() -> dict:
    """Lets the frontend show whether the LLM is set up (never the key itself)."""
    return {
        "llmConfigured": llm.is_configured(),
        "model": llm._model(),
        "minJobDescriptionChars": llm.MIN_JOB_DESCRIPTION_CHARS,
        "maxUploadBytes": MAX_UPLOAD_BYTES,
    }


def _read_upload(file: UploadFile) -> tuple[str, str]:
    """Return (file name, extracted text) or raise 422 with a user-facing reason."""
    name = file.filename or "resume"
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in parser.SUPPORTED_EXTENSIONS:
        raise HTTPException(422, f'".{extension}" files are not supported.')
    # Starlette spools large uploads to a temp file, so measure before reading
    # anything into memory.
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(422, "That file is larger than 5 GB.")
    data = file.file.read()
    try:
        text = parser.extract_text(name, data)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except Exception as error:  # corrupt or mislabeled file
        raise HTTPException(422, "Could not read that file. Try saving it again.") from error
    if not text.strip():
        raise HTTPException(422, "No text found in this file.")
    return name, text


@app.post("/api/evaluate")
def evaluate_resume(
    job_description: str = Form(""),
    file: UploadFile | None = File(None),
    resume_text: str = Form(""),
    file_name: str = Form(""),
) -> dict:
    """Evaluate an uploaded file, or already-extracted `resume_text` (the browser
    sends this when re-checking the primary resume it saved).

    Returns {fileName, resumeText, evaluation, revisedResume}; the browser saves
    it to its own history. Nothing is kept on the server.

    Status codes: 400 job description too short, 422 the resume can't be used
    (the frontend shows its Incompatible page).
    """
    if problem := llm.job_description_problem(job_description):
        raise HTTPException(400, problem)
    if file is not None:
        name, text = _read_upload(file)
    elif resume_text.strip():
        name, text = file_name or "resume.txt", resume_text
    else:
        raise HTTPException(422, "No file was uploaded.")

    try:
        evaluation, revised = evaluate(text, job_description)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error

    return {
        "fileName": name,
        "resumeText": text,
        "evaluation": evaluation,
        "revisedResume": revised.to_dict(),
    }


class DocxRequest(BaseModel):
    resume: dict


@app.post("/api/docx")
def build_docx(request: DocxRequest) -> Response:
    """Turn a revisedResume (from /api/evaluate, stored in the browser) into a .docx."""
    try:
        resume = Resume.from_dict(request.resume)
    except (TypeError, AttributeError) as error:
        raise HTTPException(400, "That resume data is not in the expected format.") from error
    return Response(
        docx_export.build_docx(resume),
        media_type=DOCX_MIME,
        headers={"Content-Disposition": 'attachment; filename="resume.docx"'},
    )
