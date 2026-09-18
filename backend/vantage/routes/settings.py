from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_SETTINGS_FILE = Path(__file__).parent.parent.parent / "settings.json"

_DEFAULTS: dict = {
    "scope_cidr": "",
    "scope_excluded": "",
    "model_provider": "Anthropic (Claude)",
    "model_name": "claude-sonnet-5",
    "api_key": "",
}


def _load() -> dict:
    if _SETTINGS_FILE.exists():
        try:
            return {**_DEFAULTS, **json.loads(_SETTINGS_FILE.read_text())}
        except Exception:
            pass
    return dict(_DEFAULTS)


def _save(data: dict) -> None:
    _SETTINGS_FILE.write_text(json.dumps(data, indent=2))


class Settings(BaseModel):
    scope_cidr: str = ""
    scope_excluded: str = ""
    model_provider: str = "Anthropic (Claude)"
    model_name: str = "claude-sonnet-5"
    api_key: str = ""


@router.get("/settings")
def get_settings() -> Settings:
    return Settings(**_load())


@router.put("/settings")
def update_settings(body: Settings) -> Settings:
    current = _load()
    current.update(body.model_dump())
    _save(current)
    return Settings(**current)
