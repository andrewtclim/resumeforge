import json
import pathlib
import uuid
from datetime import date

from backend.models import ApplicationUpdate, JobApplication
from backend.services.gcs_service import load_applications_from_gcs, save_applications_to_gcs

_DATA_FILE = pathlib.Path(__file__).parent.parent.parent / "data" / "applications.json"


def _read() -> list[dict]:
    gcs_data = load_applications_from_gcs()
    if gcs_data is not None:
        return gcs_data
    if not _DATA_FILE.exists():
        return []
    try:
        return json.loads(_DATA_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []


def _write(records: list[dict]) -> None:
    save_applications_to_gcs(records)
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    _DATA_FILE.write_text(json.dumps(records, indent=2))


def get_all() -> list[JobApplication]:
    return [JobApplication(**r) for r in _read()]


def create(app: JobApplication) -> JobApplication:
    records = _read()
    if not app.id:
        app = app.model_copy(update={"id": str(uuid.uuid4())})
    if not app.date:
        app = app.model_copy(update={"date": date.today().isoformat()})
    records.append(app.model_dump())
    _write(records)
    return app


def update(app_id: str, patch: ApplicationUpdate) -> JobApplication:
    records = _read()
    for i, r in enumerate(records):
        if r["id"] == app_id:
            updates = {k: v for k, v in patch.model_dump().items() if v is not None}
            records[i] = {**r, **updates}
            _write(records)
            return JobApplication(**records[i])
    raise KeyError(app_id)


def delete(app_id: str) -> None:
    records = _read()
    new_records = [r for r in records if r["id"] != app_id]
    if len(new_records) == len(records):
        raise KeyError(app_id)
    _write(new_records)
