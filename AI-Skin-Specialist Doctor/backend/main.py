"""
main.py — FastAPI application entry point.
Registers all routers, middleware, rate limiting, and CORS.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

from backend.routers import analyze, chat, speak, transcribe, symptom_check

# ─── Rate limiter setup ────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ─── App ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Skin Specialist Doctor",
    description="Multimodal AI assistant for general skin health guidance.",
    version="1.1.0",
    docs_url="/docs",
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routers ───────────────────────────────────────────────────────────
app.include_router(analyze.router, tags=["Analysis"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(speak.router, tags=["TTS"])
app.include_router(transcribe.router, tags=["STT"])
app.include_router(symptom_check.router, tags=["Symptom Check"])

# ─── Health check ──────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "AI Skin Specialist Doctor"}

# ─── Serve Frontend static files ───────────────────────────────────────────
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
