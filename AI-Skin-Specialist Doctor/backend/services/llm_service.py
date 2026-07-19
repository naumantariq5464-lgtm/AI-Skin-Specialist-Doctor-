"""
llm_service.py — Groq (primary) + MiniMax (fallback) abstraction.
One class, one interface. No duplicate logic across providers.
"""

import base64
import httpx
from groq import AsyncGroq

from backend.config import settings
from backend.guardrails import get_system_prompt


class LLMService:
    def __init__(self):
        self._groq = AsyncGroq(api_key=settings.GROQ_API_KEY)

    async def chat(self, user_message: str, history: list = None, image_b64: str = None) -> tuple[str, str]:
        """
        Main entry point.
        Returns (response_text, provider_name).
        Tries Groq first; falls back to MiniMax for text-only queries.
        Vision (image_b64) is Groq-only — no fallback available for that.
        """
        messages = self._build_messages(user_message, history or [], image_b64)

        try:
            text = await self._groq_chat(messages, use_vision=bool(image_b64))
            return text, "groq"
        except Exception as groq_err:
            if image_b64:
                # Cannot fallback vision to MiniMax
                raise RuntimeError(f"Vision analysis failed: {groq_err}") from groq_err
            try:
                text = await self._minimax_chat(messages)
                return text, "minimax"
            except Exception as mm_err:
                raise RuntimeError(f"Both providers failed. Groq: {groq_err} | MiniMax: {mm_err}") from mm_err

    async def analyze_image(self, image_bytes: bytes, content_type: str, user_query: str = "") -> str:
        """
        Analyze a skin image with Groq vision model.
        Returns the analysis text.
        """
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        
        base_prompt = (
            "Please analyze this skin image in detail:\n"
            "1. Observations: Describe the skin concerns visible in the image (e.g., acne breakouts, redness, dry patches, irritation) and assess the general state of the skin.\n"
            "2. Skincare & Product Recommendations: Suggest a suitable daily skincare routine and recommend specific helpful over-the-counter (OTC) product categories and key active ingredients (e.g., Salicylic Acid, Benzoyl Peroxide for acne; Ceramides, Hyaluronic Acid for dryness; Niacinamide, Vitamin C for pigmentation) that the user can use to improve this condition.\n"
            "3. Next Steps: Mention when they should consult a professional dermatologist."
        )
        
        if user_query.strip():
            prompt = f"User Question: {user_query}\n\n[Please analyze the uploaded image and answer the user question using these guidelines:\n{base_prompt}]"
        else:
            prompt = base_prompt

        text, _ = await self.chat(prompt, image_b64=image_b64)
        return text

    # ─── Private helpers ───────────────────────────────────────────────────

    def _build_messages(self, user_message: str, history: list, image_b64: str = None) -> list:
        messages = [{"role": "system", "content": get_system_prompt()}]

        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})

        if image_b64:
            # Vision message — multimodal content list
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                    {"type": "text", "text": user_message},
                ],
            })
        else:
            messages.append({"role": "user", "content": user_message})

        return messages

    async def _groq_chat(self, messages: list, use_vision: bool = False) -> str:
        model = settings.GROQ_VISION_MODEL if use_vision else settings.GROQ_CHAT_MODEL
        response = await self._groq.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=1024,
            temperature=0.35,
        )
        return response.choices[0].message.content

    async def _minimax_chat(self, messages: list) -> str:
        # Convert system message to match MiniMax format (they handle system role fine)
        url = f"{settings.MINIMAX_BASE_URL}/text/chatcompletion_v2"
        headers = {
            "Authorization": f"Bearer {settings.MINIMAX_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.MINIMAX_MODEL,
            "messages": messages,
            "temperature": 0.35,
            "max_tokens": 1024,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    # ─── Phase 5: Symptom Checker with Tool-Calling ───────────────────────────

    async def symptom_check(self, symptom_text: str) -> "SymptomCheckResponse":
        import json
        import re
        from backend.schemas import SymptomCheckResponse
        from backend.services.medical_lookup import fetch_medical_info
        from backend.guardrails import get_symptom_advisor_prompt

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "fetch_medical_info",
                    "description": (
                        "Fetch up-to-date medical information about symptoms or health conditions "
                        "from trusted sources: MedlinePlus (US NLM), NHS, Mayo Clinic, WebMD."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_query": {
                                "type": "string",
                                "description": (
                                    "Specific symptom or condition to search. "
                                    "e.g. 'fever chills adults causes', 'persistent headache behind eyes'"
                                ),
                            }
                        },
                        "required": ["search_query"],
                    },
                },
            }
        ]

        messages = [
            {"role": "system", "content": get_symptom_advisor_prompt()},
            {"role": "user", "content": symptom_text},
        ]

        # First call — let model decide to fetch info via tool
        first_response = await self._groq.chat.completions.create(
            model=settings.GROQ_CHAT_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=512,
        )

        message = first_response.choices[0].message
        sources_used = False

        if message.tool_calls:
            tool_call = message.tool_calls[0]
            args = json.loads(tool_call.function.arguments)
            search_query = args.get("search_query", symptom_text)

            # Execute the real-time medical data fetch
            medical_data = await fetch_medical_info(search_query)
            sources_used = bool(medical_data)

            # Append assistant tool-call message
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                ],
            })
            # Append tool result
            messages.append({
                "role": "tool",
                "content": medical_data or "No specific results found. Use your medical training knowledge to respond.",
                "tool_call_id": tool_call.id,
            })

            # Second call — generate final structured response with fetched data
            final_response = await self._groq.chat.completions.create(
                model=settings.GROQ_CHAT_MODEL,
                messages=messages,
                temperature=0.2,
                max_tokens=800,
            )
            final_text = final_response.choices[0].message.content or ""
        else:
            final_text = message.content or ""

        parsed = self._parse_symptom_response(final_text)

        return SymptomCheckResponse(
            urgency=parsed["urgency"],
            summary=parsed["summary"],
            action=parsed["action"],
            sources_used=sources_used,
            provider="groq",
        )

    def _parse_symptom_response(self, text: str) -> dict:
        import re

        urgency_match = re.search(r"URGENCY:\s*(LOW|MEDIUM|EMERGENCY)", text, re.IGNORECASE)
        summary_match = re.search(
            r"SUMMARY:\s*(.+?)(?=\nACTION:|\nURGENCY:|⚕️|$)", text, re.IGNORECASE | re.DOTALL
        )
        action_match = re.search(
            r"ACTION:\s*(.+?)(?=\n⚕️|⚕️|$)", text, re.IGNORECASE | re.DOTALL
        )

        urgency = urgency_match.group(1).upper() if urgency_match else "MEDIUM"
        summary = summary_match.group(1).strip() if summary_match else text.strip()
        action = (
            action_match.group(1).strip()
            if action_match
            else "Please consult a qualified healthcare professional for proper evaluation."
        )

        # Remove leftover disclaimer from summary/action if parsed in
        summary = re.sub(r"⚕️.*$", "", summary, flags=re.DOTALL).strip()
        action = re.sub(r"⚕️.*$", "", action, flags=re.DOTALL).strip()

        return {"urgency": urgency, "summary": summary, "action": action}


# Singleton — import and use this everywhere
llm_service = LLMService()
