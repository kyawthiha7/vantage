# Vantage

A security testing workbench with an AI assistant, autonomous agent, findings tracker, and report generator.

## Stack

- **Frontend** — Next.js 16 (App Router) on port 3000
- **Backend** — FastAPI + SQLite on port 8765
- **AI** — Anthropic Claude (direct API key **or** auth2api proxy)

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.11 – 3.14 |
| Poetry | 1.8+ |

---

## Installation

### 1. Frontend

```bash
npm install
```

### 2. Backend

```bash
cd backend
poetry install
```

---

## Configuration

The backend reads credentials from `backend/.env`. Create that file before starting.

### Option A — Anthropic API key

If you have an API key from [console.anthropic.com](https://console.anthropic.com):

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
```

### Option B — auth2api (no API key needed)

[auth2api](https://github.com/Skrullex/auth2api) is a local proxy that routes Anthropic SDK calls through your existing Claude.ai session. Use this if you have a Claude.ai subscription but no direct API key.

**Install and run auth2api** (follow its README for your platform — it starts on port 8317 by default).

Then point the backend at it:

```bash
# backend/.env
ANTHROPIC_BASE_URL=http://127.0.0.1:8317
ANTHROPIC_API_KEY=any-non-empty-string
```

The `ANTHROPIC_API_KEY` value is not sent to Anthropic when using the proxy — it just satisfies the SDK's validation. Set it to anything non-empty.

---

## Running

Open two terminals:

**Terminal 1 — backend**

```bash
cd backend
poetry run vantage-backend
```

Starts the API at `http://localhost:8765`.

**Terminal 2 — frontend**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## First-time setup

1. Go to **Settings** and configure your scope (target CIDR) and optionally override the AI model.
2. Use the **Assistant** tab for interactive chat — the AI can suggest and run commands with your approval.
3. Use the **Agent** tab to launch autonomous runs — the agent plans and executes steps, pausing for approval before each tool call.
4. Confirmed vulnerabilities appear in **Findings** and can be compiled into a **Report** (downloads as Markdown).

---

## Project layout

```
vantage/
├── src/                  # Next.js frontend
│   ├── app/              # Pages (assistant, agent, findings, reports, settings)
│   ├── components/       # Shared UI components
│   └── contexts/         # React contexts (chat, agent state)
└── backend/
    └── vantage/
        ├── main.py       # FastAPI app, port 8765
        ├── models.py     # SQLModel DB models
        └── routes/       # chat, agent, findings, settings, terminal
```

---

## Notes

- The SQLite database is created automatically at `backend/vantage.db` on first run.
- Chat history persists in SQLite; agent run history persists in browser localStorage.
- The AI assistant streams responses directly from the backend (`http://localhost:8765`) rather than through the Next.js proxy, which would buffer SSE streams.
