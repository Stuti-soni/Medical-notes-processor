# Medical Notes Processor

An async medical note processing system — upload prescriptions, lab reports, or clinical notes as PDF, image, or plain text, extract structured tasks via AI, and track processing in real time.

## Quick Start

1. Clone the repo
2. Copy env: `cp .env.example .env`
3. Add your Groq API key to `.env` (get one free at [console.groq.com](https://console.groq.com))
4. Run: `docker compose up --build`
5. Open: [http://localhost:3080](http://localhost:3080)

## Services

| Service | URL |
|---|---|
| Frontend | http://localhost:3080 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Flower (Celery Dashboard) | http://localhost:5555 |

> Start Flower with: `docker compose --profile monitoring up --build`

## Supported File Types

| Format | Method |
|---|---|
| `.pdf` (text-based) | pdfplumber direct extraction |
| `.pdf` (scanned) | Tesseract OCR fallback |
| `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp` | Tesseract OCR |
| `.txt` | Direct read |

The system automatically detects whether a PDF is text-based or scanned. If pdfplumber extracts fewer than 50 characters, it falls back to OCR via Tesseract + pdf2image.

## Architecture

```
Frontend (Next.js)
    │
    ├── REST API ──► FastAPI backend
    │                    │
    │                    ├── PostgreSQL (SQLAlchemy + Alembic)
    │                    ├── Redis (Celery broker + pub/sub)
    │                    └── uploads/ volume (shared with worker)
    │
    └── WebSocket ──► Redis pub/sub ──► Celery worker
                                            │
                                            ├── pdfplumber / Tesseract OCR
                                            └── Groq API (llama-3.3-70b-versatile)
```

**Layered backend structure:**
```
routes → services → repositories → database
```

- **FastAPI** backend with JWT authentication
- **Celery** workers for async processing (Redis as broker and result backend)
- **PostgreSQL** for persistence via SQLAlchemy ORM + Alembic migrations
- **Groq API** (`llama-3.3-70b-versatile`) for AI-powered task extraction
- **Tesseract OCR** + pdfplumber for multi-format file parsing
- **Next.js** frontend with polling + WebSocket live updates

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login, returns JWT cookie |
| POST | `/upload` | Yes | Upload a medical note (PDF/image/TXT) |
| GET | `/uploads` | Yes | List all uploads for current user |
| GET | `/status/{id}` | Yes | Get processing status for an upload |
| GET | `/results/{id}` | Yes | Get extracted tasks for an upload |
| GET | `/timeline/{id}` | Yes | Get processing event log |
| WS | `/ws/{id}` | Token param | Live status updates via WebSocket |

## Processing Flow

```
1. User uploads file (PDF, image, or TXT)
2. File saved to disk, Celery job queued  →  status: PENDING
3. Worker picks up job, parses file       →  status: PROCESSING
   ├── .txt: direct read
   ├── .pdf: pdfplumber → OCR fallback if needed
   └── image: Tesseract OCR
4. Groq API extracts structured tasks (llama-3.3-70b-versatile)
5. Tasks validated with Pydantic, saved to DB  →  status: COMPLETED
6. Frontend shows results: lab tests, radiology orders, follow-ups
```

## Extracted Task Types

Each task extracted from a note has:
- **type**: `LAB_TEST`, `RADIOLOGY`, or `FOLLOW_UP`
- **description**: what the task is
- **priority**: `HIGH`, `MEDIUM`, or `LOW`
- **due_date**: when it should be done (if mentioned)
- **notes**: additional context

## Real-Time Updates

The frontend uses two mechanisms:
- **Polling** (every 4 seconds) while a job is in progress — fetches `/status/{id}`
- **WebSocket** (`/ws/{id}`) — pushes live status updates as the worker progresses

The worker publishes to a Redis channel (`upload:{id}`) at each stage. The FastAPI WebSocket endpoint subscribes and forwards to the browser. Once the status reaches `COMPLETED` or `FAILED`, polling stops.

## Retry Logic

Failed jobs retry up to **3 times** with exponential backoff:

| Attempt | Delay |
|---|---|
| 1st retry | 60 seconds |
| 2nd retry | 120 seconds |
| 3rd retry | 240 seconds |

All status transitions — including retries — are logged to the `processing_events` table and shown in the **Timeline** tab on the upload detail page.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GROQ_API_KEY` | Groq API key (from console.groq.com) |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRE_MINUTES` | Token expiry in minutes (default: 60) |
| `POSTGRES_USER` | Postgres username (for Docker healthcheck) |
| `POSTGRES_PASSWORD` | Postgres password |
| `POSTGRES_DB` | Postgres database name |
| `NEXT_PUBLIC_API_URL` | Backend URL visible to the browser |

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

## SOLID Principles Applied

| Principle | Where |
|---|---|
| **S** — Single Responsibility | Each layer has one job: `routes` handle HTTP, `services` orchestrate logic, `repositories` own DB access, `utils` handle parsing/AI |
| **O** — Open/Closed | `BaseExtractor` ABC lets you add new AI providers (OpenAI, Claude, etc.) without changing existing code |
| **L** — Liskov Substitution | `GeminiExtractor` (backed by Groq) is a drop-in replacement for any `BaseExtractor` |
| **I** — Interface Segregation | Repositories expose only the methods their consumers need — no god-object repos |
| **D** — Dependency Inversion | Routes depend on services via FastAPI `Depends()`, not on concrete implementations |

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/routes/         # FastAPI route handlers
│   │   ├── core/               # Config, Celery app, security
│   │   ├── db/                 # DB session, base model
│   │   ├── models/             # SQLAlchemy ORM models + enums
│   │   ├── repositories/       # DB access layer
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic
│   │   ├── utils/
│   │   │   ├── ai_extractor.py # Groq-backed extraction (BaseExtractor)
│   │   │   └── file_parser.py  # pdfplumber + Tesseract OCR
│   │   └── workers/
│   │       └── process_note.py # Celery task
│   ├── migrations/             # Alembic migrations
│   ├── tests/                  # Pytest tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # UI components (shadcn/ui + Tailwind)
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12 |
| Task Queue | Celery 5, Redis 7 |
| Database | PostgreSQL 16, SQLAlchemy 2, Alembic |
| AI | Groq API — llama-3.3-70b-versatile |
| OCR | Tesseract, pdfplumber, pdf2image, Pillow |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Monitoring | Flower (Celery dashboard) |
| Containers | Docker, Docker Compose |
