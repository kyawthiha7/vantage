from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

import anthropic
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from vantage.db import engine, get_session
from vantage.models import ChatMessage

router = APIRouter()

_client = anthropic.AsyncAnthropic()

SYSTEM_PROMPT = """You are Vantage, a security testing assistant embedded in a penetration testing workbench.

You help operators plan, execute, and document security engagements. You can suggest tools, interpret scan output, draft findings, and generate report text.

When you want to run a tool (nmap, gobuster, curl, etc.), output a JSON block tagged <tool_call> with the fields:
  tool: string (tool name)
  command: string (full command to run)

The operator will approve or deny each tool call before it executes. Never run destructive commands without explicit approval.

Keep responses concise and operator-focused. Reference scope and targets from context when available."""


class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]
    scope: str = ""


async def _stream_claude(messages: list[dict], scope: str, session_id: str) -> AsyncGenerator[str, None]:
    system = SYSTEM_PROMPT
    if scope:
        system += f"\n\nCurrent scope: {scope}"

    accumulated = ""
    async with _client.messages.stream(
        model="claude-sonnet-5",
        max_tokens=4096,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            accumulated += text
            yield f"data: {json.dumps({'text': text})}\n\n"

    if accumulated:
        with Session(engine) as db:
            db.add(ChatMessage(session_id=session_id, role="assistant", content=accumulated))
            db.commit()

    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat(
    req: ChatRequest,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    # Persist user message
    last = req.messages[-1] if req.messages else None
    if last and last.get("role") == "user":
        session.add(ChatMessage(
            session_id=req.session_id,
            role="user",
            content=last["content"] if isinstance(last["content"], str) else str(last["content"]),
        ))
        session.commit()

    return StreamingResponse(
        _stream_claude(req.messages, req.scope, req.session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/chat/sessions")
def list_sessions(session: Session = Depends(get_session)) -> list[dict]:
    msgs = session.exec(
        select(ChatMessage)
        .where(ChatMessage.role == "user")
        .order_by(ChatMessage.created_at)  # type: ignore[arg-type]
    ).all()
    seen: dict[str, dict] = {}
    for m in msgs:
        if m.session_id not in seen:
            seen[m.session_id] = {
                "session_id": m.session_id,
                "title": m.content[:60],
                "created_at": m.created_at.isoformat(),
            }
    return sorted(seen.values(), key=lambda x: x["created_at"], reverse=True)


@router.get("/chat/{session_id}/history")
def chat_history(
    session_id: str,
    session: Session = Depends(get_session),
) -> list[dict]:
    msgs = session.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)  # type: ignore[arg-type]
    ).all()
    return [{"role": m.role, "content": m.content, "id": m.id} for m in msgs]


class RunRequest(BaseModel):
    command: str


@router.post("/chat/run")
async def run_command(req: RunRequest) -> dict:
    try:
        proc = await asyncio.create_subprocess_shell(
            req.command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        return {"output": stdout.decode(errors="replace")[:4000] or "(no output)"}
    except asyncio.TimeoutError:
        return {"output": "Timed out after 30s."}
    except Exception as exc:
        return {"output": f"Error: {exc}"}
