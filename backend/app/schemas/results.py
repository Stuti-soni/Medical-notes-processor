from pydantic import BaseModel
from app.models.enums import TaskType


class ExtractedTaskOut(BaseModel):
    task_type: TaskType
    task_name: str
    confidence_score: float

    class Config:
        from_attributes = True


class ResultsResponse(BaseModel):
    upload_id: str
    tasks: list[ExtractedTaskOut]
