from dotenv import load_dotenv

load_dotenv()

import pathlib  # noqa: E402

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from backend.middleware.auth import AuthMiddleware  # noqa: E402
from backend.routers import scrape, tailor, render, applications  # noqa: E402
from backend.cv_store import get_master_cv, save_master_cv  # noqa: E402
from backend.services.latex_service import PDFLATEX_AVAILABLE  # noqa: E402

app = FastAPI(title="ResumeForge API", version="1.0.0")

app.add_middleware(AuthMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scrape.router)
app.include_router(tailor.router)
app.include_router(render.router)
app.include_router(applications.router)


@app.get("/api/ping")
async def ping():
    """Public endpoint — used by the frontend to validate a token."""
    return {"ok": True}


@app.get("/health")
async def health():
    cv = get_master_cv()
    return {
        "status": "ok",
        "pdflatex": PDFLATEX_AVAILABLE,
        "cv_loaded": bool(cv),
    }


@app.get("/api/cv")
async def cv_get():
    return {"content": get_master_cv()}


class CvUpdateRequest(BaseModel):
    content: str


@app.post("/api/cv")
async def cv_update(req: CvUpdateRequest):
    if not req.content.strip():
        raise HTTPException(status_code=422, detail="CV content cannot be empty.")
    try:
        save_master_cv(req.content)
        return {"ok": True, "length": len(req.content)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save CV: {exc}")


# Serve the built React app in production.
# In dev, Vite runs separately on :5173.
_STATIC_DIR = pathlib.Path(__file__).parent.parent / "frontend" / "dist"

if _STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Serve index.html for any non-API route so React Router works."""
        return FileResponse(_STATIC_DIR / "index.html")
