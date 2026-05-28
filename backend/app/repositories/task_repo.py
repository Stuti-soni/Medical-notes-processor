from sqlalchemy.orm import Session
from app.models.extracted_task import ExtractedTask
from app.models.enums import TaskType


def bulk_create(db: Session, upload_id: str, tasks: list[dict]) -> list[ExtractedTask]:
    records = [
        ExtractedTask(
            upload_id=upload_id,
            task_type=TaskType(t["task_type"]),
            task_name=t["task_name"],
            confidence_score=t["confidence_score"],
        )
        for t in tasks
    ]
    db.add_all(records)
    db.commit()
    return records


def get_by_upload(db: Session, upload_id: str) -> list[ExtractedTask]:
    return db.query(ExtractedTask).filter(ExtractedTask.upload_id == upload_id).all()
