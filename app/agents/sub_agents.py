"""
Sub-Agent system: 6 specialized judges that score concepts via Claude API.

Serendipity Group: Divergence(DC), Rarity(NC), Originality(T)
Viability Group:   Analogy(VS), Impact(MP), Anchoring(PCF)
"""

import asyncio
import json
from contextvars import ContextVar

from app.engine import trace
from app.agents.core_agent import lang_line
from app.models.schemas import AgentScores

MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"

_details: ContextVar[dict | None] = ContextVar("vognis_agent_details", default=None)


AGENT_PROMPTS: dict[str, str] = {
    "dc": (
        "You are the Divergence Agent. Score how conceptually distant "
        "the proposed entity is from the base concept. "
        "0 = identical domain, 1 = completely alien domain."
    ),
    "nc": (
        "You are the Rarity Agent. Score how rare this specific proposed connection is. "
        "Measure the inverse of search density for this particular pairing — "
        "how unlikely someone would arrive at this exact link. "
        "0 = very common/obvious connection, 1 = extremely rare and valuable connection."
    ),
    "t": (
        "You are the Originality Agent (Touché factor). You are a blind evaluator: "
        "score the originality of the proposed connection without prior context. "
        "0 = trivial/obvious, 1 = paradigm-shifting."
    ),
    "vs": (
        "You are the Functional Analogy Agent. Score whether real precedents "
        "of a similar jump exist in another field: a change that resembles the gamechanger. "
        "0 = no such precedent, 1 = a clear proven jump of the same kind exists."
    ),
    "mp": (
        "You are the Impact Projection Agent. Score the size of the before-and-after "
        "the gamechanger describes, if this concept helped reach it. "
        "0 = a small improvement, 1 = it changes the game."
    ),
    "pcf": (
        "You are the Anchoring Agent. Score how many functional contact points "
        "exist between the entity and the concept. "
        "0 = no functional overlap, 1 = deep functional integration."
    ),
}

DECIDE_PROMPTS = {
    "vs": (
        "You are the Functional Analogy Agent. Score whether a real precedent exists "
        "of testing an assumption like this crux in another field. "
        "0 = no such precedent, 1 = a clear proven test of the same kind exists. "
        "Do not say which option to choose."
    ),
    "mp": (
        "You are the Impact Projection Agent. Score how far this perspective would move "
        "the decision if the crux fell. "
        "0 = it barely touches the assumption, 1 = if this holds, the decision would have to be reconsidered. "
        "Do not say which option to choose."
    ),
}


def _agent_prompt(agent_key: str, flow: str) -> str:
    if flow == "decide" and agent_key in DECIDE_PROMPTS:
        return DECIDE_PROMPTS[agent_key]
    return AGENT_PROMPTS[agent_key]


async def _score_single(
    agent_key: str,
    concept: str,
    entity: str,
    context: str,
    lang: str = "es",
    flow: str = "create",
) -> tuple[str, float]:
    """Ask one sub-agent to score a concept-entity pair."""
    prompt = (
        f"{lang_line(lang)}\n"
        f"{_agent_prompt(agent_key, flow)}\n\n"
        f"Base Concept: {concept}\n"
        f"Proposed Entity: {entity}\n"
        f"Context: {context}\n\n"
        "Respond ONLY with a JSON object: {\"score\": <float 0-1>, \"reasoning\": \"<one sentence>\"}"
    )
    try:
        result = await trace.call(
            f"score:{agent_key}",
            model=MODEL,
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        text = result["content"][0]["text"].strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text)
        score = max(0.0, min(1.0, float(data["score"])))
        _remember(agent_key, {"score": score, "reasoning": str(data.get("reasoning") or ""), "fallback": False})
        return agent_key, score
    except Exception as exc:
        _remember(agent_key, {"score": 0.5, "reasoning": "", "fallback": True, "error": f"{type(exc).__name__}: {exc}"[:300]})
        return agent_key, 0.5


def _remember(agent_key: str, info: dict) -> None:
    try:
        details = _details.get()
        if details is not None:
            details[agent_key] = info
    except Exception:
        pass


async def score_concept_entity(
    concept: str,
    entity: str,
    context: str = "",
    lang: str = "es",
    flow: str = "create",
) -> AgentScores:
    """Run all 6 sub-agents in parallel and return aggregated scores."""
    details: dict = {}
    _details.set(details)
    tasks = [
        _score_single(key, concept, entity, context, lang, flow)
        for key in AGENT_PROMPTS
    ]
    results = await asyncio.gather(*tasks)
    trace.set_agents({key: details.get(key) for key in AGENT_PROMPTS})
    scores_dict = dict(results)
    return AgentScores(**scores_dict)
