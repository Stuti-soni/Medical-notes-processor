from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.db import get_db
from app.api.dependencies.auth_guard import get_current_user
from app.models.user import User
from app.models.enums import UploadStatus
from app.repositories import upload_repo, task_repo
from app.schemas.results import ResultsResponse, ExtractedTaskOut

router = APIRouter(tags=["results"])


@router.get("/results/{upload_id}", response_model=ResultsResponse)
def get_results(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = upload_repo.get_by_id(db, upload_id)
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if upload.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if upload.status != UploadStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Processing not complete. Status: {upload.status}")

    tasks = task_repo.get_by_upload(db, upload_id)
    return ResultsResponse(
        upload_id=upload_id,
        tasks=[ExtractedTaskOut(task_type=t.task_type, task_name=t.task_name, confidence_score=t.confidence_score) for t in tasks],
    )
