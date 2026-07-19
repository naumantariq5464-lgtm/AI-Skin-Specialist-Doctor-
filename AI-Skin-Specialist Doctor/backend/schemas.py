from pydantic import BaseModel
from typing import List, Optional


class Message(BaseModel):
    role: str   # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []
    image_analysis: Optional[str] = None  # Inject prior image analysis as context


class ChatResponse(BaseModel):
    reply: str
    provider: str   # "groq" | "minimax"


class AnalyzeResponse(BaseModel):
    analysis: str


class TranscribeResponse(BaseModel):
    transcript: str


class SpeakRequest(BaseModel):
    text: str


class SymptomCheckRequest(BaseModel):
    symptom: str


class SymptomCheckResponse(BaseModel):
    urgency: str        # "LOW" | "MEDIUM" | "EMERGENCY"
    summary: str
    action: str
    sources_used: bool
    provider: str
