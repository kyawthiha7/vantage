from __future__ import annotations

import asyncio
import json
import os
import uuid
from typing import AsyncGenerator

import anthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session

from vantage.db import engine
from vantage.models import Finding

router = APIRouter()
_client = anthropic.AsyncAnthropic()

SYSTEM = """You are Vantage Agent, an autonomous security testing assistant running inside a penetration testing workbench.

You plan and execute security tests step by step. Use the tools available:
- bash: run a shell command (always requires operator approval)
- create_finding: save a confirmed vulnerability
- finish: end the run with a summary

For each bash call, set `reason` to a short explanation of what you expect to find. Start with light reconnaissance before running heavier scans. Document every confirmed vulnerability with create_finding. When you have finished the engagement objectives, call finish."""

TOOLS: list[dict] = [
    {
        "name": "bash",
        "description": "Execute a shell command. Requires operator approval before running.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The shell command to run"},
                "reason": {"type": "string", "description": "Why this command is needed"},
            },
            "required": ["command", "reason"],
        },
    },
    {
        "name": "create_finding",
        "description": "Save a confirmed security finding to the database.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "severity": {"type": "string", "enum": ["critical", "high", "medium", "low", "info"]},
                "description": {"type": "string"},
                "evidence": {"type": "string"},
                "host": {"type": "string"},
            },
            "required": ["title", "severity", "description"],
        },
    },
    {
        "name": "finish",
        "description": "Mark this agent run as complete.",
        "input_schema": {
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
        },
    },
]


class RunState:
    def __init__(self) -> None:
        self.events: asyncio.Queue[dict | None] = asyncio.Queue()
        self.approval_event = asyncio.Event()
        self.approval_result: bool = False
        self.status = "running"


_runs: dict[str, RunState] = {}


class StartRunRequest(BaseModel):
    goal: str
    scope: str = ""


async def _exec(command: str) -> str:
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        return stdout.decode(errors="replace")[:8000] or "(no output)"
    except asyncio.TimeoutError:
        return "Timed out after 60 s."
    except Exception as exc:
        return f"Error: {exc}"


async def _agent_loop(run_id: str, goal: str, scope: str) -> None:
    state = _runs[run_id]
    messages: list[dict] = [{"role": "user", "content": goal}]
    step_n = 0

    async def emit(event: dict) -> None:
        await state.events.put(event)

    try:
        for _iter in range(25):
            resp = await _client.messages.create(
                model="claude-sonnet-5",
                max_tokens=4096,
                system=SYSTEM + (f"\n\nScope: {scope}" if scope else ""),
                tools=TOOLS,  # type: ignore[arg-type]
                messages=messages,
            )

            tool_results: list[dict] = []

            for block in resp.content:
                if block.type == "text" and block.text.strip():
                    step_n += 1
                    await emit({
                        "type": "step_added",
                        "step": {
                            "id": f"s{step_n}",
                            "label": block.text.split("\n")[0][:80],
                            "detail": block.text,
                            "status": "done",
                        },
                    })

                elif block.type == "tool_use":
                    step_n += 1
                    sid = f"s{step_n}"

                    if block.name == "bash":
                        command = block.input["command"]
                        reason = block.input.get("reason", command[:70])
                        await emit({
                            "type": "step_added",
                            "step": {
                                "id": sid,
                                "label": reason,
                                "status": "waiting",
                                "toolCall": {"tool": "bash", "command": command, "status": "waiting"},
                            },
                        })
                        await emit({"type": "tool_approval_required", "step_id": sid})

                        state.approval_event.clear()
                        await state.approval_event.wait()

                        if state.approval_result:
                            await emit({"type": "step_updated", "step_id": sid, "status": "running", "tool_status": "approved"})
                            output = await _exec(command)
                            await emit({"type": "step_updated", "step_id": sid, "status": "done", "output": output})
                            tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": output})
                        else:
                            await emit({"type": "step_updated", "step_id": sid, "status": "denied", "tool_status": "denied"})
                            tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": "Operator denied."})

                    elif block.name == "create_finding":
                        inp = block.input
                        with Session(engine) as db:
                            f = Finding(
                                title=inp["title"],
                                severity=inp["severity"],
                                description=inp["description"],
                                evidence=inp.get("evidence", ""),
                                host=inp.get("host", ""),
                                status="open",
                            )
                            db.add(f)
                            db.commit()
                        step_n += 1  # re-use sid from outer increment
                        await emit({
                            "type": "step_added",
                            "step": {
                                "id": sid,
                                "label": f"Finding: {inp['title']}",
                                "status": "done",
                                "finding": {"severity": inp["severity"], "title": inp["title"]},
                            },
                        })
                        tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": "Saved."})

                    elif block.name == "finish":
                        step_n += 1
                        await emit({
                            "type": "step_added",
                            "step": {"id": sid, "label": "Run complete", "detail": block.input.get("summary", ""), "status": "done"},
                        })
                        await emit({"type": "done", "status": "completed"})
                        state.status = "done"
                        return

            if resp.stop_reason == "end_turn":
                await emit({"type": "done", "status": "completed"})
                state.status = "done"
                return

            messages.append({"role": "assistant", "content": resp.content})
            if tool_results:
                messages.append({"role": "user", "content": tool_results})

        await emit({"type": "done", "status": "completed"})

    except Exception as exc:
        await emit({"type": "error", "message": str(exc)})
        state.status = "error"
    finally:
        await state.events.put(None)


async def _sse(run_id: str) -> AsyncGenerator[str, None]:
    state = _runs.get(run_id)
    if not state:
        yield f"data: {json.dumps({'type': 'error', 'message': 'not found'})}\n\n"
        return
    while True:
        event = await state.events.get()
        if event is None:
            break
        yield f"data: {json.dumps(event)}\n\n"


@router.post("/agent/runs")
async def start_run(req: StartRunRequest) -> dict:
    run_id = uuid.uuid4().hex[:8]
    _runs[run_id] = RunState()
    asyncio.create_task(_agent_loop(run_id, req.goal, req.scope))
    return {"run_id": run_id}


@router.get("/agent/runs/{run_id}/stream")
async def stream_run(run_id: str) -> StreamingResponse:
    if run_id not in _runs:
        raise HTTPException(404, "Run not found")
    return StreamingResponse(
        _sse(run_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/agent/runs/{run_id}/approve")
async def approve(run_id: str) -> dict:
    state = _runs.get(run_id)
    if not state:
        raise HTTPException(404)
    state.approval_result = True
    state.approval_event.set()
    return {"ok": True}


@router.post("/agent/runs/{run_id}/deny")
async def deny(run_id: str) -> dict:
    state = _runs.get(run_id)
    if not state:
        raise HTTPException(404)
    state.approval_result = False
    state.approval_event.set()
    return {"ok": True}


@router.delete("/agent/runs/{run_id}")
async def stop_run(run_id: str) -> dict:
    state = _runs.pop(run_id, None)
    if state:
        state.approval_result = False
        state.approval_event.set()
        await state.events.put(None)
    return {"ok": True}
