"""Append-only session record. Each entry names who wrote it and when.

Writing to the record never changes how a session works: every failure
while logging is swallowed so the request and the UI keep going.
"""

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models.schemas import Session, SessionEntry

SCHEMA_VERSION = 2
_lock = threading.Lock()

_KIND = {
    "es": {
        "problem": "problema",
        "expertise": "experiencia",
        "themes": "temas",
        "intent": "intención",
        "options": "opciones",
        "stance": "postura",
        "confidence": "confianza",
        "keywords": "palabras",
        "description": "descripción",
        "summary": "resumen",
        "gamechanger": "gamechanger",
        "crux": "supuesto",
        "cards": "tarjetas",
        "choice": "elección",
        "scores": "puntuación",
        "bridge": "puente",
        "message": "mensaje",
        "reply": "respuesta",
        "question": "pregunta",
        "close": "cierre",
        "narrative": "relato",
        "dropped": "descartadas",
        "llm_call": "llamada_modelo",
    },
    "en": {
        "problem": "problem",
        "expertise": "expertise",
        "themes": "themes",
        "intent": "intent",
        "options": "options",
        "stance": "stance",
        "confidence": "confidence",
        "keywords": "keywords",
        "description": "description",
        "summary": "summary",
        "gamechanger": "gamechanger",
        "crux": "crux",
        "cards": "cards",
        "choice": "choice",
        "scores": "scores",
        "bridge": "bridge",
        "message": "message",
        "reply": "reply",
        "question": "question",
        "close": "close",
        "narrative": "narrative",
        "dropped": "dropped",
        "llm_call": "llm_call",
    },
}

_EXPERTISE = {
    "es": {"beginner": "Principiante", "intermediate": "Intermedio", "expert": "Experto"},
    "en": {"beginner": "Beginner", "intermediate": "Intermediate", "expert": "Expert"},
}

_INTENT = {
    "es": {"creativity": "Más creatividad", "balance": "Equilibrio", "functionality": "Más funcionalidad"},
    "en": {"creativity": "More creativity", "balance": "Balance", "functionality": "More functionality"},
}

_MODALITY = {
    "es": {"learning": "Aprendizaje", "development": "Construir", "feedback": "Feedback"},
    "en": {"learning": "Learning", "development": "Build", "feedback": "Feedback"},
}

_ACTION = {
    "es": {"branch": "Una línea nueva hacia abajo", "edit": "Reemplazar la línea actual"},
    "en": {"branch": "A new line downward", "edit": "Replace the current line"},
}

_SPREAD = {
    "es": {"new": "Spread nuevo", "rotate": "Rotar perspectiva"},
    "en": {"new": "A completely new spread", "rotate": "Rotate perspective"},
}


_AUTHOR = {
    "es": {"user": "usuario", "model": "modelo", "system": "sistema", "client": "cliente"},
    "en": {"user": "user", "model": "model", "system": "system", "client": "client"},
}


def stamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def author_name(lang: str, who: str) -> str:
    words = _AUTHOR.get(lang) or _AUTHOR["es"]
    return words.get(who) or who


def log_dir() -> Path:
    return Path(os.getenv("VOGNIS_LOG_DIR", "sessions"))


def _entry_dict(entry: SessionEntry) -> dict[str, Any]:
    item: dict[str, Any] = {
        "seq": entry.seq,
        "at": entry.at,
    }
    if entry.client_at:
        item["client_at"] = entry.client_at
    item.update({
        "author": entry.author,
        "author_key": entry.author_key,
        "kind": entry.kind,
        "kind_key": entry.kind_key,
        "text": entry.text,
    })
    if entry.detail:
        item["detail"] = entry.detail
    return item


def append_line(session_id: str, item: dict[str, Any]) -> None:
    """One JSON line per entry on disk, so a session that never finishes is not lost."""
    try:
        folder = log_dir()
        folder.mkdir(parents=True, exist_ok=True)
        line = json.dumps({"session_id": session_id, **item}, ensure_ascii=False, default=str)
        with open(folder / f"{session_id}.jsonl", "a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except Exception:
        pass


def has_log(session_id: str) -> bool:
    try:
        return (log_dir() / f"{session_id}.jsonl").is_file()
    except Exception:
        return False


def label(lang: str, table: dict[str, dict[str, str]], key: str) -> str:
    words = table.get(lang) or table["es"]
    return words.get(key) or key


def note(
    session: Session,
    who: str,
    kind: str,
    text: str,
    at: str | None = None,
    detail: dict[str, Any] | None = None,
    client_at: str = "",
) -> None:
    try:
        with _lock:
            entry = SessionEntry(
                seq=len(session.record) + 1,
                at=at or stamp(),
                client_at=client_at or "",
                author=author_name(session.lang, who),
                author_key=who,
                kind=label(session.lang, _KIND, kind),
                kind_key=kind,
                text=(text or "").strip(),
                detail=detail or {},
            )
            session.record.append(entry)
        append_line(session.id, _entry_dict(entry))
    except Exception:
        pass


def cards_text(lang: str, cards: list[dict[str, Any]]) -> str:
    layer_word = "layer" if lang == "en" else "capa"
    lines = []
    for card in cards:
        head = card.get("name") or ""
        if card.get("domain"):
            head += f" ({card['domain']})"
        if card.get("layer"):
            head += f" — {layer_word} {card['layer']}"
        lines.append(f"- {head}")
        if card.get("seed"):
            lines.append(f"  {card['seed']}")
    return "\n".join(lines)


def reply_text(intro: str, cards: list[dict[str, Any]]) -> str:
    lines = [intro.strip()] if intro and intro.strip() else []
    for card in cards:
        title = card.get("title") or ""
        body = card.get("body") or ""
        lines.append(f"- {title}: {body}".rstrip(": "))
    return "\n".join(lines).strip()


def score_text(lang: str, name: str, scores) -> str:
    if lang == "en":
        return (
            f"{name}\n"
            f"Innovation value {scores.vi:.2f}. Serendipity {scores.ps:.2f}. "
            f"Quality {scores.ci:.2f}. Penalty {scores.penalty:.2f}."
        )
    return (
        f"{name}\n"
        f"Valor de innovación {scores.vi:.2f}. Serendipia {scores.ps:.2f}. "
        f"Calidad {scores.ci:.2f}. Penalización {scores.penalty:.2f}."
    )


def final_state(session: Session, model: str = "") -> dict[str, Any]:
    ideas = {}
    for idea_id, idea in session.ideas.items():
        ideas[idea_id] = {
            "id": idea.id,
            "parent_id": idea.parent_id,
            "depth": idea.depth,
            "name": idea.card.name,
            "card": idea.card.model_dump(),
            "attribute": idea.attribute,
            "bridge": idea.bridge,
            "scores": idea.scores.model_dump() if idea.scores else None,
            "developments": idea.developments,
        }
    return {
        "model": model,
        "problem": session.problem,
        "summary": session.summary,
        "intent": session.intent.value if session.intent else None,
        "keywords": list(session.keywords),
        "critical_attribute": session.critical_attribute,
        "selected_entities": list(session.selected_entities),
        "concept_bank_history": session.concept_bank_history,
        "modality": session.modality.value,
        "confidence": session.confidence,
        "ideas": ideas,
        "graph_nodes": [node.model_dump() for node in session.graph_nodes],
        "graph_edges": [edge.model_dump() for edge in session.graph_edges],
    }


_ABOUT = {
    "en": (
        "Each entry names the author. user wrote or did it. model is what Vognis proposed. "
        "system is what the server did on its own (model calls, dropped ideas). "
        "client is what the browser showed on its own (idle koans, errors). "
        "seq is the total order. at is server UTC with milliseconds. client_at is the browser clock. "
        "kind_key and author_key are stable English keys. "
        "detail.idea_id and detail.parent_id place each entry in the idea tree. "
        "detail.raw is the exact text the person sent. detail.input_source says typed, voice or mixed. "
        "llm_call entries hold the exact prompt, the raw answer and the latency of every model call. "
        "final_state is the idea tree as it stood at the close."
    ),
    "es": (
        "Cada entrada marca al autor. usuario lo escribió o lo hizo. modelo es lo que propuso Vognis. "
        "sistema es lo que hizo el servidor por su cuenta (llamadas al modelo, ideas descartadas). "
        "cliente es lo que el navegador mostró por su cuenta (koans por inactividad, errores). "
        "seq es el orden total. at es UTC del servidor con milisegundos. client_at es el reloj del navegador. "
        "kind_key y author_key son claves estables en inglés. "
        "detail.idea_id y detail.parent_id ubican cada entrada en el árbol de ideas. "
        "detail.raw es el texto exacto que mandó la persona. detail.input_source dice typed, voice o mixed. "
        "Las entradas llm_call guardan el prompt exacto, la respuesta cruda y la latencia de cada llamada al modelo. "
        "final_state es el árbol de ideas tal como quedó al cerrar."
    ),
}


def record_document(session: Session, finished_at: str, model: str = "") -> dict[str, Any]:
    with _lock:
        entries = [_entry_dict(entry) for entry in session.record]
    return {
        "schema_version": SCHEMA_VERSION,
        "session_id": session.id,
        "started_at": session.started_at,
        "finished_at": finished_at,
        "lang": session.lang,
        "flow": session.flow,
        "about": _ABOUT.get(session.lang) or _ABOUT["es"],
        "entries": entries,
        "final_state": final_state(session, model),
    }
