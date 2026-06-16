import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

GCS_BUCKET = os.getenv("GCS_BUCKET", "")

_client = None
_bucket = None


def _get_bucket():
    global _client, _bucket
    if not GCS_BUCKET:
        return None
    if _bucket is None:
        from google.cloud import storage
        _client = storage.Client()
        _bucket = _client.bucket(GCS_BUCKET)
    return _bucket


def _slug(text: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def save_run(company_name: str, summary_title: str, resume_dict: dict, pdf_bytes: bytes) -> str | None:
    """
    Save tailored.json + resume.pdf to GCS.
    Returns the GCS folder path, or None if GCS is not configured.
    """
    bucket = _get_bucket()
    if bucket is None:
        return None

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ts = datetime.now(timezone.utc).strftime("%H%M%S")
    folder = f"runs/{date_str}/{_slug(company_name)}_{_slug(summary_title)}_{ts}"

    try:
        json_blob = bucket.blob(f"{folder}/tailored.json")
        json_blob.upload_from_string(
            json.dumps(resume_dict, indent=2),
            content_type="application/json",
        )

        pdf_blob = bucket.blob(f"{folder}/resume.pdf")
        pdf_blob.upload_from_string(pdf_bytes, content_type="application/pdf")

        logger.info("Run saved to GCS: gs://%s/%s", GCS_BUCKET, folder)
        return folder
    except Exception as exc:
        logger.error("GCS save failed (non-fatal): %s", exc)
        return None


# ---- CV persistence in GCS ----
_CV_BLOB_PATH = "cv/master_cv.tex"


def load_cv_from_gcs() -> str | None:
    """Return CV content from GCS, or None if not found / GCS not configured."""
    bucket = _get_bucket()
    if bucket is None:
        return None
    try:
        blob = bucket.blob(_CV_BLOB_PATH)
        if not blob.exists():
            return None
        return blob.download_as_text(encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not load CV from GCS: %s", exc)
        return None


def save_cv_to_gcs(content: str) -> None:
    bucket = _get_bucket()
    if bucket is None:
        return
    try:
        blob = bucket.blob(_CV_BLOB_PATH)
        blob.upload_from_string(content, content_type="text/plain")
        logger.info("CV saved to GCS: gs://%s/%s", GCS_BUCKET, _CV_BLOB_PATH)
    except Exception as exc:
        logger.warning("Could not save CV to GCS: %s", exc)
