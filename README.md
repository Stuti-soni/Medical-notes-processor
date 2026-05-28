# Medical Notes Processor

An async medical note processing system — upload prescriptions/notes, extract structured tasks via AI, track processing in real time.

## Quick Start

1. Clone the repo
2. Copy env: `cp .env.example .env`
3. Add your Gemini API key to `.env`
4. Run: `docker compose up --build`
5. Open: http://localhost:3080

## Services

| Service  | URL |
|---|---|
| Frontend | http://localhost:3080 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Flower (Celery Dashboard) | http://localhost:5555 |

> Start Flower with: `docker compose --profile monitoring up`

## Architecture

```
routes → services → repositories → database
```

- **FastAPI** backend with JWT authentication
- **Celery** workers for async processing (Redis broker)
- **PostgreSQL** for persistence via SQLAlchemy + Alembic
- **Gemini API** for AI-powered task extraction
- **Next.js** frontend with polling + WebSocket live updates

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /auth/register | Register user |
| POST | /auth/login | Login |
| POST | /upload | Upload medical note |
| GET | /uploads | List user uploads |
| GET | /status/{id} | Get processing status |
| GET | /results/{id} | Get extracted tasks |
| GET | /timeline/{id} | Get processing events |
| WS | /ws/{id} | Live status updates |

## Processing Flow

1. User uploads PDF or TXT file
2. File saved, Celery job queued (status: PENDING)
3. Worker picks up job, parses file (status: PROCESSING)
4. Gemini API extracts structured tasks
5. Tasks validated with Pydantic, saved to DB (status: COMPLETED)
6. Frontend shows results: lab tests, radiology, follow-ups

## Retry Logic

Failed jobs retry up to 3 times with exponential backoff (60s → 120s → 240s). All status transitions are logged to the `processing_events` table and shown in the Timeline tab.

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

## SOLID Principles Applied

- **S** — Each layer has one responsibility (routes, services, repositories, utils are all separate)
- **O** — `BaseExtractor` ABC allows adding new AI providers without changing existing code
- **L** — `GeminiExtractor` is a drop-in replacement for any `BaseExtractor`
- **I** — Repositories expose only what their consumers need
- **D** — Routes depend on services via FastAPI `Depends()`, not concrete implementations
