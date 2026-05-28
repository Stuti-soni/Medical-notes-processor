import enum


class UploadStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


class TaskType(str, enum.Enum):
    LAB_TEST = "LAB_TEST"
    RADIOLOGY = "RADIOLOGY"
    FOLLOW_UP = "FOLLOW_UP"
