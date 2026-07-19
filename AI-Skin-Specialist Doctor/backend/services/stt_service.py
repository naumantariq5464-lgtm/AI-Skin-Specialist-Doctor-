"""
stt_service.py — Deepgram Speech-to-Text (patient's voice → text).
"""

import httpx
from backend.config import settings


class STTService:
    async def transcribe(self, audio_bytes: bytes, mimetype: str = "audio/webm") -> str:
        """
        Send audio bytes to Deepgram and return the transcript string.
        """
        url = f"{settings.DEEPGRAM_BASE_URL}/listen"
        params = {
            "model": settings.DEEPGRAM_STT_MODEL,
            "smart_format": "true",
            "punctuate": "true",
            "language": "en",
        }
        headers = {
            "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
            "Content-Type": mimetype,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, content=audio_bytes, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        try:
            transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
        except (KeyError, IndexError):
            transcript = ""

        return transcript.strip()


stt_service = STTService()
