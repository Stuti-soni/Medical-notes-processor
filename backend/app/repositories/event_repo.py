from sqlalchemy.orm import Session
from app.models.processing_event import ProcessingEvent


def create(db: Session, upload_id: str, event_type: str, message: str = "") -> ProcessingEvent:
    event = ProcessingEvent(upload_id=upload_id, event_type=event_type, message=message)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_by_upload(db: Session, upload_id: str) -> list[ProcessingEvent]:
    return db.query(ProcessingEvent).filter(ProcessingEvent.upload_id == upload_id).order_by(ProcessingEvent.created_at.asc()).all()
