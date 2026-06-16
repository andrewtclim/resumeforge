# ResumeForge — Project Context for Claude

## What this is
A local-first resume tailoring web app. Andrew pastes a job description (or URL), Claude reframes his real experience to match the role, he edits inline, then downloads a one-page PDF. The cardinal rule: **no fabrication** — Claude rephrases and reorders, never invents skills, roles, or metrics.

**Stack:** FastAPI (Python 3.11) + React (Vite) + Anthropic API (`claude-sonnet-4-6`) + tectonic (LaTeX → PDF)  
**Owner:** Andrew Lim — ML engineer, USF MSDS student. Uses conda (never venv).

---

## How to run locally

```bash
# Terminal 1 — backend (must be run from project root)
conda activate job-tailor
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
# → http://localhost:5173
```

`APP_SECRET` is not set locally, so auth is bypassed automatically. The login gate only activates in prod.

---

## Environment variables (`.env` at project root)

```
ANTHROPIC_API_KEY=...        # required
APP_SECRET=...               # prod only — password for the login gate
GCS_BUCKET=...               # prod only — bucket name for run storage
RESUME_NAME=Andrew Lim
RESUME_TITLE=Machine Learning Engineer
RESUME_PHONE=415-866-3347
RESUME_EMAIL=andrewtclim1@gmail.com
RESUME_LINKEDIN=linkedin.com/in/andrewtclim
RESUME_GITHUB=github.com/andrewtclim
```

---

## File map

### Backend

| File | Purpose |
|---|---|
| `backend/main.py` | FastAPI app. Mounts auth middleware, CORS, all routers. In prod serves the React `dist/` via `StaticFiles`. Also has `GET/POST /api/cv` and `GET /health`. |
| `backend/models.py` | Pydantic models: `TailorRequest`, `ResumeSection`, `ProjectSection`, `EducationSection`, `TailoredResume` (now includes `work_type`, `location`, `tailoring_notes: list[str]`), `ScrapeRequest`, `RenderRequest`, `JobApplication`, `ApplicationUpdate`. |
| `backend/cv_store.py` | `get_master_cv()` reads from GCS first, falls back to `cv/master_cv.tex`. `save_master_cv()` writes to both. Always reads fresh — no startup cache. |
| `backend/middleware/auth.py` | Bearer token middleware. Reads `APP_SECRET` env var. If unset (local dev), passes everything through. Only protects `/api/*` routes; static files are public. |
| `backend/routers/scrape.py` | `POST /api/scrape` — httpx + BeautifulSoup, returns cleaned JD text (≤8000 chars). |
| `backend/routers/tailor.py` | `POST /api/tailor` → `TailoredResume` JSON. Calls `claude_service.tailor_resume()`. |
| `backend/routers/render.py` | `POST /api/render` → PDF bytes. Populates LaTeX template, runs tectonic, saves run to GCS. |
| `backend/services/claude_service.py` | Calls `claude-sonnet-4-6` via Anthropic SDK (sync, wrapped in `asyncio.to_thread`). Strips markdown fences from response. Retries once on bad JSON using multi-turn correction. |
| `backend/services/latex_service.py` | `populate_template()` builds LaTeX from `TailoredResume` + personal info. `compile_to_pdf()` runs tectonic. Uses `LATEX_ENGINE` (prefers tectonic over pdflatex). Escapes LaTeX special chars (backslash first). |
| `backend/services/scrape_service.py` | Async httpx scraper. Selector priority: article → main → job class heuristics → body. |
| `backend/services/gcs_service.py` | GCS reads/writes. `save_run()` saves `tailored.json` + `resume.pdf` to `runs/{date}/{company}_{title}_{time}/`. `load_cv_from_gcs()` / `save_cv_to_gcs()` for CV persistence. All methods no-op silently if `GCS_BUCKET` is unset. |
| `backend/services/applications_service.py` | CRUD over `data/applications.json`. `get_all()`, `create()`, `update(id, patch)`, `delete(id)`. Auto-assigns UUID and today's date if missing on create. |
| `backend/routers/applications.py` | `GET/POST /api/applications`, `PUT/DELETE /api/applications/{id}`. |
| `templates/resume_template.tex` | LaTeX template. Tokens: `{{NAME}}`, `{{TITLE}}`, `{{PHONE}}`, `{{EMAIL}}`, `{{LINKEDIN}}`, `{{GITHUB}}`, `{{SECTIONS_BODY}}`. Sections are built and ordered by `sections_order` from Claude's response. |
| `cv/master_cv.tex` | Andrew's full master CV. Source of truth for all tailoring. Never modified by the app except via the Edit CV UI or `save_master_cv()`. |

### Frontend

| File | Purpose |
|---|---|
| `frontend/src/App.jsx` | Root component. Two header tabs: "Tailor" and "Tracker". Tailor tab phase-switches between `JobInput`, `TailoringStatus`, `ResumePreview` + `ApplyPrompt` banner. Tracker tab shows `TrackerView`. Header always shows "Edit CV". |
| `frontend/src/hooks/useTailor.js` | All async state. Phases: `input → processing → review → error`. Stores `jobInput` (company + title + jobUrl). `edits` dict keyed `"section:itemIndex:bulletIndex"`. Exposes `jobInput` so `ApplyPrompt` can pre-fill. |
| `frontend/src/hooks/useTracker.js` | Applications list state. `add()`, `update()`, `remove()`. Auto-loads on mount from `GET /api/applications`. |
| `frontend/src/api/client.js` | Axios instance. `baseURL` is `""` in prod (same origin) and `http://localhost:8000` in dev. Interceptors for auth and 401 handling. Exports CRUD functions for applications: `getApplications`, `createApplication`, `updateApplication`, `deleteApplication`. |
| `frontend/src/components/LoginGate.jsx` | On mount, checks `app_token` in localStorage via `GET /api/ping`. If valid, renders children. Otherwise shows password input. Stores raw password as the token. |
| `frontend/src/components/JobInput.jsx` | Tab toggle: Paste JD / From URL. Company + title fields. Calls `onSubmitText` or `onSubmitUrl`. |
| `frontend/src/components/TailoringStatus.jsx` | Spinner + cycling status messages (5 messages, 2200ms each). |
| `frontend/src/components/ResumePreview.jsx` | Renders `TailoredResume` as a document. Bullets are `contentEditable` spans with `onBlur` → `onBulletEdit`. "Why these changes?" collapsible sidebar shows `tailoring_notes` as a bullet list. Sections rendered in `sections_order` order. |
| `frontend/src/components/ApplyPrompt.jsx` | Non-blocking banner shown above the resume in review phase. "Did you apply?" prompt → Yes opens a pre-filled form (company, title, date, url, work_type, location) → saves via `createApplication()` → shows "Logged!" for 1.8s then dismisses. "Not yet" dismisses immediately. |
| `frontend/src/components/TrackerView.jsx` | Table of all applications. Columns: date, company, role, work type (badge), location, applied (checkbox), URL, notes, actions. Edit opens a modal; delete confirms then removes. "Add Application" opens a blank modal. |
| `frontend/src/components/CvEditor.jsx` | Slide-in panel from right. Loads CV via `GET /api/cv`, saves via `POST /api/cv`. Closes on Escape or outside click. |
| `frontend/src/components/DownloadButton.jsx` | Button with local loading state during async PDF download. |

---

## Key design decisions and gotchas

**tectonic over pdflatex.** tectonic is ~30MB vs MacTeX's 4GB. Installed via `brew install tectonic`. The template strips `\usepackage{fontawesome5}`, `\usepackage{multicol}`, `\usepackage{marvosym}`, `\input{glyphtounicode}`, and `\pdfgentounicode=1` — these are either pdfTeX-specific primitives that crash tectonic's XeTeX engine or unused in the generated output. The master CV still uses fontawesome5 for its own header (that's fine, it's never compiled through our template).

**LaTeX escaping order matters.** Backslash must be escaped first in `_LATEX_ESCAPES`. Every other escape emits a backslash, so escaping `\` last would corrupt them.

**Claude SDK is sync-only.** `_client.messages.create()` blocks. Always wrapped in `asyncio.to_thread()` in FastAPI async routes.

**CV is read fresh on every tailor call.** `get_master_cv()` hits disk (or GCS) each time — no module-level cache. This lets edits take effect immediately without a server restart.

**Auth bypass in local dev.** `AuthMiddleware` checks `if not APP_SECRET: pass through`. Never set `APP_SECRET` locally.

**GCS is best-effort.** All `gcs_service` calls catch exceptions and log warnings. The app never fails a user-facing request because GCS is down or unconfigured.

**sections_order controls layout.** Claude decides the order. The system prompt tells it to put education first for internship/new-grad roles. `latex_service` and `ResumePreview` both respect this list.

**Inline editing via contentEditable + onBlur.** Edits stored in a flat dict: `edits["experience:0:1"]`. On PDF download, `buildFinalResume()` merges edits over the base resume using `edits[key] ?? bullet`.

**Download filename** is built from the job input: `google_ml_engineer_intern_resume.pdf`. Slugified (lowercase, non-alphanum → underscore).

**Application tracker storage** is a local flat JSON array at `data/applications.json`. Read/written by `applications_service.py` on every request — no in-memory cache. `id` and `date` default to `""` on the model so the frontend can omit them; the backend fills them in (UUID + local date) before writing.

**Local date vs UTC.** `new Date().toISOString()` returns UTC, which is off by one for US timezones. All `today()` helpers in the frontend use `getFullYear/getMonth/getDate` on the local Date object instead.

**tailoring_notes is now a list.** Claude returns `tailoring_notes` as a JSON array of 3-5 bullet strings. `ResumePreview` handles both array and legacy string format for backwards compatibility.

**Dockerfile warmup uses `printf`, not `echo`.** The tectonic pre-warm step writes a minimal `.tex` file. `echo` with backslash-containing strings is unreliable across shells — zsh interprets `\u` as a Unicode escape producing null bytes, which TeX rejects as invalid characters. `printf '%s\n' '...'` passes the argument verbatim regardless of shell.

**`data/applications.json` is ephemeral in Cloud Run.** The tracker writes to the container filesystem, which resets on restart/scale-to-zero. Tracker data is local-only; this is acceptable for personal use. If persistence is needed later, move storage to GCS.

---

## Docker / prod deployment

The `Dockerfile` is a two-stage build:
1. `node:20-alpine` compiles the React app
2. `python:3.11-slim` installs tectonic (musl binary from GitHub releases), Python deps, and copies the `dist/` into `frontend/dist/`

In prod, FastAPI serves the React build via `StaticFiles` and a `/{full_path:path}` SPA fallback route. No separate Vite server needed.

**Live URL:** `https://resumeforge-237469981810.us-central1.run.app`  
**GCP project:** `job-tailor-499623`  
**Region:** `us-central1`, 1Gi memory (tectonic needs headroom), scales to zero.  
**Artifact Registry:** `us-central1-docker.pkg.dev/job-tailor-499623/resumeforge/app`  
**GCS bucket:** `resumeforge-runs`  
**Runtime service account:** `resumeforge-sa@job-tailor-499623.iam.gserviceaccount.com` (objectAdmin on bucket)

GCS run storage path: `runs/{YYYY-MM-DD}/{company}_{title}_{HHMMSS}/tailored.json` + `resume.pdf`  
GCS CV path: `cv/master_cv.tex`

**Re-deploy manually** (only needed if bypassing CI):
```bash
docker build --platform linux/amd64 \
    -t us-central1-docker.pkg.dev/job-tailor-499623/resumeforge/app:latest . \
&& docker push us-central1-docker.pkg.dev/job-tailor-499623/resumeforge/app:latest \
&& gcloud run deploy resumeforge \
    --image=us-central1-docker.pkg.dev/job-tailor-499623/resumeforge/app:latest \
    --region=us-central1 --project=job-tailor-499623
```
Note: `--platform linux/amd64` is required on Apple Silicon — the tectonic binary is x86_64 musl.

---

## GitHub + CI/CD

**Repo:** `https://github.com/andrewtclim/resumeforge` (private)

Pushing to `main` auto-deploys via `.github/workflows/deploy.yml`:
1. Builds Docker image tagged with the commit SHA
2. Pushes to Artifact Registry
3. Deploys to Cloud Run (preserves all env vars from previous revision)

Build time is ~2 min with Docker layer cache warm. CI uses the `resumeforge-ci` service account (`GCP_SA_KEY` GitHub secret) with minimal permissions: Artifact Registry writer + Cloud Run developer.

---

## To-do list (highest → lowest priority)

- [ ] **Cheaper runs** — Currently hardcoded to `claude-sonnet-4-6`. Experiment with `claude-haiku-4-5` for cost (much cheaper, may be good enough for structured JSON extraction). Add model as a config option so it's easy to switch.
- [ ] **UI redesign** — Current UI is functional but generic. Andrew wants a different look. Scope TBD — could be typography, layout, color scheme, or a full redesign.
- [ ] **Keyless GCP auth for CI** — Replace the `GCP_SA_KEY` JSON key in GitHub secrets with Workload Identity Federation. Eliminates the long-lived credential risk — GitHub Actions gets a short-lived token per run instead. `resumeforge-ci` SA already exists; just needs WIF pool + provider setup and workflow updated to use `workload_identity_provider` instead of `credentials_json`.
- [x] **GCS + Cloud Run deployment** — Done. Bucket `resumeforge-runs`, Artifact Registry repo, service account, Cloud Run service all set up. Live at `https://resumeforge-237469981810.us-central1.run.app`.
- [x] **Auth in prod** — Done. `APP_SECRET` set as Cloud Run env var; login gate active.
- [x] **GitHub setup** — Done. Private repo at `github.com/andrewtclim/resumeforge`. CI/CD pipeline auto-deploys on push to main via GitHub Actions.
- [x] **Job application tracker** — Done. Two-tab UI (Tailor/Tracker). `ApplyPrompt` banner post-generation. CRUD via `data/applications.json`. Claude extracts `work_type` + `location` from the JD.
- [x] **Fix tailoring_notes format** — Done. Claude now returns a 3-5 item bullet array; rendered as a dot list in the sidebar.
- [x] **Eliminate em dashes** — Done. Rule 8 added to system prompt.
