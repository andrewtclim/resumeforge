import pathlib
import logging

logger = logging.getLogger(__name__)

CV_PATH = pathlib.Path(__file__).parent.parent / "cv" / "master_cv.tex"


def get_master_cv() -> str:
    """
    Return CV content. GCS takes priority over the local file so edits
    made through the UI persist across Cloud Run restarts.
    Falls back to the local file for local dev without GCS configured.
    """
    from backend.services.gcs_service import load_cv_from_gcs
    gcs_content = load_cv_from_gcs()
    if gcs_content is not None:
        return gcs_content.strip()

    if not CV_PATH.exists():
        logger.warning("master_cv.tex not found at %s — CV context will be empty", CV_PATH)
        return ""
    content = CV_PATH.read_text(encoding="utf-8").strip()
    if not content or content.startswith("%"):
        logger.warning("master_cv.tex appears to be a placeholder — add your CV content")
    return content


def save_master_cv(content: str) -> None:
    """Write to both the local file and GCS (if configured)."""
    CV_PATH.parent.mkdir(parents=True, exist_ok=True)
    CV_PATH.write_text(content, encoding="utf-8")

    from backend.services.gcs_service import save_cv_to_gcs
    save_cv_to_gcs(content)

    logger.info("master_cv.tex updated (%d chars)", len(content))
