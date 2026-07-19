import asyncio
from dotenv import load_dotenv
load_dotenv()

from backend.services.llm_service import llm_service

async def test():
    try:
        result = await llm_service._groq.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=10,
        )
        print("Groq OK:", result.choices[0].message.content)
    except Exception as e:
        print("Groq FAILED:", type(e).__name__, str(e))

asyncio.run(test())
