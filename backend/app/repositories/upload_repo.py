from datetime import datetime
from sqlalchemy.orm import Session
from app.models.upload import Upload
from app.models.enums import UploadStatus


def create(db: Session, user_id: str, file_name: str, file_path: str, file_hash: str) -> Upload:
    upload = Upload(user_id=user_id, file_name=file_name, file_path=file_path, file_hash=file_hash)
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def get_by_id(db: Session, upload_id: str) -> Upload | None:
    return db.query(Upload).filter(Upload.id == upload_id).first()


def get_by_user(db: Session, user_id: str) -> list[Upload]:
    return db.query(Upload).filter(Upload.user_id == user_id).order_by(Upload.created_at.desc()).all()


def update_status(db: Session, upload_id: str, status: UploadStatus, increment_retry: bool = False) -> Upload | None:
    upload = get_by_id(db, upload_id)
    if not upload:
        return None
    upload.status = status
    upload.updated_at = datetime.utcnow()
    if increment_retry:
        upload.retry_count += 1
    db.commit()
    db.refresh(upload)
    return upload
