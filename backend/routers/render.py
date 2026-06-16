import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend.models import RenderRequest
from backend.services.latex_service import (
    PDFLATEX_AVAILABLE,
    compile_to_pdf,
    populate_template,
)

router = APIRouter()


def _get_personal_info() -> dict:
    return {
        "name": os.getenv("RESUME_NAME", "Your Name"),
        "title": os.getenv("RESUME_TITLE", "Software Engineer"),
        "phone": os.getenv("RESUME_PHONE", "555-555-5555"),
        "email": os.getenv("RESUME_EMAIL", "you@example.com"),
        "linkedin": os.getenv("RESUME_LINKEDIN", "linkedin.com/in/yourhandle"),
        "github": os.getenv("RESUME_GITHUB", "github.com/yourhandle"),
    }


@router.post("/api/render")
async def render_endpoint(req: RenderRequest):
    if not PDFLATEX_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "pdflatex_unavailable",
                "message": (
                    "PDF rendering is not available — no LaTeX engine found. "
                    "Install tectonic (lightweight, ~30MB) and restart the server."
                ),
                "install_hint": "brew install tectonic",
            },
        )

    try:
        personal_info = _get_personal_info()
        latex_source = populate_template(req.resume, personal_info)
        pdf_bytes = compile_to_pdf(latex_source)

        # Persist run to GCS (non-blocking best-effort)
        from backend.services.gcs_service import save_run
        import asyncio
        asyncio.get_event_loop().run_in_executor(
            None,
            save_run,
            personal_info.get("name", "unknown"),
            req.resume.summary_title,
            req.resume.model_dump(),
            pdf_bytes,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume.pdf"'},
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Render failed: {str(exc)}")
