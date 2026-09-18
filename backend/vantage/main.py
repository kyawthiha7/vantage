from __future__ import annotations

import uvicorn
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from vantage.db import init_db
from vantage.routes import agent, chat, findings, health, settings, terminal

app = FastAPI(title="Vantage API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(findings.router, prefix="/api/v1")
app.include_router(agent.router, prefix="/api/v1")
app.include_router(terminal.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def run() -> None:
    uvicorn.run("vantage.main:app", host="0.0.0.0", port=8765, reload=True)


if __name__ == "__main__":
    run()
