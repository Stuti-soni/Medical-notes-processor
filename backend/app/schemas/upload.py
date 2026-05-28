from datetime import datetime
from pydantic import BaseModel
from app.models.enums import UploadStatus


class UploadResponse(BaseModel):
    upload_id: str
    status: UploadStatus


class UploadListItem(BaseModel):
    upload_id: str
    file_name: str
    status: UploadStatus
    created_at: datetime

    class Config:
        from_attributes = True
