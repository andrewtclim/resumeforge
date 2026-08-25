from fastapi import APIRouter, HTTPException

from backend.models import RefineRequest, TailorRequest, TailoredResume
from backend.services.claude_service import refine_resume, tailor_resume

router = APIRouter()


@router.post("/api/tailor", response_model=TailoredResume)
async def tailor_endpoint(req: TailorRequest):
    try:
        result = await tailor_resume(
            job_description=req.job_description,
            company_name=req.company_name,
            job_title=req.job_title,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Claude service error: {str(exc)}")


@router.post("/api/refine", response_model=TailoredResume)
async def refine_endpoint(req: RefineRequest):
    try:
        result = await refine_resume(
            job_description=req.job_description,
            company_name=req.company_name,
            job_title=req.job_title,
            current_resume=req.current_resume,
            feedback=req.feedback,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Claude service error: {str(exc)}")
