# ResumeForge

A local-first resume tailoring app. Paste a job description (or a URL), and Claude intelligently tailors your resume to the role — reframing and reordering your real experience, never inventing anything new. Review and edit the output inline, then download a one-page PDF.

---

## Prerequisites

| Dependency | Notes |
|---|---|
| Python 3.11+ | Via conda |
| Node.js 18+ | For the frontend |
| TeX Live (optional) | PDF rendering only — see below |
| Anthropic API key | Set in `.env` |

**PDF rendering** requires `pdflatex`. Install TeX Live:
```bash
brew install --cask mactex   # macOS (~4GB, full TeX Live)
# or for a minimal install:
brew install basictex         # then: sudo tlmgr install <packages>
```
The app runs without TeX Live — the `/api/render` endpoint returns a helpful error until it's installed.

---

## Setup

### 1. Configure environment variables

Edit `.env` in the project root:
```
ANTHROPIC_API_KEY=sk-ant-...        # required
RESUME_NAME=Jane Smith              # used in the PDF header
RESUME_TITLE=Software Engineer
RESUME_PHONE=415-555-1234
RESUME_EMAIL=jane@example.com
RESUME_LINKEDIN=linkedin.com/in/jane
RESUME_GITHUB=github.com/jane
```

### 2. Add your master CV

Drop your `.tex` resume into:
```
cv/master_cv.tex
```
This file is the source of truth. The app reads it at startup but **never modifies it**.

### 3. Backend

```bash
# Create the conda environment (first time only)
conda create -n job-tailor python=3.11 -y
conda activate job-tailor
pip install -r backend/requirements.txt

# Run the backend
conda activate job-tailor
uvicorn backend.main:app --reload --port 8000
```

> **Note:** Always run `conda activate job-tailor` before starting the backend.

### 4. Frontend

```bash
cd frontend
npm install     # first time only
npm run dev
```

The frontend runs at **http://localhost:5173**.

---

## Running

Open two terminals:

**Terminal 1 — Backend:**
```bash
conda activate job-tailor
uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm run dev
```

Visit **http://localhost:5173**, paste a job description, and click "Tailor Resume".

---

## Architecture

The backend is a FastAPI server with three routes: `/api/scrape` fetches and cleans job descriptions from URLs, `/api/tailor` sends your master CV and the job description to `claude-sonnet-4-6` with a strict no-fabrication system prompt and returns a structured `TailoredResume` JSON object, and `/api/render` populates a LaTeX template with the tailored content and compiles it to PDF via `pdflatex`. The React frontend is a single-page app with three states — Input, Processing, and Review — where each bullet point in the tailored resume is individually editable inline before download.

---

## How it works

1. **Input:** Paste a job description (or enter a URL to scrape it) along with company name and job title.
2. **Tailor:** Claude reads your master CV and the JD, then selects and reframes the most relevant experience. No new skills or roles are invented.
3. **Review:** Inspect the tailored resume. Click any bullet to edit it. Open "Why these changes?" to see Claude's reasoning.
4. **Download:** Click "Download PDF" to compile and download your one-page resume.

---

## Known limitations

- PDF rendering requires tectonic — install with `brew install tectonic`
- First tectonic compile in a cold container downloads LaTeX packages (~30s); subsequent compiles are fast

---

## Deploying to Google Cloud Run

The app ships as a single Docker image: FastAPI serves both the API and the pre-built React frontend.

### 1. Install prerequisites

```bash
brew install google-cloud-sdk
gcloud auth login
gcloud auth configure-docker
```

### 2. Create a GCP project

```bash
gcloud projects create resumeforge-prod --name="ResumeForge"
gcloud config set project resumeforge-prod

# Enable required APIs
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    storage.googleapis.com \
    artifactregistry.googleapis.com
```

### 3. Create a GCS bucket for run storage

```bash
gcloud storage buckets create gs://resumeforge-runs \
    --location=us-central1 \
    --uniform-bucket-level-access
```

### 4. Create an Artifact Registry repository

```bash
gcloud artifacts repositories create resumeforge \
    --repository-format=docker \
    --location=us-central1
```

### 5. Build and push the Docker image

```bash
# From the project root
docker build -t us-central1-docker.pkg.dev/resumeforge-prod/resumeforge/app:latest .
docker push us-central1-docker.pkg.dev/resumeforge-prod/resumeforge/app:latest
```

Or use Cloud Build (no local Docker required):
```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/resumeforge-prod/resumeforge/app:latest
```

### 6. Create a service account with GCS access

```bash
gcloud iam service-accounts create resumeforge-sa \
    --display-name="ResumeForge Service Account"

gcloud storage buckets add-iam-policy-binding gs://resumeforge-runs \
    --member="serviceAccount:resumeforge-sa@resumeforge-prod.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"
```

### 7. Deploy to Cloud Run

Pick a strong random password for `APP_SECRET` — this is what you'll enter on the login screen.

```bash
gcloud run deploy resumeforge \
    --image=us-central1-docker.pkg.dev/resumeforge-prod/resumeforge/app:latest \
    --region=us-central1 \
    --platform=managed \
    --allow-unauthenticated \
    --service-account=resumeforge-sa@resumeforge-prod.iam.gserviceaccount.com \
    --memory=1Gi \
    --cpu=1 \
    --set-env-vars="ANTHROPIC_API_KEY=sk-ant-...,\
APP_SECRET=your-strong-password,\
GCS_BUCKET=resumeforge-runs,\
RESUME_NAME=Andrew Lim,\
RESUME_TITLE=Machine Learning Engineer,\
RESUME_PHONE=415-866-3347,\
RESUME_EMAIL=andrewtclim1@gmail.com,\
RESUME_LINKEDIN=linkedin.com/in/andrewtclim,\
RESUME_GITHUB=github.com/andrewtclim"
```

Cloud Run will print your service URL. Open it, enter your `APP_SECRET` password, and the app is live.

### Re-deploying after changes

```bash
docker build -t us-central1-docker.pkg.dev/resumeforge-prod/resumeforge/app:latest . \
  && docker push us-central1-docker.pkg.dev/resumeforge-prod/resumeforge/app:latest \
  && gcloud run deploy resumeforge \
      --image=us-central1-docker.pkg.dev/resumeforge-prod/resumeforge/app:latest \
      --region=us-central1
```

### Run storage

Each PDF download saves two objects to `gs://resumeforge-runs`:
```
runs/{date}/{company}_{title}_{time}/tailored.json
runs/{date}/{company}_{title}_{time}/resume.pdf
```

Your master CV is also synced to `gs://resumeforge-runs/cv/master_cv.tex` when saved via the Edit CV panel, so it persists across container restarts.

## Future extensions

- Application tracker (log JDs applied to with resume version)
- Cover letter generation using the same pipeline
