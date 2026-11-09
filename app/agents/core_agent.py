"""
Core conversational agent that drives the node workflow.
Uses Bedrock API for NLP extraction, synthesis, and concept generation.
"""

import asyncio
import json
from functools import partial

from app.agents.bedrock_client import invoke_model

MODEL = "us.anthropic.claude-sonnet-4-20250514-v1:0"


async def extract_keywords(problem: str, expertise: str, themes: list[str]) -> list[str]:
    """Node 1: Extract and normalize keywords from user problem."""
    themes_str = ", ".join(themes) if themes else "none specified"
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            invoke_model,
            model=MODEL,
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": (
                    f"Extract 8-12 key concepts/keywords from this problem description. "
                    f"User expertise: {expertise}. Interest themes: {themes_str}.\n\n"
                    f"Problem: {problem}\n\n"
                    f"Respond ONLY with a JSON array of strings. Example: [\"keyword1\", \"keyword2\"]"
                ),
            }],
        ),
    )
    text = result["content"][0]["text"].strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


async def synthesize_summary(problem: str, keywords: list[str]) -> str:
    """Node 2: Create an executive summary of the problem."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            invoke_model,
            model=MODEL,
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": (
                    f"Synthesize this problem into a brief executive summary (2-3 sentences). "
                    f"Be encouraging and open to creative possibilities.\n\n"
                    f"Problem: {problem}\n"
                    f"Key concepts: {', '.join(keywords)}\n\n"
                    f"Respond with ONLY the summary text, no formatting."
                ),
            }],
        ),
    )
    return result["content"][0]["text"].strip()


async def generate_concept_bank(
    problem: str,
    keywords: list[str],
    critical_attribute: str,
) -> list[str]:
    """Node 3: Generate 20 'alien entity' concepts for serendipitous intersection."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            invoke_model,
            model=MODEL,
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": (
                    f"You are a creative serendipity engine. Generate exactly 20 diverse "
                    f"concepts/entities from DISTANT domains (zoology, philosophy, music, "
                    f"physics, mythology, cooking, architecture, sports, etc.) that could "
                    f"create surprising but viable connections with the problem below.\n\n"
                    f"Problem: {problem}\n"
                    f"Keywords: {', '.join(keywords)}\n"
                    f"Critical attribute to solve: {critical_attribute}\n\n"
                    f"The concepts should range from mildly creative to wildly alien.\n"
                    f"Respond ONLY with a JSON array of 20 strings."
                ),
            }],
        ),
    )
    text = result["content"][0]["text"].strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


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


async def node4_respond(
    problem: str,
    summary: str,
    keywords: list[str],
    entities: list[str],
    modality: str,
    confidence: int,
    conversation: list[dict[str, str]],
    user_message: str,
) -> str:
    """Node 4: Development engine conversation."""
    system = (
        f"You are Vognis, a creative AI workspace assistant.\n\n"
        f"Problem: {problem}\n"
        f"Summary: {summary}\n"
        f"Core keywords: {', '.join(keywords)}\n"
        f"Selected alien entities: {', '.join(entities)}\n\n"
        f"{MODALITY_INSTRUCTIONS[modality]}\n"
        f"{CONFIDENCE_TONES[confidence]}\n\n"
        f"Help the user develop innovative ideas by bridging the gap between "
        f"their problem domain and the selected alien entities. "
        f"Keep responses focused and actionable (3-5 paragraphs max)."
    )
    messages = conversation + [{"role": "user", "content": user_message}]
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            invoke_model,
            model=MODEL,
            max_tokens=800,
            system=system,
            messages=messages,
        ),
    )
    return result["content"][0]["text"].strip()
