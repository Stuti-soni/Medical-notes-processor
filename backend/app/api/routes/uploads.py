from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.api.dependencies.db import get_db
from app.api.dependencies.auth_guard import get_current_user
from app.models.user import User
from app.repositories import upload_repo
from app.schemas.upload import UploadResponse, UploadListItem
from app.services import upload_service

router = APIRouter(tags=["uploads"])


@router.post("/upload", response_model=UploadResponse, status_code=202)
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return upload_service.handle_upload(db, file=file, user_id=current_user.id)


@router.get("/uploads", response_model=list[UploadListItem])
def list_uploads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uploads = upload_repo.get_by_user(db, current_user.id)
    return [
        UploadListItem(
            upload_id=u.id,
            file_name=u.file_name,
            status=u.status,
            created_at=u.created_at,
        )
        for u in uploads
    ]
