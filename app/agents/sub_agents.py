"""
Sub-Agent system: 6 specialized judges that score concepts via Claude API.

Serendipity Group: Divergence(DC), Rarity(NC), Originality(T)
Viability Group:   Analogy(VS), Impact(MP), Anchoring(PCF)
"""

import asyncio
import json
from functools import partial

from app.agents.bedrock_client import invoke_model
from app.agents.core_agent import lang_line
from app.models.schemas import AgentScores

MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"


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
        "You are the Functional Analogy Agent. Score how easy it is to find "
        "proven analogous processes in other domains that satisfy the key attribute. "
        "0 = no analogical bridge found, 1 = clear proven analogues exist."
    ),
    "mp": (
        "You are the Impact Projection Agent. Score the potential of the new concept "
        "to generate significant improvement in efficiency, cost, scale, or impact. "
        "0 = no practical improvement potential, 1 = massive improvement potential."
    ),
    "pcf": (
        "You are the Anchoring Agent. Score how many functional contact points "
        "exist between the entity and the concept. "
        "0 = no functional overlap, 1 = deep functional integration."
    ),
}


async def _score_single(
    agent_key: str,
    concept: str,
    entity: str,
    context: str,
    lang: str = "es",
) -> tuple[str, float]:
    """Ask one sub-agent to score a concept-entity pair."""
    prompt = (
        f"{lang_line(lang)}\n"
        f"{AGENT_PROMPTS[agent_key]}\n\n"
        f"Base Concept: {concept}\n"
        f"Proposed Entity: {entity}\n"
        f"Context: {context}\n\n"
        "Respond ONLY with a JSON object: {\"score\": <float 0-1>, \"reasoning\": \"<one sentence>\"}"
    )
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(
                invoke_model,
                model=MODEL,
                max_tokens=150,
                messages=[{"role": "user", "content": prompt}],
            ),
        )
        text = result["content"][0]["text"].strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text)
        score = max(0.0, min(1.0, float(data["score"])))
        return agent_key, score
    except Exception:
        return agent_key, 0.5


async def score_concept_entity(
    concept: str,
    entity: str,
    context: str = "",
    lang: str = "es",
) -> AgentScores:
    """Run all 6 sub-agents in parallel and return aggregated scores."""
    tasks = [
        _score_single(key, concept, entity, context, lang)
        for key in AGENT_PROMPTS
    ]
    results = await asyncio.gather(*tasks)
    scores_dict = dict(results)
    return AgentScores(**scores_dict)
