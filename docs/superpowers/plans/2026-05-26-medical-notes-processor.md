# Medical Notes Processor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack async medical note processing system that accepts PDF/text uploads, extracts structured tasks via Gemini AI using Celery background workers, and exposes a Next.js dashboard for upload, status tracking, and results.

**Architecture:** Monorepo with `backend/` (FastAPI + Celery) and `frontend/` (Next.js) orchestrated by a single `docker-compose.yml`. Clean layered architecture: routes → services → repositories → database. Worker orchestrates, services execute, repositories are pure DB access.

**Tech Stack:** FastAPI, Celery, Redis, PostgreSQL, SQLAlchemy, Alembic, Gemini API, pdfplumber, JWT/bcrypt, Next.js App Router, Tailwind CSS, shadcn/ui, Docker Compose.

---

## File Map

### Backend
```
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py           # POST /auth/register, POST /auth/login
│   │   │   ├── uploads.py        # POST /upload, GET /uploads
│   │   │   ├── status.py         # GET /status/{id}, GET /timeline/{id}
│   │   │   ├── results.py        # GET /results/{id}
│   │   │   └── ws.py             # WS /ws/{id} (bonus)
│   │   └── dependencies/
│   │       ├── auth_guard.py     # get_current_user dependency
│   │       └── db.py             # get_db dependency
│   ├── core/
│   │   ├── config.py             # Pydantic Settings from .env
│   │   ├── security.py           # JWT encode/decode, bcrypt hash/verify
│   │   └── celery_app.py         # Celery instance with Redis broker
│   ├── db/
│   │   ├── session.py            # SQLAlchemy engine + SessionLocal
│   │   └── base.py               # imports all models for Alembic discovery
│   ├── models/
│   │   ├── enums.py              # UploadStatus, TaskType enums
│   │   ├── user.py               # User SQLAlchemy model
│   │   ├── upload.py             # Upload SQLAlchemy model
│   │   ├── extracted_task.py     # ExtractedTask SQLAlchemy model
│   │   └── processing_event.py   # ProcessingEvent SQLAlchemy model
│   ├── schemas/
│   │   ├── auth.py               # RegisterRequest, LoginRequest, TokenResponse
│   │   ├── upload.py             # UploadResponse, UploadListItem
│   │   ├── status.py             # StatusResponse, TimelineResponse
│   │   ├── results.py            # ResultsResponse, ExtractedTaskOut
│   │   └── ai.py                 # AIExtractionResult (Gemini output validation)
│   ├── repositories/
│   │   ├── user_repo.py          # get_by_email, create
│   │   ├── upload_repo.py        # create, get_by_id, get_by_user, update_status
│   │   ├── task_repo.py          # bulk_create, get_by_upload
│   │   └── event_repo.py         # create, get_by_upload
│   ├── services/
│   │   ├── auth_service.py       # register, login, token creation
│   │   └── upload_service.py     # handle_upload (save file, hash, enqueue)
│   ├── workers/
│   │   └── process_note.py       # Celery task with retry logic
│   ├── utils/
│   │   ├── file_parser.py        # extract_text(file_path) → str
│   │   └── ai_extractor.py       # BaseExtractor + GeminiExtractor
│   └── main.py                   # FastAPI app, router registration, CORS
├── alembic/
│   ├── env.py
│   └── versions/
├── alembic.ini
├── requirements.txt
└── Dockerfile
```

### Frontend
```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts    # sets httpOnly cookie
│   │       └── logout/route.ts   # clears cookie
│   ├── dashboard/page.tsx
│   ├── upload/page.tsx
│   ├── results/[id]/page.tsx
│   └── layout.tsx
├── components/
│   ├── upload-form.tsx
│   ├── status-badge.tsx
│   ├── results-tabs.tsx
│   ├── timeline.tsx
│   └── uploads-table.tsx
├── lib/
│   ├── api.ts                    # typed fetch wrapper, attaches token
│   └── auth.ts                   # getToken, isAuthenticated helpers
├── package.json
├── tailwind.config.ts
└── Dockerfile
```

### Root
```
docker-compose.yml
.env.example
README.md
```

---

## Phase 1: Project Scaffold & Infrastructure

### Task 1: Monorepo scaffold + environment config

**Files:**
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `backend/requirements.txt`

- [ ] **Step 1: Create root directory structure**

```bash
mkdir -p medical-notes-processor/backend/app
mkdir -p medical-notes-processor/frontend
cd medical-notes-processor
```

- [ ] **Step 2: Create `.env.example`**

```bash
# .env.example
DATABASE_URL=postgresql://meduser:medpass@postgres:5432/medical_db
REDIS_URL=redis://redis:6379/0
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRE_MINUTES=60
NEXT_PUBLIC_API_URL=http://localhost:8000
POSTGRES_USER=meduser
POSTGRES_PASSWORD=medpass
POSTGRES_DB=medical_db
```

Copy to `.env`: `cp .env.example .env`

- [ ] **Step 3: Create `backend/requirements.txt`**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
pydantic==2.7.1
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
celery==5.4.0
redis==5.0.4
google-generativeai==0.5.4
pdfplumber==0.11.0
python-dotenv==1.0.1
httpx==0.27.0
```

- [ ] **Step 4: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 5: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

CMD ["npm", "start"]
```

- [ ] **Step 6: Create `docker-compose.yml`**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build: ./backend
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    volumes:
      - ./backend:/app
      - uploads_data:/app/uploads
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build: ./backend
    command: celery -A app.core.celery_app worker --loglevel=info
    volumes:
      - ./backend:/app
      - uploads_data:/app/uploads
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  flower:
    image: mher/flower:2.0
    command: celery flower --broker=${REDIS_URL} --port=5555
    ports:
      - "5555:5555"
    env_file: .env
    depends_on:
      - redis
    profiles:
      - monitoring

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - backend

volumes:
  postgres_data:
  uploads_data:
```

- [ ] **Step 7: Verify structure**

```bash
ls -la
# should show: backend/ frontend/ docker-compose.yml .env.example .env
```

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: initial monorepo scaffold with docker-compose"
```

---

## Phase 2: Backend Core

### Task 2: FastAPI app initialization + config

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`

- [ ] **Step 1: Create `backend/app/core/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    redis_url: str
    gemini_api_key: str
    jwt_secret: str
    jwt_expire_minutes: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 2: Create `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Medical Notes Processor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Create all `__init__.py` files**

```bash
touch backend/app/__init__.py
touch backend/app/core/__init__.py
touch backend/app/api/__init__.py
touch backend/app/api/routes/__init__.py
touch backend/app/api/dependencies/__init__.py
touch backend/app/db/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/repositories/__init__.py
touch backend/app/services/__init__.py
touch backend/app/workers/__init__.py
touch backend/app/utils/__init__.py
mkdir -p backend/app/api/routes backend/app/api/dependencies backend/app/db \
  backend/app/models backend/app/schemas backend/app/repositories \
  backend/app/services backend/app/workers backend/app/utils
```

- [ ] **Step 4: Test the app starts**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# visit http://localhost:8000/health → {"status":"ok"}
# visit http://localhost:8000/docs → Swagger UI
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: fastapi app initialization with config"
```

---

### Task 3: Database setup + enums + models

**Files:**
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/models/enums.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/upload.py`
- Create: `backend/app/models/extracted_task.py`
- Create: `backend/app/models/processing_event.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`

- [ ] **Step 1: Create `backend/app/db/session.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Create `backend/app/models/enums.py`**

```python
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
```

- [ ] **Step 3: Create `backend/app/models/user.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 4: Create `backend/app/models/upload.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base
from app.models.enums import UploadStatus


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    file_hash: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[UploadStatus] = mapped_column(SQLEnum(UploadStatus), default=UploadStatus.PENDING)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 5: Create `backend/app/models/extracted_task.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base
from app.models.enums import TaskType


class ExtractedTask(Base):
    __tablename__ = "extracted_tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_id: Mapped[str] = mapped_column(String, ForeignKey("uploads.id"), nullable=False)
    task_type: Mapped[TaskType] = mapped_column(SQLEnum(TaskType), nullable=False)
    task_name: Mapped[str] = mapped_column(String, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 6: Create `backend/app/models/processing_event.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class ProcessingEvent(Base):
    __tablename__ = "processing_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_id: Mapped[str] = mapped_column(String, ForeignKey("uploads.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 7: Create `backend/app/db/base.py`** (import aggregator for Alembic)

```python
from app.db.session import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.upload import Upload  # noqa: F401
from app.models.extracted_task import ExtractedTask  # noqa: F401
from app.models.processing_event import ProcessingEvent  # noqa: F401
```

- [ ] **Step 8: Initialize Alembic**

```bash
cd backend
alembic init alembic
```

- [ ] **Step 9: Edit `backend/alembic/env.py`** — replace the `target_metadata` section

Find the line `target_metadata = None` and replace it with:

```python
from app.db.base import Base  # noqa: F401 — imports all models
from app.core.config import settings

target_metadata = Base.metadata

# also update the get_url function:
def get_url():
    return settings.database_url
```

Also find the `run_migrations_online` function and update the `connectable` line to use `get_url()`:
```python
connectable = create_engine(get_url())
```

- [ ] **Step 10: Generate initial migration**

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
```

Expected: new file in `alembic/versions/` with all four tables.

- [ ] **Step 11: Run migration against local Postgres (or via Docker)**

```bash
# if running locally:
alembic upgrade head
# Expected: 4 tables created in the database
```

- [ ] **Step 12: Commit**

```bash
git add backend/
git commit -m "feat: db models, enums, and initial alembic migration"
```

---

### Task 4: Security utils (JWT + bcrypt)

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/tests/test_security.py`

- [ ] **Step 1: Create `backend/tests/` directory**

```bash
mkdir -p backend/tests
touch backend/tests/__init__.py
```

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_security.py`:

```python
import pytest
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token


def test_hash_password_returns_different_string():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"


def test_verify_password_correct():
    hashed = hash_password("mysecret")
    assert verify_password("mysecret", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("mysecret")
    assert verify_password("wrongpassword", hashed) is False


def test_create_and_decode_token():
    token = create_access_token({"sub": "user-123"})
    payload = decode_access_token(token)
    assert payload["sub"] == "user-123"


def test_decode_invalid_token_returns_none():
    result = decode_access_token("not.a.valid.token")
    assert result is None
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_security.py -v
# Expected: ImportError or ModuleNotFoundError
```

- [ ] **Step 4: Create `backend/app/core/security.py`**

```python
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        return None
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_security.py -v
# Expected: 5 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: jwt and bcrypt security utils with tests"
```

---

### Task 5: Repositories

**Files:**
- Create: `backend/app/repositories/user_repo.py`
- Create: `backend/app/repositories/upload_repo.py`
- Create: `backend/app/repositories/task_repo.py`
- Create: `backend/app/repositories/event_repo.py`

- [ ] **Step 1: Create `backend/app/repositories/user_repo.py`**

```python
from sqlalchemy.orm import Session
from app.models.user import User


def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create(db: Session, name: str, email: str, hashed_password: str) -> User:
    user = User(name=name, email=email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
```

- [ ] **Step 2: Create `backend/app/repositories/upload_repo.py`**

```python
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.upload import Upload
from app.models.enums import UploadStatus


def create(db: Session, user_id: str, file_name: str, file_path: str, file_hash: str) -> Upload:
    upload = Upload(user_id=user_id, file_name=file_name, file_path=file_path, file_hash=file_hash)
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def get_by_id(db: Session, upload_id: str) -> Upload | None:
    return db.query(Upload).filter(Upload.id == upload_id).first()


def get_by_user(db: Session, user_id: str) -> list[Upload]:
    return db.query(Upload).filter(Upload.user_id == user_id).order_by(Upload.created_at.desc()).all()


def update_status(db: Session, upload_id: str, status: UploadStatus, increment_retry: bool = False) -> Upload | None:
    upload = get_by_id(db, upload_id)
    if not upload:
        return None
    upload.status = status
    upload.updated_at = datetime.utcnow()
    if increment_retry:
        upload.retry_count += 1
    db.commit()
    db.refresh(upload)
    return upload
```

- [ ] **Step 3: Create `backend/app/repositories/task_repo.py`**

```python
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
```

- [ ] **Step 4: Create `backend/app/repositories/event_repo.py`**

```python
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
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/repositories/
git commit -m "feat: repository layer for all models"
```

---

### Task 6: Auth service + dependency injection

**Files:**
- Create: `backend/app/services/auth_service.py`
- Create: `backend/app/api/dependencies/db.py`
- Create: `backend/app/api/dependencies/auth_guard.py`
- Create: `backend/tests/test_auth_service.py`

- [ ] **Step 1: Create `backend/app/api/dependencies/db.py`**

```python
from typing import Generator
from sqlalchemy.orm import Session
from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Create `backend/app/api/dependencies/auth_guard.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.dependencies.db import get_db
from app.core.security import decode_access_token
from app.repositories import user_repo
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = user_repo.get_by_email(db, payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

- [ ] **Step 3: Write failing tests**

Create `backend/tests/test_auth_service.py`:

```python
import pytest
from unittest.mock import MagicMock
from app.services.auth_service import register, login
from app.core.security import hash_password


def make_db():
    return MagicMock()


def test_register_returns_token():
    db = make_db()
    db.query.return_value.filter.return_value.first.return_value = None
    fake_user = MagicMock()
    fake_user.email = "test@example.com"
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock(side_effect=lambda u: setattr(u, "email", "test@example.com"))

    result = register(db, name="Test", email="test@example.com", password="secret123")
    assert "access_token" in result


def test_login_with_wrong_password_raises():
    from fastapi import HTTPException
    db = make_db()
    fake_user = MagicMock()
    fake_user.hashed_password = hash_password("correctpassword")
    db.query.return_value.filter.return_value.first.return_value = fake_user

    with pytest.raises(HTTPException):
        login(db, email="test@example.com", password="wrongpassword")


def test_login_with_nonexistent_user_raises():
    from fastapi import HTTPException
    db = make_db()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException):
        login(db, email="nobody@example.com", password="anything")
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_auth_service.py -v
# Expected: ImportError
```

- [ ] **Step 5: Create `backend/app/services/auth_service.py`**

```python
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.repositories import user_repo


def register(db: Session, name: str, email: str, password: str) -> dict:
    if user_repo.get_by_email(db, email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed = hash_password(password)
    user = user_repo.create(db, name=name, email=email, hashed_password=hashed)
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


def login(db: Session, email: str, password: str) -> dict:
    user = user_repo.get_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/test_auth_service.py -v
# Expected: 3 passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: auth service, db dependency, and auth guard"
```

---

## Phase 3: AI Extraction + Celery Worker

### Task 7: File parser utility

**Files:**
- Create: `backend/app/utils/file_parser.py`
- Create: `backend/tests/test_file_parser.py`
- Create: `backend/tests/fixtures/sample.txt`
- Create: `backend/tests/fixtures/sample.pdf` (manual step)

- [ ] **Step 1: Create test fixtures directory**

```bash
mkdir -p backend/tests/fixtures
echo "Patient: John Doe
Doctor: Dr. Smith
Date: 2024-01-15

Prescription:
- CBC (Complete Blood Count) required
- Chest X-Ray ordered
- Follow-up with cardiologist in 2 weeks" > backend/tests/fixtures/sample.txt
```

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_file_parser.py`:

```python
import pytest
import os
from app.utils.file_parser import extract_text

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def test_extract_text_from_txt():
    path = os.path.join(FIXTURES, "sample.txt")
    text = extract_text(path)
    assert "Complete Blood Count" in text
    assert "Chest X-Ray" in text


def test_extract_text_unsupported_format_raises():
    with pytest.raises(ValueError, match="Unsupported file type"):
        extract_text("/some/file.docx")


def test_extract_text_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        extract_text("/nonexistent/path/file.txt")
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_file_parser.py -v
# Expected: ImportError
```

- [ ] **Step 4: Create `backend/app/utils/file_parser.py`**

```python
import os
import pdfplumber


def extract_text(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    elif ext == ".pdf":
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: .txt, .pdf")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_file_parser.py -v
# Expected: 3 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: file parser utility for txt and pdf"
```

---

### Task 8: AI extractor (Gemini)

**Files:**
- Create: `backend/app/utils/ai_extractor.py`
- Create: `backend/app/schemas/ai.py`
- Create: `backend/tests/test_ai_extractor.py`

- [ ] **Step 1: Create `backend/app/schemas/ai.py`**

```python
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
```

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_ai_extractor.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from app.utils.ai_extractor import GeminiExtractor
from app.schemas.ai import AIExtractionResult


MOCK_RESPONSE = '''{
  "tasks": [
    {"task_type": "LAB_TEST", "task_name": "Complete Blood Count", "confidence_score": 0.95},
    {"task_type": "RADIOLOGY", "task_name": "Chest X-Ray", "confidence_score": 0.88},
    {"task_type": "FOLLOW_UP", "task_name": "Cardiology in 2 weeks", "confidence_score": 0.91}
  ]
}'''


def test_gemini_extractor_parses_valid_response():
    extractor = GeminiExtractor(api_key="fake-key")
    result = extractor._parse_response(MOCK_RESPONSE)
    assert isinstance(result, AIExtractionResult)
    assert len(result.tasks) == 3
    assert result.tasks[0].task_name == "Complete Blood Count"


def test_gemini_extractor_raises_on_invalid_json():
    extractor = GeminiExtractor(api_key="fake-key")
    with pytest.raises(ValueError, match="Failed to parse"):
        extractor._parse_response("not json at all")


def test_gemini_extractor_raises_on_empty_tasks():
    extractor = GeminiExtractor(api_key="fake-key")
    with pytest.raises(ValueError):
        extractor._parse_response('{"tasks": []}')
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/test_ai_extractor.py -v
# Expected: ImportError
```

- [ ] **Step 4: Create `backend/app/utils/ai_extractor.py`**

```python
import json
import re
from abc import ABC, abstractmethod

import google.generativeai as genai

from app.schemas.ai import AIExtractionResult

EXTRACTION_PROMPT = """
You are a medical assistant. Analyze the following medical note and extract all:
- Lab tests ordered
- Radiology tests ordered
- Follow-up appointments

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "tasks": [
    {"task_type": "LAB_TEST", "task_name": "<name>", "confidence_score": <0.0-1.0>},
    {"task_type": "RADIOLOGY", "task_name": "<name>", "confidence_score": <0.0-1.0>},
    {"task_type": "FOLLOW_UP", "task_name": "<name>", "confidence_score": <0.0-1.0>}
  ]
}

task_type must be exactly: LAB_TEST, RADIOLOGY, or FOLLOW_UP
confidence_score must be a float between 0.0 and 1.0

Medical note:
{text}
"""


class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, text: str) -> AIExtractionResult:
        pass

    def _parse_response(self, raw: str) -> AIExtractionResult:
        # Strip markdown code fences if present
        cleaned = re.sub(r"```(?:json)?", "", raw).strip()
        try:
            data = json.loads(cleaned)
            return AIExtractionResult(**data)
        except (json.JSONDecodeError, Exception) as e:
            raise ValueError(f"Failed to parse AI response: {e}\nRaw: {raw[:200]}")


class GeminiExtractor(BaseExtractor):
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    def extract(self, text: str) -> AIExtractionResult:
        prompt = EXTRACTION_PROMPT.format(text=text)
        response = self.model.generate_content(prompt)
        return self._parse_response(response.text)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_ai_extractor.py -v
# Expected: 3 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: gemini ai extractor with pydantic validation"
```

---

### Task 9: Celery app + process_note worker

**Files:**
- Create: `backend/app/core/celery_app.py`
- Create: `backend/app/workers/process_note.py`

- [ ] **Step 1: Create `backend/app/core/celery_app.py`**

```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "medical_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
```

- [ ] **Step 2: Create `backend/app/workers/process_note.py`**

```python
import logging
from celery import Task
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.enums import UploadStatus
from app.repositories import upload_repo, task_repo, event_repo
from app.utils.file_parser import extract_text
from app.utils.ai_extractor import GeminiExtractor

logger = logging.getLogger(__name__)


def _get_db() -> Session:
    return SessionLocal()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def process_note(self: Task, upload_id: str) -> dict:
    db = _get_db()
    try:
        upload = upload_repo.get_by_id(db, upload_id)
        if not upload:
            raise ValueError(f"Upload {upload_id} not found")

        upload_repo.update_status(db, upload_id, UploadStatus.PROCESSING)
        event_repo.create(db, upload_id, "STARTED", "Worker picked up the job")

        text = extract_text(upload.file_path)
        logger.info("Extracted text from %s (%d chars)", upload.file_name, len(text))

        extractor = GeminiExtractor(api_key=settings.gemini_api_key)
        result = extractor.extract(text)

        task_repo.bulk_create(db, upload_id, [t.model_dump() for t in result.tasks])
        upload_repo.update_status(db, upload_id, UploadStatus.COMPLETED)
        event_repo.create(db, upload_id, "COMPLETED", f"Extracted {len(result.tasks)} tasks")

        logger.info("Completed processing upload %s", upload_id)
        return {"upload_id": upload_id, "task_count": len(result.tasks)}

    except Exception as exc:
        retry_number = self.request.retries
        max_retries = self.max_retries

        if retry_number < max_retries:
            upload_repo.update_status(db, upload_id, UploadStatus.RETRYING, increment_retry=True)
            event_repo.create(
                db, upload_id, "RETRYING",
                f"Attempt {retry_number + 1} failed: {str(exc)}. Retrying..."
            )
            logger.warning("Retry %d/%d for upload %s: %s", retry_number + 1, max_retries, upload_id, exc)
            raise self.retry(exc=exc, countdown=60 * (2 ** retry_number))
        else:
            upload_repo.update_status(db, upload_id, UploadStatus.FAILED)
            event_repo.create(db, upload_id, "FAILED", f"All retries exhausted: {str(exc)}")
            logger.error("Permanently failed upload %s: %s", upload_id, exc)
            return {"upload_id": upload_id, "error": str(exc)}
    finally:
        db.close()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/celery_app.py backend/app/workers/
git commit -m "feat: celery app and process_note worker with retry logic"
```

---

## Phase 4: API Routes

### Task 10: Schemas

**Files:**
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/upload.py`
- Create: `backend/app/schemas/status.py`
- Create: `backend/app/schemas/results.py`

- [ ] **Step 1: Create `backend/app/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

- [ ] **Step 2: Create `backend/app/schemas/upload.py`**

```python
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
```

- [ ] **Step 3: Create `backend/app/schemas/status.py`**

```python
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
```

- [ ] **Step 4: Create `backend/app/schemas/results.py`**

```python
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
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: pydantic schemas for all api endpoints"
```

---

### Task 11: Auth routes

**Files:**
- Create: `backend/app/api/routes/auth.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/api/routes/auth.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies.db import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    return auth_service.register(db, name=body.name, email=body.email, password=body.password)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login(db, email=body.email, password=body.password)
```

- [ ] **Step 2: Update `backend/app/main.py`** to register the router

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth

app = FastAPI(title="Medical Notes Processor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Test manually**

```bash
uvicorn app.main:app --reload
# POST http://localhost:8000/auth/register
# body: {"name":"Test","email":"test@example.com","password":"secret123"}
# Expected: {"access_token": "...", "token_type": "bearer"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: auth routes register and login"
```

---

### Task 12: Upload service + route

**Files:**
- Create: `backend/app/services/upload_service.py`
- Create: `backend/app/api/routes/uploads.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/services/upload_service.py`**

```python
import hashlib
import os
import uuid

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import upload_repo, event_repo
from app.workers.process_note import process_note

UPLOADS_DIR = "uploads"
ALLOWED_EXTENSIONS = {".txt", ".pdf"}


def handle_upload(db: Session, file: UploadFile, user_id: str) -> dict:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: .txt, .pdf"
        )

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOADS_DIR, unique_filename)

    content = file.file.read()
    file_hash = hashlib.md5(content).hexdigest()

    with open(file_path, "wb") as f:
        f.write(content)

    upload = upload_repo.create(
        db,
        user_id=user_id,
        file_name=file.filename or unique_filename,
        file_path=file_path,
        file_hash=file_hash,
    )
    event_repo.create(db, upload.id, "QUEUED", "Upload received, queued for processing")

    process_note.delay(upload.id)

    return {"upload_id": upload.id, "status": upload.status}
```

- [ ] **Step 2: Create `backend/app/api/routes/uploads.py`**

```python
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
```

- [ ] **Step 3: Update `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, uploads, status, results

app = FastAPI(title="Medical Notes Processor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(status.router)
app.include_router(results.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: upload service and route with file validation"
```

---

### Task 13: Status, timeline, and results routes

**Files:**
- Create: `backend/app/api/routes/status.py`
- Create: `backend/app/api/routes/results.py`

- [ ] **Step 1: Create `backend/app/api/routes/status.py`**

```python
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
```

- [ ] **Step 2: Create `backend/app/api/routes/results.py`**

```python
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
```

- [ ] **Step 3: Smoke test all routes via Swagger**

```bash
uvicorn app.main:app --reload
# visit http://localhost:8000/docs
# verify: /auth/register, /auth/login, /upload, /uploads, /status/{id}, /timeline/{id}, /results/{id} all appear
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/routes/
git commit -m "feat: status, timeline, and results routes"
```

---

## Phase 5: Frontend

### Task 14: Next.js project setup + API client

**Files:**
- Create: `frontend/` (bootstrapped)
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/auth.ts`

- [ ] **Step 1: Bootstrap Next.js project**

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

- [ ] **Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init
# Choose: Default style, Zinc color, yes CSS variables
npx shadcn@latest add button input label card badge table tabs progress skeleton
```

- [ ] **Step 3: Create `frontend/lib/api.ts`**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  register: (name: string, email: string, password: string) =>
    apiFetch<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<{ upload_id: string; status: string }>("/upload", {
      method: "POST",
      body: form,
    });
  },

  listUploads: () =>
    apiFetch<Array<{ upload_id: string; file_name: string; status: string; created_at: string }>>("/uploads"),

  getStatus: (id: string) =>
    apiFetch<{ upload_id: string; status: string; retry_count: number; updated_at: string }>(`/status/${id}`),

  getResults: (id: string) =>
    apiFetch<{ upload_id: string; tasks: Array<{ task_type: string; task_name: string; confidence_score: number }> }>(`/results/${id}`),

  getTimeline: (id: string) =>
    apiFetch<{ upload_id: string; events: Array<{ event_type: string; message: string; created_at: string }> }>(`/timeline/${id}`),
};
```

- [ ] **Step 4: Create `frontend/lib/auth.ts`**

```typescript
export function setToken(token: string) {
  document.cookie = `access_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60}; SameSite=Lax`;
}

export function clearToken() {
  document.cookie = "access_token=; path=/; max-age=0";
}

export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("access_token=");
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: next.js setup with api client and auth helpers"
```

---

### Task 15: Login + Register pages

**Files:**
- Create: `frontend/app/(auth)/login/page.tsx`
- Create: `frontend/app/(auth)/register/page.tsx`
- Create: `frontend/app/(auth)/layout.tsx`

- [ ] **Step 1: Create `frontend/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/app/(auth)/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await api.login(email, password);
      setToken(access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <p className="text-sm text-center text-gray-500">
            No account?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `frontend/app/(auth)/register/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await api.register(name, email, password);
      setToken(access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
          <p className="text-sm text-center text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: login and register pages"
```

---

### Task 16: Dashboard page

**Files:**
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/components/uploads-table.tsx`
- Create: `frontend/components/status-badge.tsx`

- [ ] **Step 1: Create `frontend/components/status-badge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  RETRYING: "bg-orange-100 text-orange-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={STATUS_STYLES[status] ?? "bg-gray-100 text-gray-800"}>
      {status}
    </Badge>
  );
}
```

- [ ] **Step 2: Create `frontend/components/uploads-table.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

interface Upload {
  upload_id: string;
  file_name: string;
  status: string;
  created_at: string;
}

export function UploadsTable({ uploads }: { uploads: Upload[] }) {
  if (uploads.length === 0) {
    return <p className="text-gray-500 text-center py-8">No uploads yet. Upload your first medical note.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="pb-2 font-medium">File</th>
          <th className="pb-2 font-medium">Status</th>
          <th className="pb-2 font-medium">Uploaded</th>
          <th className="pb-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {uploads.map(u => (
          <tr key={u.upload_id} className="border-b last:border-0">
            <td className="py-3 max-w-xs truncate">{u.file_name}</td>
            <td className="py-3"><StatusBadge status={u.status} /></td>
            <td className="py-3 text-gray-500">{new Date(u.created_at).toLocaleString()}</td>
            <td className="py-3 text-right">
              <Link href={`/results/${u.upload_id}`}>
                <Button variant="outline" size="sm">View</Button>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Create `frontend/app/dashboard/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { UploadsTable } from "@/components/uploads-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTIVE_STATUSES = ["PENDING", "PROCESSING", "RETRYING"];

export default function DashboardPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUploads = useCallback(async () => {
    try {
      const data = await api.listUploads();
      setUploads(data);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchUploads();
  }, [fetchUploads, router]);

  useEffect(() => {
    const hasActive = uploads.some(u => ACTIVE_STATUSES.includes(u.status));
    if (!hasActive) return;
    const interval = setInterval(fetchUploads, 4000);
    return () => clearInterval(interval);
  }, [uploads, fetchUploads]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Medical Notes Dashboard</h1>
        <Link href="/upload">
          <Button>Upload New Note</Button>
        </Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Your Uploads</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-gray-400">Loading...</p> : <UploadsTable uploads={uploads} />}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: dashboard page with polling for active uploads"
```

---

### Task 17: Upload page

**Files:**
- Create: `frontend/app/upload/page.tsx`
- Create: `frontend/components/upload-form.tsx`

- [ ] **Step 1: Create `frontend/components/upload-form.tsx`**

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }

  function validateAndSet(f: File) {
    if (!f.name.match(/\.(pdf|txt)$/i)) {
      setError("Only .pdf and .txt files are supported.");
      return;
    }
    setError("");
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(30);
    try {
      setProgress(60);
      const { upload_id } = await api.uploadFile(file);
      setProgress(100);
      router.push(`/results/${upload_id}`);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        className="border-2 border-dashed cursor-pointer hover:border-blue-400 transition-colors"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
          <p className="text-lg">Drag & drop or click to select</p>
          <p className="text-sm mt-1">Supports .pdf and .txt</p>
          {file && <p className="mt-3 text-blue-600 font-medium">{file.name}</p>}
        </CardContent>
      </Card>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={e => e.target.files?.[0] && validateAndSet(e.target.files[0])}
      />
      {uploading && <Progress value={progress} />}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
        {uploading ? "Uploading..." : "Upload & Process"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/app/upload/page.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { UploadForm } from "@/components/upload-form";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold">Upload Medical Note</h1>
      </div>
      <UploadForm />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: upload page with drag-and-drop"
```

---

### Task 18: Results page

**Files:**
- Create: `frontend/app/results/[id]/page.tsx`
- Create: `frontend/components/results-tabs.tsx`
- Create: `frontend/components/timeline.tsx`

- [ ] **Step 1: Create `frontend/components/timeline.tsx`**

```tsx
interface TimelineEvent {
  event_type: string;
  message: string;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  QUEUED: "bg-gray-400",
  STARTED: "bg-blue-500",
  COMPLETED: "bg-green-500",
  RETRYING: "bg-orange-400",
  FAILED: "bg-red-500",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-6">
      {events.map((e, i) => (
        <li key={i} className="ml-6">
          <span className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full ${EVENT_COLORS[e.event_type] ?? "bg-gray-400"}`} />
          <p className="font-medium text-sm">{e.event_type}</p>
          <p className="text-gray-500 text-sm">{e.message}</p>
          <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: Create `frontend/components/results-tabs.tsx`**

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/timeline";

interface Task {
  task_type: string;
  task_name: string;
  confidence_score: number;
}

interface Event {
  event_type: string;
  message: string;
  created_at: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  LAB_TEST: "Lab Test",
  RADIOLOGY: "Radiology",
  FOLLOW_UP: "Follow-Up",
};

export function ResultsTabs({ tasks, events }: { tasks: Task[]; events: Event[] }) {
  const counts = {
    LAB_TEST: tasks.filter(t => t.task_type === "LAB_TEST").length,
    RADIOLOGY: tasks.filter(t => t.task_type === "RADIOLOGY").length,
    FOLLOW_UP: tasks.filter(t => t.task_type === "FOLLOW_UP").length,
  };

  return (
    <Tabs defaultValue="summary">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="grid grid-cols-3 gap-4 mt-4">
        {(["LAB_TEST", "RADIOLOGY", "FOLLOW_UP"] as const).map(type => (
          <Card key={type}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-gray-500">{TASK_TYPE_LABELS[type]}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{counts[type]}</p>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="tasks" className="mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Task</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-3">{t.task_name}</td>
                <td className="py-3">
                  <Badge variant="outline">{TASK_TYPE_LABELS[t.task_type] ?? t.task_type}</Badge>
                </td>
                <td className="py-3 text-gray-500">{(t.confidence_score * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="timeline" className="mt-4">
        <Timeline events={events} />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3: Create `frontend/app/results/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { ResultsTabs } from "@/components/results-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ACTIVE_STATUSES = ["PENDING", "PROCESSING", "RETRYING"];

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statusData, timelineData] = await Promise.all([
        api.getStatus(id),
        api.getTimeline(id),
      ]);
      setStatus(statusData);
      setEvents(timelineData.events);

      if (statusData.status === "COMPLETED") {
        const resultsData = await api.getResults(id);
        setTasks(resultsData.tasks);
      }
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchData();
  }, [fetchData, router]);

  useEffect(() => {
    if (!status || !ACTIVE_STATUSES.includes(status.status)) return;
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [status, fetchData]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">← Dashboard</Button>
        </Link>
        <h1 className="text-2xl font-bold">Processing Results</h1>
        {status && <StatusBadge status={status.status} />}
      </div>

      {status && ACTIVE_STATUSES.includes(status.status) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 text-sm">
          Processing your medical note... This page refreshes automatically every 4 seconds.
        </div>
      )}

      {status?.status === "FAILED" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          Processing failed after all retries. Check the timeline for details.
        </div>
      )}

      <ResultsTabs tasks={tasks} events={events} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: results page with tabs for summary, tasks, and timeline"
```

---

## Phase 6: Integration + Bonus

### Task 19: End-to-end integration test

**Files:**
- No new files — smoke test the full Docker stack

- [ ] **Step 1: Build and start all services**

```bash
docker compose up --build
```

Expected: all services start without errors. Check logs for each service.

- [ ] **Step 2: Verify backend health**

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

- [ ] **Step 3: Register a user**

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"secret123"}'
# Expected: {"access_token":"...","token_type":"bearer"}
```

- [ ] **Step 4: Upload a file using the returned token**

```bash
TOKEN="<paste access_token here>"
curl -X POST http://localhost:8000/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@backend/tests/fixtures/sample.txt"
# Expected: {"upload_id":"...","status":"PENDING"}
```

- [ ] **Step 5: Poll status until COMPLETED**

```bash
UPLOAD_ID="<paste upload_id here>"
curl http://localhost:8000/status/$UPLOAD_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"status":"PROCESSING"} then {"status":"COMPLETED"}
```

- [ ] **Step 6: Fetch results**

```bash
curl http://localhost:8000/results/$UPLOAD_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"upload_id":"...","tasks":[...]}
```

- [ ] **Step 7: Verify frontend at http://localhost:3000**

- Register a new account
- Upload `sample.txt` from the upload page
- Confirm redirect to results page
- Watch status update to COMPLETED
- Verify tasks appear in the Tasks tab
- Verify timeline events appear in the Timeline tab

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: end-to-end integration verified"
```

---

### Task 20: WebSocket bonus (optional)

**Files:**
- Create: `backend/app/api/routes/ws.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/workers/process_note.py`
- Modify: `frontend/app/results/[id]/page.tsx`

- [ ] **Step 1: Add Redis publish to worker** — in `backend/app/workers/process_note.py`, add after each status update:

```python
import redis as redis_client
from app.core.config import settings

def _publish_status(upload_id: str, status: str, message: str = ""):
    r = redis_client.from_url(settings.redis_url)
    r.publish(f"upload:{upload_id}", f'{{"status":"{status}","message":"{message}"}}')
```

Call `_publish_status(upload_id, "PROCESSING", "Worker started")` etc. after each status change.

- [ ] **Step 2: Create `backend/app/api/routes/ws.py`**

```python
import asyncio
import json
import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.config import settings

router = APIRouter()


@router.websocket("/ws/{upload_id}")
async def websocket_status(websocket: WebSocket, upload_id: str):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"upload:{upload_id}")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"].decode())
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"upload:{upload_id}")
        await r.close()
```

- [ ] **Step 3: Register WS router in `backend/app/main.py`**

```python
from app.api.routes import ws
app.include_router(ws.router)
```

- [ ] **Step 4: Add WebSocket upgrade in `frontend/app/results/[id]/page.tsx`**

Add inside the component after `fetchData()` completes on initial load:

```typescript
useEffect(() => {
  if (!status || status.status === "COMPLETED" || status.status === "FAILED") return;
  const wsUrl = `ws://localhost:8000/ws/${id}`;
  const socket = new WebSocket(wsUrl);
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setStatus((prev: any) => prev ? { ...prev, status: data.status } : prev);
    if (data.status === "COMPLETED" || data.status === "FAILED") {
      fetchData();
      socket.close();
    }
  };
  return () => socket.close();
}, [status?.status, id]);
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/ws.py backend/app/workers/ frontend/
git commit -m "feat(bonus): websocket live status updates via redis pubsub"
```

---

### Task 21: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Medical Notes Processor

Async medical note processing system — upload prescriptions, extract structured tasks via AI.

## Quick Start

1. Clone the repo
2. Copy env: `cp .env.example .env`
3. Add your Gemini API key to `.env`
4. Run: `docker compose up --build`
5. Open: http://localhost:3000

## Services

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000       |
| Backend  | http://localhost:8000       |
| API Docs | http://localhost:8000/docs  |
| Flower   | http://localhost:5555 (run with `docker compose --profile monitoring up`) |

## Architecture

routes → services → repositories → database

- FastAPI backend with Celery workers
- PostgreSQL for persistence, Redis as broker
- Gemini API for AI extraction
- Next.js frontend with polling + WebSocket (bonus)

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

---

## Self-Review Against Spec

**Spec coverage check:**
- ✅ PDF + txt file upload
- ✅ Gemini AI extraction with Pydantic validation
- ✅ Celery worker with retry + exponential backoff (60s, 120s, 240s)
- ✅ Status enum: PENDING, PROCESSING, COMPLETED, FAILED, RETRYING
- ✅ Task types: LAB_TEST, RADIOLOGY, FOLLOW_UP
- ✅ processing_events table / timeline endpoint
- ✅ JWT auth (register + login)
- ✅ All API endpoints: /auth/register, /auth/login, /upload, /uploads, /status/{id}, /results/{id}, /timeline/{id}
- ✅ Docker Compose with postgres, redis, backend, worker, flower (monitoring profile), frontend
- ✅ Shared uploads_data volume between backend + worker
- ✅ Alembic migrations run on startup
- ✅ Frontend: login, register, dashboard, upload, results pages
- ✅ Polling every 4s while active, stops when COMPLETED/FAILED
- ✅ Status badges, timeline component, results tabs
- ✅ file_hash stored as MD5 (audit only)
- ✅ SOLID principles: BaseExtractor ABC (O/L), Depends() DI (D), single-purpose repos (S/I)
- ✅ WebSocket bonus (Task 20)
- ✅ Flower bonus (docker compose profile)
- ✅ README

**No gaps found.**
