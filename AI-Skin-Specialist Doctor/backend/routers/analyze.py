"""
analyze.py — Image upload → Groq vision analysis.
Guardrails run first; LLM is called only if image passes validation.
"""

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend import guardrails
from backend.schemas import AnalyzeResponse
from backend.services.llm_service import llm_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("10/minute")
async def analyze_skin(
    request: Request,
    image: UploadFile = File(...),
    query: str = Form(default=""),
):
    """
    Accept an image file + optional text query.
    Returns a general skin analysis from the vision model.
    """
    image_bytes = await image.read()

    # Validate the uploaded file
    is_valid, err_msg = guardrails.validate_image(image.content_type, len(image_bytes))
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    # Pre-check the optional text query
    if query.strip():
        allowed, decline_msg = guardrails.pre_check(query)
        if not allowed:
            raise HTTPException(status_code=400, detail=decline_msg)

        is_red_flag, red_flag_response = guardrails.check_red_flags(query)
        if is_red_flag:
            return AnalyzeResponse(analysis=red_flag_response)

    try:
        analysis = await llm_service.analyze_image(image_bytes, image.content_type, query)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Analysis service unavailable: {str(e)}")

    _, safe_analysis = guardrails.post_check(analysis)
    return AnalyzeResponse(analysis=safe_analysis)
