import hashlib
import os
import uuid

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import upload_repo, event_repo
from app.workers.process_note import process_note

UPLOADS_DIR = "uploads"
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


def handle_upload(db: Session, file: UploadFile, user_id: str) -> dict:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: .txt, .pdf"
        )

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOADS_DIR, unique_filename)

    content = file.file.read()
    file_hash = hashlib.md5(content).hexdigest()

    with open(file_path, "wb") as f:
        f.write(content)

    upload = upload_repo.create(
        db,
        user_id=user_id,
        file_name=file.filename or unique_filename,
        file_path=file_path,
        file_hash=file_hash,
    )
    event_repo.create(db, upload.id, "QUEUED", "Upload received, queued for processing")

    process_note.delay(upload.id)

    return {"upload_id": upload.id, "status": upload.status}
