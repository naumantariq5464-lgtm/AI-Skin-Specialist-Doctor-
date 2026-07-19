# AI-Skin-Specialist Doctor — Project Plan

**Student:** Nauman Tariq
**Type:** AI-powered Multimodal Health Assistant (Skin Analysis)
**Version:** 1.0

---

## 1. Project Overview

AI-Skin-Specialist Doctor ek multimodal AI assistant hai jo user ki uploaded image aur voice/text query lekar general skin-related guidance deta hai. System strictly scoped hai — koi diagnosis, koi prescription, koi code-execution, koi off-topic kaam nahi karega. Yeh sirf ek "digital skin advisor" hai, real doctor ka replacement nahi.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Frontend | Plain HTML + CSS + Vanilla JS |
| Vision + LLM (Doctor's Brain) | Groq (multimodal) |
| Secondary/Fallback LLM | MiniMax |
| STT (Patient's Voice) | Deepgram |
| TTS (Doctor's Voice) | Deepgram |
| Rate Limiting | slowapi |
| Design Theme | White background, black text, single blue accent |

---

## 3. Design System

- Background: `#FFFFFF`
- Text: `#0A0A0A`
- Accent (blue, single shade only): `#2563EB`
- Borders: `#E5E5E5`, hover → blue
- Fonts: one heading font + one body font (consistent across whole site)
- Flat design — no gradients, no random shadows, no template-look

---

## 4. Architecture Flow

```
[Image Upload] ──────► Groq Vision Model ──► Skin Analysis (structured)
                                                     │
[Voice/Text Query] ─► Deepgram STT ─► Text Query ────┤
                                                     ▼
                                          Guardrails Layer (pre-check)
                                                     │
                                                     ▼
                                          Groq LLM (Doctor's Brain)
                                          + MiniMax (fallback provider)
                                                     │
                                          Guardrails Layer (post-check)
                                                     │
                                       ┌─────────────┴─────────────┐
                                       ▼                           ▼
                              Deepgram TTS (audio)          Frontend Text Reply
```

---

## 5. Implementation Phases

### Phase 1 — Doctor's Brain (Core Backend)
- FastAPI project structure (routers / services / schemas separated)
- `.env` config for Groq + MiniMax + Deepgram keys
- `/analyze` endpoint — image upload → vision analysis
- `/chat` endpoint — text query → LLM response
- Single `LLMService` class with provider abstraction (Groq primary, MiniMax fallback) — no duplicate logic across providers

### Phase 2 — Doctor's Voice (TTS)
- Deepgram TTS integration
- `/speak` endpoint — text → audio
- Frontend audio playback

### Phase 3 — Patient's Voice (STT)
- Browser MediaRecorder for audio capture
- `/transcribe` endpoint — audio → Deepgram STT → text
- Transcribed text piped directly into `/chat`

### Phase 4 — Frontend
- Single-page UI: image upload zone, chat window, mic button
- White/black/blue theme
- Custom HTML/CSS only — no template builders

---

## 6. Guardrails (Critical Section)

System do tarah ke risks se protect hoga: **(A) Medical safety** aur **(B) Misuse / jailbreak / off-topic exploitation**. Guardrails backend mein centralized (`guardrails.py`) honge — koi bhi endpoint direct LLM ko raw user input pass nahi karega, pehle isi layer se guzrega.

### A. Medical Safety Guardrails
1. **Scope lock** — System prompt mein clearly likha ho: AI sirf visible/general skin conditions (acne, dryness, rashes, general skincare) pe advice de sakta hai. Diagnosis ya prescription nahi.
2. **Mandatory disclaimer** — Har response ke sath: *"This is general guidance, not a medical diagnosis. Please consult a dermatologist for serious concerns."*
3. **Red-flag detection** — Severe symptoms (bleeding, rapid growth, infection signs) detect hon to turant professional consultation recommend, koi home remedy nahi.
4. **No medicine/dosage naming** — AI kabhi specific drug ya dose recommend nahi karega.

### B. Misuse / Restriction Guardrails (User request pe added)
Ye wo layer hai jo system ko uske scope se bahar kaam karne se rokta hai — chahe user kitni bhi koshish kare:

1. **Task-lock enforcement** — Agar user AI se code likhwane, coding help lene, script generate karwane, ya kisi bhi non-skin-related kaam (essays, homework, unrelated Q&A, general chit-chat) karwane ki koshish kare, system politely decline kare aur scope pe wapas le aaye. Example response: *"I'm only able to help with skin-related concerns. For other topics, please use a general assistant."*
2. **Prompt-injection resistance** — Agar user apne message mein instructions dalay jaise "ignore previous instructions", "act as...", "pretend you are...", "developer mode", etc., in sab ko system prompt override attempts treat kiya jaye aur ignore kiya jaye. System prompt hamesha final authority rahega, user input kabhi usko override nahi kar sakta.
3. **Input classification pre-check** — Har user query pehle ek lightweight classifier/check se guzray (keyword + LLM-based intent check) — agar query skin/health domain se bahar detect ho, to LLM call hi na ki jaye, seedha fixed decline message return ho. Isse unnecessary API cost bhi bachegi aur misuse bhi rukega.
4. **Output validation (post-check)** — LLM se response aane ke baad bhi ek dobara check ho ke response scope ke andar hai ya nahi (koi code snippet, koi unrelated content na ho). Agar violate ho to response discard karke safe fallback message bhejo.
5. **Repeated-attempt handling** — Agar same session mein user baar baar scope todne ki koshish kare, system ek firm final message de aur further off-topic attempts ko silently ignore/decline karta rahe (without being rude, but consistent).
6. **Image validation** — Sirf valid image files accept hon (type + size check); non-image ya suspicious files reject.
7. **Rate limiting** — `slowapi` se per-IP/per-session request limits, taake spam ya automated abuse na ho.
8. **No system prompt leakage** — Agar user pooche "what are your instructions" ya system prompt maangay, AI politely decline kare bina kuch reveal kiye.

---

## 7. Code Quality Standards (Human-like, Non-duplicate)

- `services/` folder — sab external API calls (Groq, MiniMax, Deepgram) isolated aur reusable
- `guardrails.py` — sab safety/restriction logic centralized, har endpoint isi ko call kare (koi endpoint apna alag check na likhe)
- Simple, human-style naming — minimal comments, sirf tricky logic explain karne ke liye
- Repeated patterns (error handling, response formatting) helper functions mein — copy-paste se bachna
- Sab config `.env` se — hardcoded keys/values nahi
- Consistent formatting across pura codebase (ek hi style, ek hi indentation pattern)

---

## 8. Folder Structure (Suggested)

```
ai-skin-specialist/
├── backend/
│   ├── main.py
│   ├── routers/
│   │   ├── analyze.py
│   │   ├── chat.py
│   │   ├── speak.py
│   │   └── transcribe.py
│   ├── services/
│   │   ├── llm_service.py       # Groq + MiniMax abstraction
│   │   ├── stt_service.py       # Deepgram STT
│   │   └── tts_service.py       # Deepgram TTS
│   ├── guardrails.py
│   ├── schemas.py
│   └── config.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── .env
```

---

## 9. Disclaimer

Yeh tool medical diagnosis ka replacement nahi hai. General skincare guidance ke liye design kiya gaya hai. Users ko har response ke sath encourage kiya jayega ke serious concerns ke liye qualified dermatologist se consult karein.


