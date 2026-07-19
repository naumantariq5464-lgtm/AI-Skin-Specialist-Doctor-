# AI-Skin-Specialist Doctor — New Addition

## Phase 5 — General Symptom Advisor (New Module, Tool-Calling)

Skin ke ilawa ab system general symptoms bhi handle karega — jaise **bukhar, sar dard, chakkar, seenay/dil mein takleef** waghera. Ye alag capability hai jo LLM ke **tool-calling** se kaam karegi:

- User jab symptom bataye (text ya voice), LLM pehle **situation assess** karega — kitna serious lag raha hai.
- Zaroorat pade to LLM ek **tool call** trigger karega jo real-time trusted medical sources (Mayo Clinic, NHS, WebMD, MedlinePlus) se relevant info fetch kare — koi random website nahi, fixed whitelist se hi.
- Fetched info ko LLM apne alfaz mein summarize karke user ko samjhaye — kya ho sakta hai, general self-care kya karni chahiye, aur kab doctor ke paas jana zaroori hai.
- **Har response mein "next step" clearly bataya jayega** — jaise "aaram karo aur paani piyo" ya "turant emergency/doctor ke paas jao" — depend severity par.
- Naya endpoint: `/symptom-check` — text/voice query leke tool-calling pipeline se guzar ke structured response deta hai (Situation Summary + Suggested Action + Urgency Level).
- Ye module bhi wahi centralized `guardrails.py` use karega — koi alag/duplicate guardrail file nahi banegi.

---

## Guardrails — Section C: General Symptom Advisor (Phase 5 specific)

1. **Emergency red-flag override** — Agar symptoms mein *seenay mein dard, saans lene mein takleef, achanak shadeed chakkar, behoshi, ya dil ki takleef* jaisi baatein hon, system koi bhi home advice na de — seedha aur firmly bole: *"Ye emergency symptoms ho saktay hain, foran nazdeeki hospital jayein ya emergency helpline par call karein."* Yahan tool-calling ya detailed explanation ki zaroorat nahi, sirf turant emergency-redirect.
2. **Whitelist-only sources** — Tool-calling sirf pre-approved trusted medical domains se hi data fetch karega. Random/unverified websites se koi info nahi li jayegi.
3. **No diagnosis, only guidance** — System kabhi "aapko ye bimari hai" nahi bolega, sirf "ye symptoms is se milte julte hain, doctor confirm kar sakta hai" jaisa language use karega.
4. **Urgency-first response structure** — Har `/symptom-check` response mein pehle urgency level batana zaroori (Low / Medium / Emergency), phir baaki details.
5. **Same restriction/injection guardrails apply** — Section B ke sab misuse/jailbreak guardrails is module par bhi lagu hongay (koi coding help, koi prompt injection accept nahi hoga is module ke through bhi).

---

## Folder Structure Addition

```
├── routers/
│   └── symptom_check.py
├── services/
│   └── medical_lookup.py    # Whitelisted-source tool-calling
```