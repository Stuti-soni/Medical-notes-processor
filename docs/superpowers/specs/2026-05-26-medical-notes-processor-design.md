# Medical Notes Processor — Design Spec
Date: 2026-05-26

## Overview

An async medical note processing system that accepts uploaded prescriptions/notes (PDF or plain text), processes them via background Celery workers, extracts structured medical tasks using the Gemini API, and exposes a full-stack interface for upload, status tracking, and results viewing.

Single monorepo. Single `docker compose up`. Interview-friendly architecture.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI |
| Background Workers | Celery + Redis broker |
| Database | PostgreSQL 16 + SQLAlchemy + Alembic |
| AI Extraction | Gemini API (gemini-1.5-flash) |
| File Parsing | pdfplumber (PDF), built-in (txt) |
| Auth | JWT + bcrypt |
| Frontend | Next.js (App Router) + Tailwind CSS + shadcn/ui |
| Infra | Docker Compose |
| Worker Dashboard | Flower (opt-in via profile) |

---

## Repository Structure

```
medical-notes-processor/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/          # auth.py, uploads.py, status.py, results.py, ws.py
│   │   │   └── dependencies/    # auth_guard.py, db.py
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic Settings, reads .env
│   │   │   ├── security.py      # JWT encode/decode, bcrypt
│   │   │   └── celery_app.py    # Celery instance
│   │   ├── db/
│   │   │   ├── session.py       # SQLAlchemy engine + SessionLocal
│   │   │   └── base.py          # Base model import aggregator
│   │   ├── models/              # users.py, uploads.py, tasks.py, events.py
│   │   ├── schemas/             # Pydantic I/O schemas per domain
│   │   ├── repositories/        # One file per model, pure DB access
│   │   ├── services/            # auth_service.py, upload_service.py
│   │   ├── workers/
│   │   │   └── process_note.py  # Celery task with retry logic
│   │   ├── utils/
│   │   │   ├── file_parser.py   # PDF/text extraction
│   │   │   └── ai_extractor.py  # Gemini API call + Pydantic validation
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (auth)/register/
│   │   ├── dashboard/
│   │   ├── upload/
│   │   └── results/[id]/
│   ├── components/
│   ├── lib/                     # api.ts, auth helpers
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| email | VARCHAR UNIQUE | |
| hashed_password | VARCHAR | bcrypt |
| created_at | TIMESTAMP | |

### uploads
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| file_name | VARCHAR | original filename |
| file_path | VARCHAR | relative path under /uploads/ volume |
| file_hash | VARCHAR | MD5, stored for audit only, not enforced |
| status | ENUM | PENDING, PROCESSING, COMPLETED, FAILED, RETRYING |
| retry_count | INT | default 0 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### extracted_tasks
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| upload_id | UUID FK → uploads | |
| task_type | ENUM | LAB_TEST, RADIOLOGY, FOLLOW_UP |
| task_name | VARCHAR | |
| confidence_score | FLOAT | 0.0–1.0, from Gemini |
| created_at | TIMESTAMP | |

### processing_events
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| upload_id | UUID FK → uploads | |
| event_type | VARCHAR | QUEUED, STARTED, COMPLETED, RETRYING, FAILED |
| message | TEXT | human-readable detail |
| created_at | TIMESTAMP | |

---

## Processing Flow

```
POST /upload
 ├── validate file type (pdf/txt only)
 ├── save file to /uploads/ volume (UUID filename)
 ├── compute MD5 hash (audit)
 ├── insert uploads row (status=PENDING)
 ├── insert processing_event (QUEUED)
 └── enqueue Celery task → return { upload_id, status }

Celery Worker: process_note
 ├── status → PROCESSING + event STARTED
 ├── parse file (pdfplumber for PDF, plain read for txt)
 ├── call Gemini API with extracted text
 ├── validate Gemini response with Pydantic
 ├── insert extracted_tasks rows
 ├── status → COMPLETED + event COMPLETED
 │
 └── on exception:
     ├── if retries remaining → status RETRYING + event RETRYING
     ├── exponential backoff: 60s, 120s, 240s (max 3 retries)
     └── after max retries → status FAILED + event FAILED

Frontend
 ├── polls GET /status/{id} every 4s while PENDING or PROCESSING
 ├── on COMPLETED → fetches GET /results/{id}
 └── (bonus) WebSocket /ws/{id} upgrades polling to push
```

---

## API Endpoints

### Auth
```
POST /auth/register   body: { name, email, password }   → { access_token }
POST /auth/login      body: { email, password }          → { access_token }
```

### Uploads (JWT required)
```
POST /upload          multipart/form-data: file          → { upload_id, status }
GET  /uploads                                            → [{ upload_id, file_name, status, created_at }]
```

### Status & Results (JWT required)
```
GET /status/{id}      → { upload_id, status, retry_count, updated_at }
GET /results/{id}     → { upload_id, tasks: [{ task_type, task_name, confidence_score }] }
GET /timeline/{id}    → { upload_id, events: [{ event_type, message, created_at }] }
```

### Bonus
```
WS /ws/{id}           → pushes { status, message } on each state change
```

---

## Gemini Extraction Contract

Prompt instructs Gemini to return strict JSON only:

```json
{
  "tasks": [
    { "task_type": "LAB_TEST",  "task_name": "Complete Blood Count", "confidence_score": 0.95 },
    { "task_type": "RADIOLOGY", "task_name": "Chest X-Ray",          "confidence_score": 0.88 },
    { "task_type": "FOLLOW_UP", "task_name": "Cardiology in 2 weeks","confidence_score": 0.91 }
  ]
}
```

Pydantic model validates this before any DB write. If validation fails → worker raises exception → retry.

---

## Frontend Pages

### `/login` and `/register`
Standard auth forms. JWT stored in `httpOnly` cookie via Next.js API route.

### `/dashboard`
Table of all user uploads: filename, status badge, uploaded-at, link to results.
Auto-refreshes every 4s if any row is PENDING or PROCESSING.
"Upload New" CTA button.

### `/upload`
Drag-and-drop or file picker (pdf/txt only). Upload progress bar. On success → redirect to `/results/[id]`.

### `/results/[id]`
Three tabs:
- **Summary** — count cards per task type
- **Tasks** — table with task name + type + confidence badge
- **Timeline** — vertical event log showing the processing history

Polls `/status/[id]` every 4s while processing. Shows skeletons while loading.
Bonus: upgrades to WebSocket once connected.

---

## Infrastructure

### docker-compose.yml services

| Service | Image | Port | Notes |
|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | volume: postgres_data |
| redis | redis:7-alpine | 6379 | |
| backend | ./backend | 8000 | runs alembic upgrade head on start |
| worker | ./backend | — | same image, different CMD |
| flower | mher/flower | 5555 | opt-in: `--profile monitoring` |
| frontend | ./frontend | 3000 | |

### Volumes
- `postgres_data` — DB persistence
- `uploads_data` — shared between backend (write) and worker (read)

### Environment Variables (.env.example)
```
DATABASE_URL=postgresql://user:pass@postgres:5432/medical_db
REDIS_URL=redis://redis:6379/0
GEMINI_API_KEY=your_key_here
JWT_SECRET=your_secret_here
JWT_EXPIRE_MINUTES=60
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Architecture Principles

- **routes → services → repositories → database** — no business logic in routes
- **Worker orchestrates, services execute** — Celery task calls service methods, not raw DB
- **AI extractor is isolated** — `utils/ai_extractor.py` is independently testable
- **Repositories are pure DB access** — no business logic, no Gemini calls
- **Pydantic everywhere** — all inputs validated at boundary, all AI outputs validated before insert
- **Migrations via Alembic** — no `Base.metadata.create_all()` in production code
- **Same Docker image for backend + worker** — DRY, one Dockerfile to maintain

---

## Bonus Features (optional, additive)

| Feature | Mechanism |
|---|---|
| WebSocket live updates | Worker publishes to Redis channel; FastAPI WS reads and pushes |
| Flower dashboard | `docker compose --profile monitoring up` |
| OCR support | pytesseract/pdf2image for image-based PDFs |
| Unit tests | pytest for services + utils; mock Gemini client |
