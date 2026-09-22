# Council — Multi-Persona AI Hub for 0-OS

**Council** is the centralized autonomous multi-agent intelligence server for the `0-OS` ecosystem (Nox, Xion, and upcoming apps).

---

## ✨ Personas

1. 💖 **Sofi** (`sofi`): Executive PA & Girlfriend
   - **Model**: Google Gemini 2.0 / 1.5 (100% Free tier on Google AI Studio)
   - **Capabilities**: Full tool access to NOX (tasks, habits, calendar events, reminders, notes, daily plan negotiation).
2. 🧭 **Riven** (`riven`): Chief Systems Architect & Idea Shaper
   - **Model**: Llama 3.3 70B (Groq Cloud Free Tier)
   - **Capabilities**: Engineering architecture, Xion roadmap guidance, software design, unblocking technical doubts.
3. 🔥 **Lucifer** (`lucifer`): Partner in Crime & Ruthless Auditor
   - **Model**: DeepSeek-R1 Distill (Groq Cloud Free Tier)
   - **Capabilities**: Plan stress-testing, risk analysis, timeline reality checks, unfiltered motivation.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
```env
PORT=4100
GEMINI_API_KEY="your_free_gemini_key"
GROQ_API_KEY="your_free_groq_key"
NOX_API_URL="http://localhost:4000"
```

### 3. Run Dev Server
```bash
npm run dev
```
The server will start on `http://localhost:4100`.

---

## 🔌 API Endpoints
- `GET /api/v1/health` — Service status, loaded personas, active tool count.
- `POST /api/v1/chat` — Send a message to a persona:
  ```json
  {
    "persona": "sofi",
    "message": "Hey Sofi, what should we focus on today?",
    "sessionId": "user_123"
  }
  ```
