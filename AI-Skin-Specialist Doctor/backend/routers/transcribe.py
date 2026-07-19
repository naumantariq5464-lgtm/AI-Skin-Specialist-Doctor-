"""
transcribe.py — Audio upload → Deepgram STT → text (patient's voice).
Transcribed text is returned to the frontend, which then pipes it into /chat.
"""

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.schemas import TranscribeResponse
from backend.services.stt_service import stt_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

_ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/ogg", "audio/mp4",
    "audio/mpeg", "audio/wav", "audio/x-wav",
}
_MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/transcribe", response_model=TranscribeResponse)
@limiter.limit("15/minute")
async def transcribe(request: Request, audio: UploadFile = File(...)):
    """
    Accept a browser-recorded audio file and return its transcript.
    """
    audio_bytes = await audio.read()

    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25 MB).")

    # Allow unknown content-type from browser MediaRecorder (often 'application/octet-stream')
    content_type = audio.content_type or "audio/webm"

    try:
        transcript = await stt_service.transcribe(audio_bytes, mimetype=content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription service unavailable: {str(e)}")

    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected in the audio. Please try again.")

    return TranscribeResponse(transcript=transcript)
