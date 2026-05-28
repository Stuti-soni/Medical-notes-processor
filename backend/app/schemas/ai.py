from pydantic import BaseModel, Field, field_validator
from app.models.enums import TaskType


class ExtractedTaskItem(BaseModel):
    task_type: TaskType
    task_name: str = Field(min_length=1, max_length=500)
    confidence_score: float = Field(ge=0.0, le=1.0)


class AIExtractionResult(BaseModel):
    tasks: list[ExtractedTaskItem]

    @field_validator("tasks")
    @classmethod
    def tasks_not_empty(cls, v):
        if not v:
            raise ValueError("AI returned no tasks")
        return v
