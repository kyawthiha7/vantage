from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Mission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    scope: str = ""
    created_at: datetime = Field(default_factory=_now)


class Finding(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    mission_id: Optional[int] = Field(default=None, foreign_key="mission.id")
    title: str
    severity: str  # critical | high | medium | low | info
    host: str = ""
    port: Optional[str] = None
    description: str = ""
    evidence: str = ""
    status: str = "open"  # open | resolved | accepted
    created_at: datetime = Field(default_factory=_now)


class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str
    role: str  # user | assistant
    content: str
    created_at: datetime = Field(default_factory=_now)
