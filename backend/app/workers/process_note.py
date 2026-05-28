import logging
from celery import Task
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal
import app.models  # noqa: F401 — registers all ORM models with SQLAlchemy metadata
from app.models.enums import UploadStatus
from app.repositories import upload_repo, task_repo, event_repo
from app.utils.file_parser import extract_text
from app.utils.ai_extractor import GeminiExtractor

logger = logging.getLogger(__name__)


def _publish_status(upload_id: str, status_name: str, message: str = "") -> None:
    import redis as redis_sync
    r = redis_sync.from_url(settings.redis_url)
    r.publish(f"upload:{upload_id}", f'{{"status":"{status_name}","message":"{message}"}}')
    r.close()


def _get_db() -> Session:
    return SessionLocal()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def process_note(self: Task, upload_id: str) -> dict:
    db = _get_db()
    try:
        upload = upload_repo.get_by_id(db, upload_id)
        if not upload:
            raise ValueError(f"Upload {upload_id} not found")

        upload_repo.update_status(db, upload_id, UploadStatus.PROCESSING)
        _publish_status(upload_id, "PROCESSING", "Worker started")
        event_repo.create(db, upload_id, "STARTED", "Worker picked up the job")

        text = extract_text(upload.file_path)
        logger.info("Extracted text from %s (%d chars)", upload.file_name, len(text))

        extractor = GeminiExtractor(api_key=settings.groq_api_key)
        result = extractor.extract(text)

        task_repo.bulk_create(db, upload_id, [t.model_dump() for t in result.tasks])
        upload_repo.update_status(db, upload_id, UploadStatus.COMPLETED)
        _publish_status(upload_id, "COMPLETED", f"Extracted {len(result.tasks)} tasks")
        event_repo.create(db, upload_id, "COMPLETED", f"Extracted {len(result.tasks)} tasks")

        logger.info("Completed processing upload %s", upload_id)
        return {"upload_id": upload_id, "task_count": len(result.tasks)}

    except Exception as exc:
        retry_number = self.request.retries
        max_retries = self.max_retries

        if retry_number < max_retries:
            upload_repo.update_status(db, upload_id, UploadStatus.RETRYING, increment_retry=True)
            _publish_status(upload_id, "RETRYING", f"Attempt {retry_number + 1} failed")
            event_repo.create(
                db, upload_id, "RETRYING",
                f"Attempt {retry_number + 1} failed: {str(exc)}. Retrying..."
            )
            logger.warning("Retry %d/%d for upload %s: %s", retry_number + 1, max_retries, upload_id, exc)
            raise self.retry(exc=exc, countdown=60 * (2 ** retry_number))
        else:
            upload_repo.update_status(db, upload_id, UploadStatus.FAILED)
            _publish_status(upload_id, "FAILED", "All retries exhausted")
            event_repo.create(db, upload_id, "FAILED", f"All retries exhausted: {str(exc)}")
            logger.error("Permanently failed upload %s: %s", upload_id, exc)
            return {"upload_id": upload_id, "error": str(exc)}
    finally:
        db.close()
