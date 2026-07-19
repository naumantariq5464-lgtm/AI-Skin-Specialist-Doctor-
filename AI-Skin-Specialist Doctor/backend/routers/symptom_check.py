"""
symptom_check.py — /symptom-check endpoint (Phase 5)
Text query → guardrails (Section C) → tool-calling pipeline → structured response
(Urgency Level + Situation Summary + Recommended Action)
"""

from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend import guardrails
from backend.schemas import SymptomCheckRequest, SymptomCheckResponse
from backend.services.llm_service import llm_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/symptom-check", response_model=SymptomCheckResponse)
@limiter.limit("10/minute")
async def symptom_check(request: Request, body: SymptomCheckRequest):
    """
    Accept a symptom description.
    Returns: urgency level (LOW/MEDIUM/EMERGENCY), situation summary, and recommended action.
    """
    symptom_text = body.symptom.strip()
    if not symptom_text:
        raise HTTPException(status_code=400, detail="Symptom description cannot be empty.")

    # Section C Rule 1 — Emergency red-flag override (highest priority, no LLM call)
    is_emergency, emergency_msg = guardrails.check_emergency_symptoms(symptom_text)
    if is_emergency:
        return SymptomCheckResponse(
            urgency="EMERGENCY",
            summary=emergency_msg,
            action="Call emergency services NOW or go to the nearest hospital emergency department immediately.",
            sources_used=False,
            provider="guardrails",
        )

    # General pre-check: jailbreak + off-topic
    allowed, decline_msg = guardrails.pre_check_symptom(symptom_text)
    if not allowed:
        raise HTTPException(status_code=400, detail=decline_msg)

    try:
        result = await llm_service.symptom_check(symptom_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Symptom check service unavailable: {str(e)}")

    return result
