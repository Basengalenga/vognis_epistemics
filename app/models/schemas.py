from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


# --- Enums ---

class Intent(str, Enum):
    CREATIVITY = "creativity"   # Bias towards PS
    FUNCTIONALITY = "functionality"  # Bias towards CI
    BALANCE = "balance"  # Standard VI


class Modality(str, Enum):
    LEARNING = "learning"
    DEVELOPMENT = "development"
    FEEDBACK = "feedback"


class NodeType(str, Enum):
    CONCEPT = "concept"
    ENTITY = "entity"       # Serendipity element
    PROCESS = "process"     # Functional anchor


class EdgeType(str, Enum):
    SEMANTIC = "semantic"
    SERENDIPITOUS = "serendipitous"
    ANCHORING = "anchoring"


# --- Scoring ---

class AgentScores(BaseModel):
    dc: float = Field(0.0, ge=0, le=1, description="Divergence / Conceptual Distance")
    nc: float = Field(0.0, ge=0, le=1, description="Rarity / Novelty")
    t: float = Field(0.0, ge=0, le=1, description="Originality / Transformativeness")
    vs: float = Field(0.0, ge=0, le=1, description="Analogical Viability")
    mp: float = Field(0.0, ge=0, le=1, description="Market / Impact Potential")
    pcf: float = Field(0.0, ge=0, le=1, description="Functional Contact Points / Anchoring")


class Radar(BaseModel):
    abstraction: float = Field(0.5, ge=0, le=1)
    connectivity: float = Field(0.5, ge=0, le=1)
    novelty: float = Field(0.5, ge=0, le=1)
    applicability: float = Field(0.5, ge=0, le=1)
    epistemic_confidence: float = Field(0.5, ge=0, le=1)
    conceptual_distance: float = Field(0.5, ge=0, le=1)


class ConceptCard(BaseModel):
    name: str
    domain: str = ""
    seed: str = ""
    description: str = ""
    wiki_title: str = ""
    origin_keyword: str = ""
    reasoning: str = ""
    layer: int = Field(1, ge=1, le=3)
    radar: Radar = Field(default_factory=Radar)


class ScoreResult(BaseModel):
    ps: float = Field(description="Serendipity Points")
    ci: float = Field(description="Idea Quality")
    penalty: float = Field(description="Sterile Abstraction Penalty")
    vi: float = Field(description="Innovation Value (master metric)")
    agent_scores: AgentScores


# --- Graph ---

class GraphNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    node_type: NodeType
    label: str
    content: str = ""
    scores: ScoreResult | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    edge_type: EdgeType
    weight: float = 1.0


class IdeaNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    parent_id: str | None = None
    depth: int = 0
    card: ConceptCard
    attribute: str = ""
    bridge: str = ""
    scores: ScoreResult | None = None
    developments: list[dict[str, Any]] = Field(default_factory=list)


# --- Session / Workflow ---

class SessionEntry(BaseModel):
    """One thing somebody wrote. author is usuario/user or modelo/model."""
    at: str
    author: str
    kind: str
    text: str = ""
    detail: dict[str, Any] = Field(default_factory=dict)


class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lang: Literal["es", "en"] = "es"
    flow: Literal["create", "decide"] = "create"
    started_at: str = ""
    record: list[SessionEntry] = Field(default_factory=list)
    current_node: int = 1
    problem: str = ""
    summary: str = ""
    options: list[str] = []
    stance: str = ""
    confidence_start: int = Field(0, ge=0, le=5)
    final_stance: str = ""
    final_confidence: int = Field(0, ge=0, le=5)
    abandonment: str = ""
    review_date: str = ""
    intent: Intent | None = None
    keywords: list[str] = []
    concept_cards: list[ConceptCard] = []
    concept_bank_history: list[list[str]] = []
    selected_entities: list[str] = []
    critical_attribute: str = ""
    modality: Modality = Modality.LEARNING
    confidence: int = Field(3, ge=1, le=5)
    graph_nodes: list[GraphNode] = []
    graph_edges: list[GraphEdge] = []
    branches: dict[str, list[GraphNode]] = {}
    conversation: list[dict[str, str]] = []
    ideas: dict[str, IdeaNode] = Field(default_factory=dict)
    reply_cards: dict[str, list[dict[str, Any]]] = {}
    scores_history: list[ScoreResult] = []


# --- Request / Response ---

class Node1Request(BaseModel):
    problem: str = Field(min_length=10, description="User problem description (long form)")
    expertise_level: str = Field("intermediate", description="beginner / intermediate / expert")
    interest_themes: list[str] = Field(default_factory=list)
    intent_hint: Intent = Intent.BALANCE
    lang: Literal["es", "en"] = "es"
    flow: Literal["create", "decide"] = "create"
    options: list[str] = []
    stance: str = ""
    confidence: int = Field(0, ge=0, le=5)


class Node2Request(BaseModel):
    session_id: str
    detailed_description: str = Field(min_length=10)
    intent: Intent


class Node3Request(BaseModel):
    session_id: str
    critical_attribute: str
    selected_entities: list[str] = Field(min_length=1, max_length=5)
    action: str = Field("branch", description="branch or edit")
    parent_id: str | None = None


class BridgeRequest(BaseModel):
    text: str = Field(min_length=8)


class Node4Request(BaseModel):
    session_id: str
    modality: Modality
    confidence: int = Field(3, ge=1, le=5)
    user_message: str = ""
    add_concepts: list[str] = []
    remove_concepts: list[str] = []
    focus_id: str


class KoanRequest(BaseModel):
    step: str = ""
    idea_id: str | None = None


class FinishRequest(BaseModel):
    final_stance: str = ""
    final_confidence: int = Field(0, ge=0, le=5)
    abandonment: str = ""
    review_date: str = ""


class SessionResponse(BaseModel):
    session_id: str
    current_node: int
    message: str
    data: dict[str, Any] = {}
    scores: ScoreResult | None = None
