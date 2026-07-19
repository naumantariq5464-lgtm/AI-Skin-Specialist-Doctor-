"""
tts_service.py — Deepgram Text-to-Speech (doctor's voice → audio).
"""

import httpx
from backend.config import settings


class TTSService:
    async def synthesize(self, text: str) -> bytes:
        """
        Convert text to speech using Deepgram Aura TTS.
        Returns raw audio bytes (mp3).
        """
        url = f"{settings.DEEPGRAM_BASE_URL}/speak"
        params = {"model": settings.DEEPGRAM_TTS_VOICE}
        headers = {
            "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {"text": text}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, params=params, headers=headers)
            if not resp.is_success:
                error_body = resp.text
                raise httpx.HTTPStatusError(
                    f"Deepgram TTS error {resp.status_code}: {error_body}",
                    request=resp.request,
                    response=resp,
                )
            return resp.content


tts_service = TTSService()
