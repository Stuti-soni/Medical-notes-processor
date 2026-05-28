from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.db import get_db
from app.api.dependencies.auth_guard import get_current_user
from app.models.user import User
from app.repositories import upload_repo, event_repo
from app.schemas.status import StatusResponse, TimelineResponse, TimelineEvent

router = APIRouter(tags=["status"])


def _get_owned_upload(db: Session, upload_id: str, user_id: str):
    upload = upload_repo.get_by_id(db, upload_id)
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if upload.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return upload


@router.get("/status/{upload_id}", response_model=StatusResponse)
def get_status(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = _get_owned_upload(db, upload_id, current_user.id)
    return StatusResponse(
        upload_id=upload.id,
        status=upload.status,
        retry_count=upload.retry_count,
        updated_at=upload.updated_at,
    )


@router.get("/timeline/{upload_id}", response_model=TimelineResponse)
def get_timeline(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = _get_owned_upload(db, upload_id, current_user.id)
    events = event_repo.get_by_upload(db, upload_id)
    return TimelineResponse(
        upload_id=upload.id,
        events=[TimelineEvent(event_type=e.event_type, message=e.message, created_at=e.created_at) for e in events],
    )
