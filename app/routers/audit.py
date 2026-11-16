"""Audit of an open session: statement graph and human-provenance metrics.

It works on a snapshot of the same JSON that "finish" downloads (record_document),
taken without finishing anything: no finish, no close, no narrative, no state change.
The model calls it makes are never written into the session record.
"""

import asyncio
import json
import uuid

from fastapi import APIRouter, HTTPException

from app.agents.core_agent import MODEL
from app.audit.graph import CachedExtractor, build_graph, extract_events
from app.audit.metrics import metrics_document
from app.engine.record import log_dir, record_document, stamp
from app.routers.workflow import _sessions

router = APIRouter(prefix="/api/v1", tags=["audit"])

# One job per session. A click while one runs joins it instead of starting another.
_jobs: dict[str, dict] = {}


def snapshot(session) -> dict:
    """The session JSON as "finish" builds it, as of now. Reads only."""
    return json.loads(json.dumps(record_document(session, stamp(), MODEL), ensure_ascii=False, default=str))


def cache_dir(session_id: str):
    return log_dir() / "audit-cache" / session_id


def _run(job: dict, document: dict) -> None:
    """Runs in a worker thread."""
    extractor = CachedExtractor(cache_dir(job["session_id"]), MODEL)
    try:
        events = extract_events(document["entries"])
        job["total"] = len(events)

        def progress(done, total):
            job["done"], job["total"], job["fresh"] = done, total, extractor.fresh

        graph = build_graph(events, extractor, progress)
        job["fresh"] = extractor.fresh
        job["result"] = {"graph": graph, "metrics": metrics_document(graph)}
        job["state"] = "done"
    except Exception as exc:
        job["fresh"] = extractor.fresh
        job["error"] = f"{type(exc).__name__}: {exc}"
        job["state"] = "error"


def _view(job: dict) -> dict:
    out = {key: job[key] for key in ("job_id", "state", "done", "total", "fresh", "snapshot_at", "entries")}
    if job["state"] == "done":
        out.update(job["result"])
    if job["state"] == "error":
        out["error"] = job["error"]
    return out


@router.post("/session/{session_id}/audit")
async def start_audit(session_id: str):
    session = _sessions.get(session_id)  # not _get_session: that would bind the session for llm_call logging
    if session is None:
        raise HTTPException(404, f"Session {session_id} not found")
    running = _jobs.get(session_id)
    if running and running["state"] == "running":
        return _view(running)
    document = snapshot(session)
    job = {
        "job_id": uuid.uuid4().hex[:8],
        "session_id": session_id,
        "state": "running",
        "done": 0,
        "total": 0,
        "fresh": 0,
        "snapshot_at": document["finished_at"],
        "entries": len(document["entries"]),
    }
    _jobs[session_id] = job
    asyncio.get_running_loop().run_in_executor(None, _run, job, document)
    return _view(job)


@router.get("/session/{session_id}/audit")
async def audit_status(session_id: str):
    job = _jobs.get(session_id)
    if job is None:
        raise HTTPException(404, "No audit for this session")
    return _view(job)
