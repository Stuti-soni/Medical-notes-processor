from datetime import datetime
from pydantic import BaseModel
from app.models.enums import UploadStatus


class StatusResponse(BaseModel):
    upload_id: str
    status: UploadStatus
    retry_count: int
    updated_at: datetime

    class Config:
        from_attributes = True


class TimelineEvent(BaseModel):
    event_type: str
    message: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class TimelineResponse(BaseModel):
    upload_id: str
    events: list[TimelineEvent]
