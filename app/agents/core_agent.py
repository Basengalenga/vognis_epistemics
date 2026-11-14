"""
Core conversational agent that drives the node workflow.
Uses Bedrock API for NLP extraction, synthesis, and concept generation.
"""

import asyncio
import json
from functools import partial

from app.agents.bedrock_client import BedrockError, invoke_model

MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"

CARD_KINDS = {"recommendation", "help", "question", "risk", "step"}


def lang_line(lang: str) -> str:
    if lang == "en":
        return "Respond in English."
    return "Responde en español."


def _parse_json(text: str):
    raw = text.strip()
    if "```" in raw:
        raw = raw.split("```", 1)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.split("```", 1)[0]
    start_obj = raw.find("{")
    start_arr = raw.find("[")
    if start_obj == -1 and start_arr == -1:
        raise ValueError("no json")
    if start_arr != -1 and (start_obj == -1 or start_arr < start_obj):
        raw = raw[start_arr:]
    else:
        raw = raw[start_obj:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        if not raw.lstrip().startswith("["):
            raise
        last = raw.rfind("}")
        if last == -1:
            raise
        return json.loads(raw[: last + 1] + "]")


def _clamp(value, default=0.5) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


async def _ask(messages: list[dict], max_tokens: int, system: str | None = None) -> str:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            invoke_model,
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        ),
    )
    return result["content"][0]["text"].strip()


async def extract_keywords(problem: str, expertise: str, themes: list[str], lang: str = "es") -> list[str]:
    """Node 1: Extract and normalize keywords from user problem."""
    themes_str = ", ".join(themes) if themes else "none specified"
    text = await _ask(
        [{
            "role": "user",
            "content": (
                f"{lang_line(lang)}\n"
                f"Extract 8-12 key concepts/keywords from this problem description. "
                f"User expertise: {expertise}. Interest themes: {themes_str}.\n\n"
                f"Problem: {problem}\n\n"
                f"Respond ONLY with a JSON array of strings. Example: [\"keyword1\", \"keyword2\"]"
            ),
        }],
        max_tokens=300,
    )
    data = _parse_json(text)
    if not isinstance(data, list):
        raise BedrockError("Keyword extraction did not return a list")
    return [str(item) for item in data if str(item).strip()]


async def synthesize_summary(problem: str, keywords: list[str], lang: str = "es") -> str:
    """Node 2: Create an executive summary of the problem."""
    return await _ask(
        [{
            "role": "user",
            "content": (
                f"{lang_line(lang)}\n"
                f"Synthesize this problem into a brief executive summary (2-3 sentences). "
                f"Be encouraging and open to creative possibilities.\n\n"
                f"Problem: {problem}\n"
                f"Key concepts: {', '.join(keywords)}\n\n"
                f"Respond with ONLY the summary text, no formatting."
            ),
        }],
        max_tokens=300,
    )


def _card_from_raw(raw: dict, fallback_layer: int) -> dict | None:
    name = str(raw.get("name") or "").strip()
    if not name:
        return None
    radar_raw = raw.get("radar") or {}
    radar = {
        key: _clamp(radar_raw.get(key))
        for key in (
            "abstraction",
            "connectivity",
            "novelty",
            "applicability",
            "epistemic_confidence",
            "conceptual_distance",
        )
    }
    try:
        layer = int(raw.get("layer") or fallback_layer)
    except (TypeError, ValueError):
        layer = fallback_layer
    layer = min(3, max(1, layer))
    return {
        "name": name,
        "domain": str(raw.get("domain") or "").strip(),
        "seed": str(raw.get("seed") or "").strip(),
        "description": str(raw.get("description") or "").strip(),
        "wiki_title": str(raw.get("wiki_title") or name).strip(),
        "origin_keyword": str(raw.get("origin_keyword") or "").strip(),
        "reasoning": str(raw.get("reasoning") or "").strip(),
        "layer": layer,
        "radar": radar,
    }


async def generate_concept_bank(
    problem: str,
    keywords: list[str],
    critical_attribute: str,
    lang: str = "es",
    mode: str = "new",
    previous: list[str] | None = None,
) -> list[dict]:
    """Node 3: 12 epistemic cards, four per connection layer."""
    avoided = ", ".join(previous or []) or "none"
    if mode == "rotate":
        angle = (
            "Keep the same base ingredients (the keywords and the critical attribute) "
            "but change the angle of alienation. Same ingredients, a new recipe. "
            "Do not repeat any name from the previous spread."
        )
    else:
        angle = (
            "Generate a completely different spread. Do not repeat names from earlier spreads."
        )
    text = await _ask(
        [{
            "role": "user",
            "content": (
                f"{lang_line(lang)}\n"
                f"You are a creative serendipity engine. Generate exactly 12 concept cards "
                f"from distant domains that could connect with the problem.\n"
                f"{angle}\n\n"
                f"Problem: {problem}\n"
                f"Keywords: {', '.join(keywords)}\n"
                f"Critical attribute: {critical_attribute}\n"
                f"Names to avoid: {avoided}\n\n"
                f"Four cards per layer:\n"
                f"1 = directly related, 2 = second-order connection, 3 = a large conceptual jump.\n"
                f"Keep every text field short. "
                f"Each card is an object with: name, domain, seed (one short sentence), "
                f"description (two short sentences), wiki_title (a real Wikipedia article title), "
                f"origin_keyword (one of the keywords), reasoning "
                f"(one sentence: this idea appeared because you connected X with Y; the shared pattern is Z), "
                f"layer (1, 2, or 3), and radar with numbers from 0 to 1 for abstraction, "
                f"connectivity, novelty, applicability, epistemic_confidence, conceptual_distance.\n"
                f"Respond ONLY with a JSON array of 12 objects."
            ),
        }],
        max_tokens=4500,
    )
    try:
        data = _parse_json(text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise BedrockError("Concept bank was not readable") from exc
    if not isinstance(data, list):
        raise BedrockError("Concept bank did not return a list")
    cards = []
    for index, raw in enumerate(data):
        if not isinstance(raw, dict):
            continue
        card = _card_from_raw(raw, fallback_layer=(index // 4) + 1)
        if card:
            cards.append(card)
    if not cards:
        raise BedrockError("Concept bank came back empty")
    return cards[:12]


CONFIDENCE_TONES = {
    1: "You are a safe, supportive guide. Be gentle and encouraging.",
    2: "You are a friendly advisor. Offer balanced perspectives.",
    3: "You are a thoughtful collaborator. Challenge gently when needed.",
    4: "You are a rigorous critic. Push the user to think deeper.",
    5: "You are a radical provocateur. Challenge every assumption ruthlessly.",
}

MODALITY_INSTRUCTIONS = {
    "learning": (
        "The user is in LEARNING mode: pure exploration. "
        "Help them understand the connections between concepts freely. "
        "Do NOT judge viability. Encourage curiosity and wandering."
    ),
    "development": (
        "The user is in DEVELOPMENT mode: functional construction. "
        "Help them build concrete, viable applications of the concepts. "
        "Push for practical implementation and real-world anchoring."
    ),
    "feedback": (
        "The user is in FEEDBACK mode: critical analysis. "
        "Provide a thorough, honest critique of the current branch. "
        "Identify weaknesses, blind spots, and improvement opportunities."
    ),
}


def _board_text(board: dict | None) -> str:
    if not board:
        return "The user has not linked anything yet."
    lines = []
    for link in board.get("links") or []:
        lines.append(
            f"Link: {link.get('from') or link.get('source')} — {link.get('label') or 'related'} — "
            f"{link.get('to') or link.get('target')}"
        )
    for note in board.get("notes") or []:
        attached = note.get("attached_to") or "the board"
        lines.append(f"Note on {attached}: {note.get('text')}")
    return "\n".join(lines) if lines else "The user has not linked anything yet."


def _cards_from_raw(raw) -> list[dict]:
    cards = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        body = str(item.get("body") or "").strip()
        if not title and not body:
            continue
        kind = str(item.get("kind") or "help")
        if kind not in CARD_KINDS:
            kind = "help"
        concepts = item.get("concepts") or []
        if isinstance(concepts, str):
            concepts = [concepts]
        cards.append({
            "kind": kind,
            "title": title or kind,
            "body": body,
            "concepts": [str(name) for name in concepts if str(name).strip()],
        })
    return cards[:5]


async def node4_respond(
    problem: str,
    summary: str,
    keywords: list[str],
    entities: list[str],
    modality: str,
    confidence: int,
    conversation: list[dict[str, str]],
    user_message: str,
    lang: str = "es",
    board: dict | None = None,
) -> dict:
    """Node 4: short intro plus cards tied to the concepts on the board."""
    system = (
        f"{lang_line(lang)}\n"
        f"You are Vognis, a creative AI workspace assistant.\n\n"
        f"Problem: {problem}\n"
        f"Summary: {summary}\n"
        f"Core keywords: {', '.join(keywords)}\n"
        f"Selected concepts: {', '.join(entities)}\n\n"
        f"{MODALITY_INSTRUCTIONS[modality]}\n"
        f"{CONFIDENCE_TONES[confidence]}\n\n"
        f"What the user has on the board right now:\n{_board_text(board)}\n\n"
        f"Reply ONLY with JSON of this shape: "
        f'{{"intro": "one sentence", "cards": [{{"kind": "recommendation|help|question|risk|step", '
        f'"title": "short title", "body": "at most 40 words", "concepts": ["concept name"]}}]}}. '
        f"Return 2 to 5 cards. Each card must name one or more of the selected concepts. "
        f"Do not write a long paragraph."
    )
    messages = conversation + [{"role": "user", "content": user_message}]
    text = await _ask(messages, max_tokens=800, system=system)
    try:
        data = _parse_json(text)
        intro = str(data.get("intro") or "").strip()
        cards = _cards_from_raw(data.get("cards"))
        if intro or cards:
            return {"intro": intro, "cards": cards}
    except (ValueError, AttributeError, json.JSONDecodeError, TypeError):
        pass
    return {"intro": text, "cards": []}


async def summarize_session(session) -> tuple[str, list[str]]:
    """Narrative of how the ideas were connected, plus the key bridges."""
    board_bits = []
    for mode, board in (session.boards or {}).items():
        links = board.links if hasattr(board, "links") else []
        notes = board.notes if hasattr(board, "notes") else []
        for link in links:
            board_bits.append(f"{mode}: {link.source} — {link.label} — {link.target}")
        for note in notes:
            board_bits.append(f"{mode} note: {note.text}")
    text = await _ask(
        [{
            "role": "user",
            "content": (
                f"{lang_line(session.lang)}\n"
                f"Write a short narrative of how this person connected their ideas, "
                f"then list the key bridges.\n\n"
                f"Problem: {session.problem}\n"
                f"Summary: {session.summary}\n"
                f"Keywords: {', '.join(session.keywords)}\n"
                f"Chosen concepts: {', '.join(session.selected_entities)}\n"
                f"Board links and notes:\n" + ("\n".join(board_bits) or "none") + "\n\n"
                f'Respond ONLY with JSON: {{"summary": "one paragraph", "bridges": ["bridge 1"]}}'
            ),
        }],
        max_tokens=700,
    )
    try:
        data = _parse_json(text)
        summary = str(data.get("summary") or "").strip()
        bridges = [str(item) for item in data.get("bridges") or [] if str(item).strip()]
        if summary:
            return summary, bridges
    except (ValueError, AttributeError, json.JSONDecodeError, TypeError):
        pass
    fallback = session.summary or session.problem
    return fallback, list(session.selected_entities)
