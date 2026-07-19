from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    MINIMAX_API_KEY: str = os.getenv("MINIMAX_API_KEY", "")
    MINIMAX_GROUP_ID: str = os.getenv("MINIMAX_GROUP_ID", "")
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")

    GROQ_VISION_MODEL: str = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    GROQ_CHAT_MODEL: str = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
    MINIMAX_MODEL: str = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")
    DEEPGRAM_TTS_VOICE: str = os.getenv("DEEPGRAM_TTS_VOICE", "aura-asteria-en")
    DEEPGRAM_STT_MODEL: str = os.getenv("DEEPGRAM_STT_MODEL", "nova-2")

    MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_IMAGE_TYPES: set = {"image/jpeg", "image/png", "image/webp"}

    MINIMAX_BASE_URL: str = "https://api.minimaxi.chat/v1"
    DEEPGRAM_BASE_URL: str = "https://api.deepgram.com/v1"


settings = Settings()
