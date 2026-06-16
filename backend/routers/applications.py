import uuid
from datetime import date

from fastapi import APIRouter, HTTPException

from backend.models import ApplicationUpdate, JobApplication
from backend.services import applications_service

router = APIRouter()


@router.get("/api/applications", response_model=list[JobApplication])
async def list_applications():
    return applications_service.get_all()


@router.post("/api/applications", response_model=JobApplication, status_code=201)
async def create_application(app: JobApplication):
    if not app.id:
        app = app.model_copy(update={"id": str(uuid.uuid4())})
    if not app.date:
        app = app.model_copy(update={"date": date.today().isoformat()})
    try:
        return applications_service.create(app)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/api/applications/{app_id}", response_model=JobApplication)
async def update_application(app_id: str, patch: ApplicationUpdate):
    try:
        return applications_service.update(app_id, patch)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/api/applications/{app_id}", status_code=204)
async def delete_application(app_id: str):
    try:
        applications_service.delete(app_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
