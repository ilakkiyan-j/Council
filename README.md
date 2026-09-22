# 🏛️ Council V2 — Custom AI Bot Platform

**Council** is a production-grade, multi-tenant AI workshop and custom bot orchestration platform for the `0-OS` ecosystem (Nox, Xion, and beyond).

> **Core Architectural Principle:**  
> **Council is the platform. Bots are user-owned data.**

Bots are never hardcoded in source code. Any user can create, configure, duplicate, test, and deploy completely custom AI Bots with their own personalities, instructions, memories, models, tools, and application integrations.

---

## 🌟 Key Features

- 🤖 **Dynamic Bot Workshop**: Multi-step wizard to create bots with custom identities, avatars, persona sliders (creativity, strictness, humor), system prompts, and safety rules.
- 🔑 **Bring Your Own Key (BYOK)**: Connect personal credentials for Google Gemini, Groq, OpenAI, or local Ollama endpoints. Keys are encrypted at rest using **AES-256-GCM** with SHA-256 fingerprints—raw keys are never returned to the client or logged.
- 🧠 **Multi-Tenant Memory Isolation**: Strict separation between user-wide `GLOBAL` preferences and private bot memories. A bot never retrieves another bot's private memories.
- 🔗 **Application & Tool Registry**: Connect bots to external apps like **Nox (Executive Life OS)** with granular permissions (`READ_ONLY`, `ASK_BEFORE_ACTION`, `AUTOMATIC`).
- ⚡ **Universal Deliberation Studio**: Dynamically select any 2+ custom bots from your workshop to debate technical dilemmas, roadmaps, or startup strategy sequentially.
- 💬 **Universal Bot Chat**: Real-time chat with SSE streaming, message history persistence in PostgreSQL, and tool execution action pills.

---

## 🏛️ Initial Seed Bots (User-Owned Data)

On first run, Council automatically seeds three foundational bots into the user's PostgreSQL database:

| Bot | Role | Integration | Provider | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **💖 Sofi** | Personal Assistant & Confidante | **Nox Connected** | Google Gemini | Real-time tasks, daily plan negotiation, calendar, habits, goals, reminders. |
| **🧭 Riven** | Chief Systems Architect | **Standalone** | Groq Cloud | Systems architecture, data schemas, API contracts, modular technical reasoning. |
| **🔥 Lucifer** | Partner in Crime & Auditor | **Standalone** | Groq Cloud | Ruthless plan auditing, blind spot analysis, deadline reality checks, motivation. |

*Note: These are ordinary database records. Renaming, modifying, or deleting any or all of them leaves Council fully operational.*

---

## 🏗️ Target Architecture

```text
                         COUNCIL V2
                  Custom AI Bot Platform
                            │
                       Bot Registry
                            │
             ┌──────────────┼──────────────┐
             │              │              │
            Sofi           Riven        Custom Bot
             │              │              │
            NOX         Standalone     Standalone
             │
           Tools
             │
             ▼
        Bot Runtime
             │
      ┌──────┼───────┐
      ▼      ▼       ▼
   Memory Knowledge Model
      │      │       │
      └──────┼───────┘
             ▼
       Context Builder
             │
             ▼
        Model Router
             │
   ┌─────────┼─────────┬─────────┐
   ▼         ▼         ▼         ▼
 Gemini    Groq     OpenAI    Ollama
   │         │         │         │
   └─────────┴─────────┴─────────┘
             ▼
     User Credential (AES-256-GCM)
             ▼
        AI Provider
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20+
- **PostgreSQL Database** (Neon or local)

### 2. Installation
```bash
git clone https://github.com/ilakkiyan-j/Council.git
cd Council
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set the following variables:
```env
PORT=4100
NODE_ENV=development

# PostgreSQL connection string (uses isolated council schema)
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require&schema=council"

# Authentication & Encryption Secrets
JWT_SECRET="your_jwt_secret_matching_nox"
ENCRYPTION_KEY="32_byte_hex_or_secure_secret_for_aes_256_gcm"

# Connected Applications
NOX_API_URL="http://localhost:4000"
XION_API_URL="http://localhost:5000"
```

### 4. Database Setup
Push the Prisma schema to your PostgreSQL database:
```bash
npx prisma db push
```

### 5. Run Server
```bash
# Development (with hot reload)
npm run dev

# Production Build & Start
npm run build
npm start
```
Open **`http://localhost:4100`** in your browser to access the Council V2 Web Workshop.

---

## 🔌 API Reference

All protected endpoints accept `Authorization: Bearer <jwt>` (matching Nox SSO) or `X-User-Id: <id>` in development.

### 🤖 Bots
- `GET /api/v1/bots` — List all custom bots belonging to the authenticated user.
- `POST /api/v1/bots` — Create a new bot with persona, instructions, model, and integrations.
- `GET /api/v1/bots/:id` — Retrieve bot details.
- `PATCH /api/v1/bots/:id` — Update bot configuration.
- `DELETE /api/v1/bots/:id` — Delete a bot.
- `POST /api/v1/bots/:id/duplicate` — Clone an existing bot.

### 🔑 AI Providers & Credentials (BYOK)
- `GET /api/v1/provider-credentials` — List user credentials (returns masked keys only).
- `POST /api/v1/provider-credentials` — Validate format, test with provider, encrypt with AES-256-GCM, and store.
- `POST /api/v1/provider-credentials/:id/test` — Test connectivity of an existing credential.
- `DELETE /api/v1/provider-credentials/:id` — Revoke and delete a credential.

### 💬 Chat & Conversations
- `POST /api/v1/chat` — Execute turn with any bot (`botId` or legacy `persona` slug).
- `POST /api/v1/chat/stream` — Real-time Server-Sent Events (SSE) streaming.
- `GET /api/v1/conversations?botId=:id` — List user conversations.
- `GET /api/v1/conversations/:id` — Get conversation message history.
- `DELETE /api/v1/conversations/:id/clear` — Clear message history.

### ⚡ Deliberation Studio
- `POST /api/v1/council/deliberate` — Multi-bot council deliberation (accepts `topic` and optional `botIds`).
- `POST /api/v1/council/debate` — Backward-compatible debate endpoint.

### 🧠 Memory Vault
- `GET /api/v1/memory?botId=:id` — List memories (global and bot-isolated).
- `POST /api/v1/memory` — Add a permanent fact or preference.
- `DELETE /api/v1/memory/:id` — Delete a memory.

### 🔗 Applications & Health
- `GET /api/v1/applications` — List registered apps (Nox, Xion) and their exposed tools.
- `GET /api/v1/providers` — List supported LLM providers.
- `GET /health` — Service health status, database type, and active tool count.

---

## 🔒 Security & Privacy

1. **No Raw Keys in Code or DB**: API keys are encrypted at rest with AES-256-GCM and never returned to the frontend.
2. **Strict Multi-Tenancy**: Every database query is scoped to `authenticatedUser.id`.
3. **No Implicit Fallback**: Bots never fall back to server environment variables if a user credential is missing.
4. **Prompt Injection Defense**: Retrieved memories and external application data are treated as untrusted boundaries.
5. **Rate Limiting**: Credential operations and chat generation are protected against abuse.

---

## 📜 License
MIT
