"""
speak.py — Text → Deepgram TTS → audio (doctor's voice).
"""

import logging
from fastapi import APIRouter, HTTPException, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.schemas import SpeakRequest
from backend.services.tts_service import tts_service

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/speak")
@limiter.limit("60/minute")
async def speak(request: Request, body: SpeakRequest):
    """
    Convert text to speech and return audio bytes (mp3).
    """
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    if len(text) > 1900:
        text = text[:1900]  # Deepgram Aura limit is 2000 chars

    try:
        audio_bytes = await tts_service.synthesize(text)
    except Exception as e:
        logger.error("TTS synthesis failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=502, detail=f"TTS service unavailable: {str(e)}")

    return Response(content=audio_bytes, media_type="audio/mpeg")

