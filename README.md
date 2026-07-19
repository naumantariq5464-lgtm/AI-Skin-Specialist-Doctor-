# AI-Skin-Specialist Doctor

> **An AI-powered multimodal healthcare assistant that combines AI skin analysis with an intelligent symptom checker, providing safe, general medical guidance through vision, voice, and text while enforcing strict AI guardrails.**

---

# Overview

AI-Skin-Specialist Doctor is a **full-stack AI healthcare assistant** built to help users understand **skin-related concerns** and **general health symptoms**.

The application accepts **images, voice, and text** as input and uses multimodal AI models to provide structured guidance, urgency assessment, and general healthcare recommendations.

The system is **not a diagnostic tool** and never replaces a qualified healthcare professional. It is designed to provide **general educational guidance** while maintaining strong medical safety standards through centralized AI guardrails.

---

# Key Features

## AI Skin Analysis

- Upload a skin image
- AI Vision model analyzes the image
- Detects visible skin conditions such as:
  - Acne
  - Dry skin
  - Rashes
  - Pigmentation
  - Redness
- Provides general skincare recommendations
- Never provides medical diagnosis
- Never prescribes medicines

---

## AI Symptom Checker

Users can describe symptoms using:

- Text
- Voice

The assistant can evaluate symptoms such as:

- Fever
- Headache
- Dizziness
- Fatigue
- Cough
- Chest discomfort
- Skin irritation
- General illness

The system determines an urgency level:

- 🟢 Low
- 🟡 Medium
- 🔴 Emergency

It also provides:

- Situation summary
- General guidance
- Suggested next steps
- Recommendation to consult a healthcare professional when appropriate

---

## Voice Assistant

Supports complete voice interaction.

### Speech-to-Text

User speaks naturally.

Deepgram converts speech into text.

---

### Text-to-Speech

The assistant replies using natural AI voice generated through Deepgram TTS.

---

## Intelligent Medical Lookup

For general symptom queries, the LLM can call a medical lookup tool.

Instead of relying on model memory alone, it retrieves information only from trusted medical sources.

Whitelisted sources include:

- Mayo Clinic
- NHS
- MedlinePlus
- WebMD

The fetched information is summarized by the LLM into easy-to-understand guidance.

---

# AI Guardrails

The project contains a centralized guardrail system responsible for ensuring medical safety and preventing misuse.

Every request passes through the guardrails before reaching the LLM.

## Medical Safety

The assistant:

- Never diagnoses diseases
- Never prescribes medications
- Never recommends medicine dosage
- Always includes a medical disclaimer
- Detects emergency situations
- Encourages users to consult healthcare professionals

---

## Emergency Detection

If the assistant detects symptoms such as:

- Chest pain
- Difficulty breathing
- Loss of consciousness
- Severe dizziness
- Heart-related symptoms

It immediately recommends seeking emergency medical care instead of generating detailed advice.

---

## Prompt Injection Protection

The assistant ignores attempts such as:

- Ignore previous instructions
- Developer mode
- Act as another AI
- System prompt extraction
- Jailbreak attempts

The system prompt always remains the highest authority.

---

## Scope Restriction

The assistant only supports:

- Skin-related questions
- General symptom guidance

Requests outside the healthcare domain are politely declined.

Examples:

- Coding
- Homework
- Essay writing
- Programming
- General chatbot conversations

---

## Image Validation

The backend validates:

- Image type
- File size
- Invalid uploads
- Suspicious files

Only supported image formats are accepted.

---

## Output Validation

Every AI response is validated before being sent to users.

Unsafe or out-of-scope responses are rejected and replaced with a safe fallback message.

---

## Rate Limiting

The API uses SlowAPI to prevent:

- Spam
- Abuse
- Excessive API usage

---

# Technical Architecture

```
                     User

         Image / Voice / Text
                 │
                 ▼

      ┌─────────────────────────┐
      │     Frontend (HTML)     │
      └─────────────────────────┘
                 │
                 ▼

          FastAPI Backend
                 │
      ┌──────────┴──────────┐
      │                     │
      ▼                     ▼

 Guardrails          Request Router
      │                     │
      └──────────┬──────────┘
                 │
        ┌────────┴─────────┐
        │                  │
        ▼                  ▼

 Image Analysis      Symptom Checker
        │                  │
        ▼                  ▼

  Groq Vision       Medical Lookup Tool
        │                  │
        └────────┬─────────┘
                 ▼

       Groq Language Model
                 │
          MiniMax Fallback
                 │
                 ▼

      Guardrails Validation
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼

  Text Response     Deepgram TTS
        │                 │
        └────────┬────────┘
                 ▼

             Frontend
```

---

# Technology Stack

| Layer | Technology |
|----------|------------|
| Backend | FastAPI |
| Frontend | HTML |
| Styling | CSS |
| Client Logic | Vanilla JavaScript |
| Vision AI | Groq Vision Model |
| LLM | Groq |
| Fallback LLM | MiniMax |
| Speech-to-Text | Deepgram STT |
| Text-to-Speech | Deepgram TTS |
| Tool Calling | Medical Lookup Service |
| Rate Limiting | SlowAPI |
| Configuration | Python Dotenv |
| Environment Variables | .env |

---

# Project Architecture

```
backend/

├── routers/
│   ├── analyze.py
│   ├── chat.py
│   ├── speak.py
│   ├── transcribe.py
│   └── symptom_check.py
│
├── services/
│   ├── llm_service.py
│   ├── stt_service.py
│   ├── tts_service.py
│   └── medical_lookup.py
│
├── guardrails.py
├── schemas.py
├── config.py
└── main.py

frontend/

├── index.html
├── style.css
└── script.js
```

---

# API Endpoints

| Endpoint | Description |
|------------|------------|
| `/analyze` | Analyze uploaded skin images |
| `/chat` | Chat with the AI doctor |
| `/transcribe` | Convert voice into text |
| `/speak` | Convert AI response into speech |
| `/symptom-check` | Analyze symptoms and assess urgency |

---

# AI Workflow

### Skin Analysis

```
Image

↓

Groq Vision

↓

Guardrails

↓

Groq LLM

↓

Recommendation

↓

Frontend
```

---

### Symptom Checking

```
Voice/Text

↓

Deepgram STT

↓

Guardrails

↓

Medical Lookup Tool

↓

Groq LLM

↓

Urgency Detection

↓

Recommendation

↓

Deepgram TTS

↓

Frontend
```

---

# Design System

- White background
- Black typography
- Blue accent (#2563EB)
- Minimal interface
- Flat design
- Responsive layout
- Accessible components

---

# Security Features

- Centralized Guardrails
- Prompt Injection Protection
- Scope Lock
- Image Validation
- Output Validation
- Rate Limiting
- Safe Medical Responses
- Trusted Medical Sources
- API Key Management using `.env`

---

# Disclaimer

**AI-Skin-Specialist Doctor is intended only for educational and informational purposes.**

The assistant does **not** diagnose diseases, prescribe medications, or replace professional medical advice.

If symptoms are severe, persistent, or appear to be life-threatening, users should immediately consult a qualified healthcare professional or visit the nearest emergency department.
