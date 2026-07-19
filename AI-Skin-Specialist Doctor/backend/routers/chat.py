"""
chat.py — Text query → LLM response (Groq primary, MiniMax fallback).
Guardrails run on both input and output.
"""

from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend import guardrails
from backend.schemas import ChatRequest, ChatResponse
from backend.services.llm_service import llm_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, body: ChatRequest):
    """
    Accept a text message + optional conversation history + optional prior image analysis.
    Returns the AI skin advisor's response.
    """
    # Pre-check: jailbreak / off-topic detection
    allowed, decline_msg = guardrails.pre_check(body.message)
    if not allowed:
        return ChatResponse(reply=decline_msg, provider="guardrails")

    # Red-flag detection — severe symptoms
    is_red_flag, red_flag_response = guardrails.check_red_flags(body.message)
    if is_red_flag:
        return ChatResponse(reply=red_flag_response, provider="guardrails")

    # Inject prior image analysis as context if available
    enriched_message = body.message
    if body.image_analysis:
        enriched_message = (
            f"[Context from uploaded skin image analysis: {body.image_analysis}]\n\n"
            f"User follow-up: {body.message}"
        )

    try:
        reply, provider = await llm_service.chat(
            user_message=enriched_message,
            history=body.history,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chat service unavailable: {str(e)}")

    # Post-check: validate and ensure disclaimer is present
    _, safe_reply = guardrails.post_check(reply)
    return ChatResponse(reply=safe_reply, provider=provider)
