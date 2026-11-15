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
    try:
        data = _parse_json(text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise BedrockError("Keyword extraction was not readable") from exc
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


def gamechanger_block(text: str) -> str:
    """One definition for every prompt that receives the user's attribute."""
    written = (text or "").strip() or "none"
    return (
        f"Gamechanger: {written}\n"
        "The gamechanger is the attribute that, once solved, changes the game: "
        "a clear before and after, not a small improvement."
    )


def crux_block(text: str, options: list[str] | None = None, stance: str = "") -> str:
    """The decision's load-bearing assumption. The model must not pick an option."""
    written = (text or "").strip() or "none"
    listed = ", ".join(item for item in (options or []) if str(item).strip()) or "none"
    lean = (stance or "").strip() or "none"
    return (
        f"Crux: {written}\n"
        "The crux is the assumption that, if it fell, would bring the decision down.\n"
        f"Options: {listed}\n"
        f"The person currently leans toward: {lean}\n"
        "Never say which option to choose."
    )


def _aim_block(flow: str, text: str, options: list[str] | None = None, stance: str = "") -> str:
    if flow == "decide":
        return crux_block(text, options, stance)
    return gamechanger_block(text)


async def generate_concept_bank(
    problem: str,
    keywords: list[str],
    critical_attribute: str,
    lang: str = "es",
    mode: str = "new",
    previous: list[str] | None = None,
    origin: str = "",
    flow: str = "create",
    options: list[str] | None = None,
    stance: str = "",
) -> list[dict]:
    """Node 3: 12 epistemic cards, four per connection layer."""
    avoided = ", ".join(previous or []) or "none"
    origin_block = origin.strip() or "Start from the problem itself."
    deciding = flow == "decide"
    aim_name = "crux" if deciding else "gamechanger"
    if mode == "rotate":
        angle = (
            f"Keep the same base ingredients (the keywords and the {aim_name}) "
            "but change the angle of alienation. Same ingredients, a new recipe. "
            "Do not repeat any name from the previous spread."
        )
    else:
        angle = (
            "Generate a completely different spread. Do not repeat names from earlier spreads."
        )
    if deciding:
        role = (
            "You are a creative serendipity engine. Generate exactly 12 concept cards "
            "from distant domains. Each card is a perspective that tests the crux. "
            "None of them recommends an option.\n"
        )
        aim = (
            "Every card should put the crux under pressure from another field. "
            "Cards in layer 3 may do that by changing how the decision is seen. "
            "Do not name a winning option.\n"
        )
        because = "say how it tests the crux"
    else:
        role = (
            "You are a creative serendipity engine. Generate exactly 12 concept cards "
            "from distant domains that could connect with the problem.\n"
        )
        aim = (
            "Every card should be a possible path toward the gamechanger. "
            "Cards in layer 3 may get there by changing how the problem is seen.\n"
        )
        because = "say how it moves toward the gamechanger"
    text = await _ask(
        [{
            "role": "user",
            "content": (
                f"{lang_line(lang)}\n"
                f"{role}"
                f"{angle}\n\n"
                f"Problem: {problem}\n"
                f"Keywords: {', '.join(keywords)}\n"
                f"{_aim_block(flow, critical_attribute, options, stance)}\n"
                f"{aim}"
                f"{origin_block}\n"
                f"Names to avoid: {avoided}\n\n"
                f"Four cards per layer:\n"
                f"1 = directly related, 2 = second-order connection, 3 = a large conceptual jump.\n"
                f"Keep every text field short. "
                f"Each card is an object with: name, domain, seed (one short sentence), "
                f"description (two short sentences), wiki_title (a real Wikipedia article title), "
                f"origin_keyword (one of the keywords), reasoning "
                f"(one sentence: this idea appeared because you connected X with Y; "
                f"the shared pattern is Z; {because}), "
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
        "The user is in LEARNING mode. You are a Socratic coach. "
        "Do not propose solutions or lists of ideas. "
        "Reflect back what the user said in one sentence, using their words. "
        "Then ask 1 to 3 open questions about meaning, assumptions, or patterns elsewhere, "
        "anchored in the user's bridge and the gamechanger. "
        "Do not judge whether it works."
    ),
    "development": (
        "The user is in DEVELOPMENT mode. You are a Socratic coach. "
        "Do not tell the user what to build. "
        "Reflect back what the user said in one sentence, using their words. "
        "Then ask 1 to 3 questions that move them from the before to the after of the gamechanger: "
        "the smallest test, what must be true, and how they would know it worked. "
        "If they say they are stuck, give one hint, not an answer."
    ),
    "feedback": (
        "The user is in FEEDBACK mode. "
        "Give your honest view: does this change the game or only improve something, "
        "and what blocks the gamechanger. "
        "No generic praise. Hold your point unless the user brings a new argument. "
        "End with one question that asks the user to defend or revise."
    ),
}

MODALITY_INSTRUCTIONS_DECIDE = {
    "learning": (
        "The user is in LEARNING mode. You are a Socratic coach. "
        "Do not propose which option to choose, and do not propose solutions. "
        "Reflect back what the user said in one sentence, using their words. "
        "Then ask 1 to 3 open questions about the assumption, anchored in the user's bridge and the crux. "
        "Do not judge whether the decision is right."
    ),
    "development": (
        "The user is in DEVELOPMENT mode. You are a Socratic coach. "
        "Do not tell the user what to choose. "
        "Reflect back what the user said in one sentence, using their words. "
        "Then ask 1 to 3 questions about how they would check the assumption before deciding: "
        "the smallest check, what must be true, and how they would know. "
        "If they say they are stuck, give one hint, not an answer."
    ),
    "feedback": (
        "The user is in FEEDBACK mode. "
        "Give your honest view of how well the reasoning holds and what weakens the crux. "
        "Do not say which option to choose. "
        "No generic praise. Hold your point unless the user brings a new argument. "
        "End with one question that asks the user to defend or revise."
    ),
}


def _reply_shape(modality: str, flow: str = "create") -> str:
    hold = " Never say which option to choose." if flow == "decide" else ""
    if modality in ("learning", "development"):
        return (
            'Reply ONLY with JSON: {"intro": "one sentence reflecting the user\'s words, not a proposal", '
            '"cards": [{"kind": "question", "title": "short title", "body": "one open question", '
            '"concepts": ["concept name"]}]}. '
            "Return 1 to 3 cards, and every card is a question. "
            "A help card is allowed only when the user says they are stuck, and its body is one hint, not an answer. "
            "Do not give a solution, a list of ideas, or a step. "
            "How demanding you are changes how hard the questions are, never whether you answer them."
            + hold
        )
    view = "your honest view of the reasoning in one sentence, not a recommended option" if flow == "decide" else "your honest view in one sentence"
    return (
        'Reply ONLY with JSON: {"intro": "' + view + '", '
        '"cards": [{"kind": "recommendation|help|question|risk|step", "title": "short title", '
        '"body": "at most 40 words", "concepts": ["concept name"]}]}. '
        "Return 2 to 5 cards. The last card must be a question that asks the user to defend or revise. "
        "No generic praise. How demanding you are changes how hard the critique is."
        + hold
    )


def _focus_text(focus: dict | None) -> str:
    if not focus:
        return "No idea is in focus."
    path = " › ".join(focus.get("path") or [])
    flow = focus.get("flow") or "create"
    if flow == "decide":
        reached = "This is the assumption the idea in focus is meant to test."
    else:
        reached = "This is the gamechanger the idea in focus is meant to reach."
    return (
        f"Idea in focus: {focus.get('name')}\n"
        f"Seed: {focus.get('seed')}\n"
        f"{_aim_block(flow, focus.get('attribute') or '', focus.get('options'), focus.get('stance') or '')}\n"
        f"{reached}\n"
        f"Path from the problem: {path or focus.get('name')}\n"
        f"The user's own bridge, which you must develop and not replace: {focus.get('bridge') or 'none'}"
    )


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


def _shape_cards(modality: str, cards: list[dict]) -> list[dict]:
    """Keep the coach shape even if the model slips back into giving answers."""
    if modality not in ("learning", "development"):
        questions = [card for card in cards if card["kind"] == "question"]
        others = [card for card in cards if card["kind"] != "question"]
        return (others + questions)[:5]
    questions = [card for card in cards if card["kind"] == "question"][:3]
    hints = [card for card in cards if card["kind"] == "help"][:1]
    if questions:
        return (questions + hints)[:3]
    return hints[:1]


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
    focus: dict | None = None,
    flow: str = "create",
) -> dict:
    """Node 4: short intro plus cards about the idea in focus."""
    if focus is not None:
        focus = {**focus, "flow": flow}
    instructions = MODALITY_INSTRUCTIONS_DECIDE if flow == "decide" else MODALITY_INSTRUCTIONS
    hold = "Never say which option to choose.\n" if flow == "decide" else ""
    system = (
        f"{lang_line(lang)}\n"
        f"You are Vognis, a creative AI workspace assistant.\n\n"
        f"Problem: {problem}\n"
        f"Summary: {summary}\n"
        f"Core keywords: {', '.join(keywords)}\n"
        f"Selected concepts: {', '.join(entities)}\n\n"
        f"{instructions[modality]}\n"
        f"{hold}"
        f"{CONFIDENCE_TONES[confidence]}\n\n"
        f"{_focus_text(focus)}\n\n"
        f"{_reply_shape(modality, flow)} "
        f"Each card must name one or more of the selected concepts. "
        f"Do not write a long paragraph."
    )
    messages = conversation + [{"role": "user", "content": user_message}]
    text = await _ask(messages, max_tokens=800, system=system)
    try:
        data = _parse_json(text)
        intro = str(data.get("intro") or "").strip()
        cards = _shape_cards(modality, _cards_from_raw(data.get("cards")))
        if intro or cards:
            return {"intro": intro, "cards": cards}
    except (ValueError, AttributeError, json.JSONDecodeError, TypeError):
        pass
    return {"intro": text, "cards": []}


def _ancestor_path(ideas: dict, node, flow: str = "create") -> str:
    label = "crux" if flow == "decide" else "gamechanger"
    chain = []
    current = node
    seen = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        if current.attribute:
            chain.append(f"{current.card.name} ({label}: {current.attribute})")
        else:
            chain.append(current.card.name)
        current = ideas.get(current.parent_id) if current.parent_id else None
    return " › ".join(reversed(chain))


def idea_path_names(ideas: dict, node) -> list[str]:
    names = []
    current = node
    seen = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        names.append(current.card.name)
        current = ideas.get(current.parent_id) if current.parent_id else None
    return list(reversed(names))


def branch_names(ideas: dict, parent_id: str | None) -> list[str]:
    names: list[str] = []
    current_id = parent_id
    seen = set()
    while current_id and current_id not in seen:
        seen.add(current_id)
        node = ideas.get(current_id)
        if node is None:
            break
        names.append(node.card.name)
        current_id = node.parent_id
    if parent_id:
        for idea in ideas.values():
            if idea.parent_id == parent_id and idea.card.name not in names:
                names.append(idea.card.name)
    return names


def _tree_lines(session) -> str:
    ideas = session.ideas or {}
    if not ideas:
        return "none"
    flow = getattr(session, "flow", "create") or "create"
    lines = []
    for node in ideas.values():
        line = _ancestor_path(ideas, node, flow)
        if node.bridge:
            line += f" — puente: {node.bridge}"
        lines.append(line)
        for dev in node.developments or []:
            intro = dev.get("intro") or ""
            lines.append(f"  {dev.get('modality')}: {dev.get('user_message')} -> {intro}")
    return "\n".join(lines)


async def generate_koan(
    lang: str,
    step: str,
    problem: str,
    idea_name: str | None = None,
    attribute: str = "",
    flow: str = "create",
    options: list[str] | None = None,
    stance: str = "",
) -> str:
    """One paradoxical question. No advice and no answer."""
    focus = idea_name or "the problem the person just wrote"
    hold = " Do not say which option to choose." if flow == "decide" else ""
    text = await _ask(
        [{
            "role": "user",
            "content": (
                f"{lang_line(lang)}\n"
                f"Write one short paradoxical question, in the spirit of a Zen koan. "
                f"It should loosen a fixed way of seeing, without giving advice, a method, or an answer."
                f"{hold} "
                f"One sentence only. No preamble.\n\n"
                f"Step: {step or 'unspecified'}\n"
                f"Problem: {problem}\n"
                f"Idea in view: {focus}\n"
                f"{_aim_block(flow, attribute, options, stance)}"
            ),
        }],
        max_tokens=120,
    )
    line = text.strip().strip('"').split("\n", 1)[0].strip()
    if not line:
        raise BedrockError("Koan was empty")
    return line[:280]


async def summarize_session(session) -> tuple[str, list[str]]:
    """Narrative of how the ideas were connected, plus the key bridges."""
    flow = getattr(session, "flow", "create") or "create"
    if flow == "decide":
        task = (
            "Write a short narrative of which assumption was tested and what moved "
            "in the person's stance. Do not say which option they should choose. "
            "Then list the key bridges.\n\n"
            f"Decision: {session.problem}\n"
            f"Options: {', '.join(session.options)}\n"
            f"Leaned toward at the start: {session.stance or 'none'} "
            f"(confidence {session.confidence_start})\n"
            f"At the close: {session.final_stance or 'none'} "
            f"(confidence {session.final_confidence})\n"
            f"What would make them let go: {session.abandonment or 'none'}\n"
            f"Review date: {session.review_date or 'none'}\n"
        )
        tree_label = "crux"
    else:
        task = (
            "Write a short narrative of how this person connected their ideas, "
            "and whether those branches approached the gamechanger, "
            "then list the key bridges.\n\n"
            f"Problem: {session.problem}\n"
        )
        tree_label = "gamechanger"
    text = await _ask(
        [{
            "role": "user",
            "content": (
                f"{lang_line(session.lang)}\n"
                f"{task}"
                f"Summary: {session.summary}\n"
                f"Keywords: {', '.join(session.keywords)}\n"
                f"{_aim_block(flow, session.critical_attribute, getattr(session, 'options', None), getattr(session, 'stance', '') or '')}\n"
                f"Idea tree (path, {tree_label}, developments):\n{_tree_lines(session)}\n\n"
                f'Respond ONLY with JSON: {{"summary": "one paragraph", "bridges": ["bridge 1"]}}'
            ),
        }],
        max_tokens=700,
    )
    try:
        data = _parse_json(text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise BedrockError("El resumen no se pudo leer") from exc
    if not isinstance(data, dict):
        raise BedrockError("El resumen no se pudo leer")
    summary = str(data.get("summary") or "").strip()
    bridges = [str(item) for item in data.get("bridges") or [] if str(item).strip()]
    if not summary:
        raise BedrockError("El resumen no se pudo leer")
    return summary, bridges
