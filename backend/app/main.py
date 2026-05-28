from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, uploads, status, results, ws

app = FastAPI(title="Medical Notes Processor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(status.router)
app.include_router(results.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
