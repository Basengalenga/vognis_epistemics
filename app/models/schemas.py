from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


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


class BoardLink(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    source: str = Field(validation_alias=AliasChoices("source", "from"), serialization_alias="from")
    target: str = Field(validation_alias=AliasChoices("target", "to"), serialization_alias="to")
    label: str = ""


class BoardNote(BaseModel):
    id: str = ""
    text: str = ""
    attached_to: str | None = None


class BoardState(BaseModel):
    links: list[BoardLink] = []
    notes: list[BoardNote] = []


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


# --- Session / Workflow ---

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lang: Literal["es", "en"] = "es"
    current_node: int = 1
    problem: str = ""
    summary: str = ""
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
    boards: dict[str, BoardState] = {}
    reply_cards: dict[str, list[dict[str, Any]]] = {}
    scores_history: list[ScoreResult] = []


# --- Request / Response ---

class Node1Request(BaseModel):
    problem: str = Field(min_length=10, description="User problem description (long form)")
    expertise_level: str = Field("intermediate", description="beginner / intermediate / expert")
    interest_themes: list[str] = Field(default_factory=list)
    intent_hint: Intent = Intent.BALANCE
    lang: Literal["es", "en"] = "es"


class Node2Request(BaseModel):
    session_id: str
    detailed_description: str = Field(min_length=10)
    intent: Intent


class Node3Request(BaseModel):
    session_id: str
    critical_attribute: str
    selected_entities: list[str] = Field(min_length=1, max_length=5)
    action: str = Field("branch", description="branch or edit")


class Node4Request(BaseModel):
    session_id: str
    modality: Modality
    confidence: int = Field(3, ge=1, le=5)
    user_message: str = ""
    add_concepts: list[str] = []
    remove_concepts: list[str] = []
    board: BoardState | None = None


class SessionResponse(BaseModel):
    session_id: str
    current_node: int
    message: str
    data: dict[str, Any] = {}
    scores: ScoreResult | None = None
