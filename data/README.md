# Data

Nothing in `job_postings/` or `resumes/` is committed (see `.gitignore`). Each person fetches the data locally; share large sets through the team drive, not git.

## `job_postings/`: training corpus for job matching

One posting per `.txt` file, plain text, any file name. Aim for a few hundred entry-level and internship postings across the majors we target.

Train with:

```
python -m resume_maxxer.train
```

This writes `models/tfidf.joblib`. The app and the evaluation script use it automatically when it exists, and fall back to untrained scoring when it does not. Training needs at least 20 postings.

## `resumes/`: real resumes for calibration

Optional. Use only resumes whose owners agreed, and remove names, emails, phone numbers, and addresses before saving them. They are for checking the parser and calibrating the score bands in `similarity.py`, not for the 20-resume test plan, which uses the synthetic cases in `evaluation/synthetic/`.

## Before adding a data source

Write down where it came from and its license or terms of use in this file, so the final report can cite it.

| Source | What | Added by | Terms |
| --- | --- | --- | --- |
| _none yet_ | | | |
