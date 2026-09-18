from __future__ import annotations

import asyncio
import fcntl
import json
import logging
import os
import pty
import struct
import termios

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
log = logging.getLogger(__name__)


def _make_preexec(slave_fd: int):
    def preexec() -> None:
        os.setsid()
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
    return preexec


@router.websocket("/ws/terminal/{session_id}")
async def terminal_ws(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    log.info("terminal_ws: accepted session=%s", session_id)

    master_fd, slave_fd = pty.openpty()
    fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 80, 0, 0))

    env = {**os.environ, "TERM": "xterm-256color", "COLORTERM": "truecolor"}
    shell = os.environ.get("SHELL", "/bin/zsh")
    log.info("terminal_ws: spawning shell=%s", shell)

    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            shell,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            env=env,
            preexec_fn=_make_preexec(slave_fd),
            close_fds=True,
        )
        log.info("terminal_ws: shell pid=%s", proc.pid)
    except Exception as exc:
        log.exception("terminal_ws: subprocess spawn failed: %s", exc)
        try:
            await websocket.send_text(f"\r\n[shell spawn failed: {exc}]\r\n")
        except Exception:
            pass
        os.close(slave_fd)
        os.close(master_fd)
        return
    finally:
        if proc is not None:
            os.close(slave_fd)

    loop = asyncio.get_event_loop()
    send_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    def _on_readable() -> None:
        try:
            data = os.read(master_fd, 4096)
            send_queue.put_nowait(data)
        except OSError:
            send_queue.put_nowait(None)
            loop.remove_reader(master_fd)

    loop.add_reader(master_fd, _on_readable)

    async def _sender() -> None:
        while True:
            chunk = await send_queue.get()
            if chunk is None:
                break
            try:
                await websocket.send_bytes(chunk)
            except Exception:
                break

    sender = asyncio.create_task(_sender())

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            # accept both text (resize JSON) and binary (terminal input)
            raw: bytes | str = message.get("bytes") or message.get("text") or b""
            if not raw:
                continue
            try:
                text = raw if isinstance(raw, str) else raw.decode("utf-8", errors="replace")
                parsed = json.loads(text)
                if parsed.get("type") == "resize":
                    cols = max(10, int(parsed.get("cols", 80)))
                    rows = max(2, int(parsed.get("rows", 24)))
                    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
                    continue
            except (ValueError, UnicodeDecodeError):
                pass
            data = raw if isinstance(raw, bytes) else raw.encode("utf-8")
            try:
                os.write(master_fd, data)
            except OSError:
                break
    except WebSocketDisconnect:
        pass
    finally:
        loop.remove_reader(master_fd)
        sender.cancel()
        try:
            proc.terminate()
            await asyncio.wait_for(proc.wait(), timeout=2)
        except (ProcessLookupError, asyncio.TimeoutError):
            pass
        try:
            os.close(master_fd)
        except OSError:
            pass
