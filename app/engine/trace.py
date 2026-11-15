"""Logs every model call into the session record. Logging never changes the call."""

import asyncio
import time
from contextvars import ContextVar
from functools import partial
from typing import Any

from app.agents.bedrock_client import invoke_model
from app.engine.record import note

_session: ContextVar[Any] = ContextVar("vognis_session", default=None)
_agents: ContextVar[dict | None] = ContextVar("vognis_agents", default=None)


def bind(session) -> None:
    """Calls made while handling this request are logged into this session."""
    _session.set(session)


def set_agents(details: dict) -> None:
    _agents.set(details)


def take_agents() -> dict:
    details = _agents.get() or {}
    _agents.set(None)
    return details


def _log(purpose: str, model: str, system, messages, max_tokens, raw, error, started, finished) -> None:
    session = _session.get()
    if session is None:
        return
    try:
        detail = {
            "purpose": purpose,
            "model": model,
            "max_tokens": max_tokens,
            "system": system or "",
            "messages": messages,
            "response": raw,
            "latency_ms": int((finished - started) * 1000),
        }
        if error:
            detail["error"] = error
        note(session, "system", "llm_call", purpose + (" (error)" if error else ""), detail=detail)
    except Exception:
        pass


async def call(
    purpose: str,
    model: str,
    messages: list[dict],
    max_tokens: int,
    system: str | None = None,
) -> dict:
    """Same as invoke_model run in a thread, plus a record entry with prompt, answer and latency."""
    loop = asyncio.get_event_loop()
    started = time.monotonic()
    try:
        result = await loop.run_in_executor(
            None,
            partial(invoke_model, model=model, max_tokens=max_tokens, system=system, messages=messages),
        )
    except Exception as exc:
        _log(purpose, model, system, messages, max_tokens, None, f"{type(exc).__name__}: {exc}", started, time.monotonic())
        raise
    try:
        raw = result["content"][0]["text"]
    except Exception:
        raw = result
    _log(purpose, model, system, messages, max_tokens, raw, "", started, time.monotonic())
    return result
