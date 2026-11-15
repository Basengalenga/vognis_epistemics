"""Append-only session record. Each entry names who wrote it and when."""

from datetime import datetime, timezone
from typing import Any

from app.models.schemas import Session, SessionEntry

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


def stamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def author_name(lang: str, who: str) -> str:
    if lang == "en":
        return "user" if who == "user" else "model"
    return "usuario" if who == "user" else "modelo"


def label(lang: str, table: dict[str, dict[str, str]], key: str) -> str:
    words = table.get(lang) or table["es"]
    return words.get(key) or key


def note(session: Session, who: str, kind: str, text: str, at: str | None = None, detail: dict[str, Any] | None = None) -> None:
    session.record.append(SessionEntry(
        at=at or stamp(),
        author=author_name(session.lang, who),
        kind=label(session.lang, _KIND, kind),
        text=(text or "").strip(),
        detail=detail or {},
    ))


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


def record_document(session: Session, finished_at: str) -> dict[str, Any]:
    if session.lang == "en":
        about = "Each entry names the author. user wrote it. model is what Vognis proposed. at is UTC."
    else:
        about = "Cada entrada marca al autor. usuario lo escribió. modelo es lo que propuso Vognis. at está en UTC."
    entries = []
    for entry in session.record:
        item = {
            "at": entry.at,
            "author": entry.author,
            "kind": entry.kind,
            "text": entry.text,
        }
        if entry.detail:
            item["detail"] = entry.detail
        entries.append(item)
    return {
        "session_id": session.id,
        "started_at": session.started_at,
        "finished_at": finished_at,
        "lang": session.lang,
        "flow": session.flow,
        "about": about,
        "entries": entries,
    }
