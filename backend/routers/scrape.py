import httpx
from fastapi import APIRouter, HTTPException

from backend.models import ScrapeRequest
from backend.services.scrape_service import scrape_job_description

router = APIRouter()


@router.post("/api/scrape")
async def scrape_endpoint(req: ScrapeRequest):
    try:
        text = await scrape_job_description(req.url)
        return {"text": text}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error: HTTP {exc.response.status_code} from {req.url}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(exc)}")
