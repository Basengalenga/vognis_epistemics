"""
API endpoints for the Vognis node workflow.
Each endpoint corresponds to a node in the idea graph.
"""

from fastapi import APIRouter, HTTPException

from app.agents.core_agent import (
    extract_keywords,
    generate_concept_bank,
    node4_respond,
    summarize_session,
    synthesize_summary,
)
from app.agents.sub_agents import score_concept_entity
from app.engine.scoring import compute_scores
from app.models.schemas import (
    ConceptCard,
    EdgeType,
    GraphEdge,
    GraphNode,
    NodeType,
    Node1Request,
    Node2Request,
    Node3Request,
    Node4Request,
    Session,
    SessionResponse,
)

router = APIRouter(prefix="/api/v1", tags=["workflow"])

# In-memory session store (prototype)
_sessions: dict[str, Session] = {}


def _get_session(session_id: str) -> Session:
    if session_id not in _sessions:
        raise HTTPException(404, f"Session {session_id} not found")
    return _sessions[session_id]


# --- Node 1: Initialization & Vector Priming ---

@router.post("/node1", response_model=SessionResponse)
async def node1_initialize(req: Node1Request):
    """Create a new session. Extract keywords and prime the vector space."""
    keywords = await extract_keywords(
        req.problem, req.expertise_level, req.interest_themes, req.lang
    )

    session = Session(
        lang=req.lang,
        problem=req.problem,
        keywords=keywords,
        intent=req.intent_hint,
    )

    # Create initial concept node
    concept_node = GraphNode(
        node_type=NodeType.CONCEPT,
        label="Core Problem",
        content=req.problem,
    )
    session.graph_nodes.append(concept_node)
    session.current_node = 2

    _sessions[session.id] = session

    return SessionResponse(
        session_id=session.id,
        current_node=2,
        message=(
            f"Session initialized. I extracted {len(keywords)} key concepts from your problem. "
            f"Now, please describe your problem in more detail to consolidate the idea."
        ),
        data={
            "keywords": keywords,
            "expertise": req.expertise_level,
            "themes": req.interest_themes,
        },
    )


# --- Node 2: Reaffirmation & Intent Bridge ---

@router.post("/node2", response_model=SessionResponse)
async def node2_reaffirm(req: Node2Request):
    """Confirm understanding and set creative intent."""
    session = _get_session(req.session_id)
    if session.current_node != 2:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected 2")

    summary = await synthesize_summary(req.detailed_description, session.keywords, session.lang)
    session.summary = summary
    session.intent = req.intent
    session.problem = req.detailed_description  # Update with richer description
    session.current_node = 3

    return SessionResponse(
        session_id=session.id,
        current_node=3,
        message=summary,
        data={
            "intent": req.intent.value,
            "keywords": session.keywords,
            "next_step": "Define your critical attribute and select alien entities.",
        },
    )


# --- Node 3: Strategic Intersection (Branching) ---

@router.post("/node3/concept-bank", response_model=SessionResponse)
async def node3_concept_bank(session_id: str, critical_attribute: str, mode: str = "new"):
    """Generate 12 epistemic cards. mode is 'new' or 'rotate'."""
    session = _get_session(session_id)
    if session.current_node != 3:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected 3")
    if mode not in ("new", "rotate"):
        raise HTTPException(400, "mode must be new or rotate")

    session.critical_attribute = critical_attribute
    previous = [name for spread in session.concept_bank_history for name in spread]
    raw_cards = await generate_concept_bank(
        session.problem,
        session.keywords,
        critical_attribute,
        lang=session.lang,
        mode=mode,
        previous=previous,
    )
    cards = [ConceptCard(**card) for card in raw_cards]
    session.concept_cards = cards
    session.concept_bank_history.append([card.name for card in cards])

    return SessionResponse(
        session_id=session.id,
        current_node=3,
        message="Here are 12 cards. Choose 1 to 5.",
        data={
            "concept_bank": [card.model_dump() for card in cards],
            "critical_attribute": critical_attribute,
            "mode": mode,
        },
    )


@router.post("/node3/select", response_model=SessionResponse)
async def node3_select(req: Node3Request):
    """User selects alien entities and branches/edits."""
    session = _get_session(req.session_id)
    if session.current_node != 3:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected 3")

    session.selected_entities = req.selected_entities
    session.critical_attribute = req.critical_attribute

    # Score each selected entity against the core concept
    all_scores = []
    for entity in req.selected_entities:
        agent_scores = await score_concept_entity(
            concept=session.problem,
            entity=entity,
            context=f"Keywords: {', '.join(session.keywords)}. Critical: {req.critical_attribute}",
            lang=session.lang,
        )
        score_result = compute_scores(agent_scores)
        all_scores.append({"entity": entity, "scores": score_result.model_dump()})

        # Add entity node and edges to graph
        entity_node = GraphNode(
            node_type=NodeType.ENTITY,
            label=entity,
            content=f"Alien entity from concept bank",
            scores=score_result,
        )
        session.graph_nodes.append(entity_node)

        # Determine edge type based on scores
        if agent_scores.dc > 0.7:
            edge_type = EdgeType.SERENDIPITOUS
        elif agent_scores.pcf > 0.6:
            edge_type = EdgeType.ANCHORING
        else:
            edge_type = EdgeType.SEMANTIC

        concept_id = session.graph_nodes[0].id
        session.graph_edges.append(GraphEdge(
            source=concept_id,
            target=entity_node.id,
            edge_type=edge_type,
            weight=score_result.vi,
        ))
        session.scores_history.append(score_result)

    if req.action == "branch":
        branch_id = f"branch_{len(session.branches) + 1}"
        session.branches[branch_id] = session.graph_nodes[1:]  # Exclude root

    session.current_node = 4

    return SessionResponse(
        session_id=session.id,
        current_node=4,
        message=(
            f"Entities scored and {'branched' if req.action == 'branch' else 'integrated'}. "
            f"Entering Development Engine. Choose your modality: learning, development, or feedback."
        ),
        data={
            "entity_scores": all_scores,
            "action": req.action,
            "graph_nodes": [n.model_dump() for n in session.graph_nodes],
            "graph_edges": [e.model_dump() for e in session.graph_edges],
        },
    )


# --- Node 4: Persistent Development Engine ---

@router.post("/node4", response_model=SessionResponse)
async def node4_develop(req: Node4Request):
    """The core development loop. Chat with modality + confidence controls."""
    session = _get_session(req.session_id)
    if session.current_node != 4:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected 4")

    session.modality = req.modality
    session.confidence = req.confidence

    # Handle concept add/remove
    for c in req.add_concepts:
        if c not in session.keywords:
            session.keywords.append(c)
    for c in req.remove_concepts:
        if c in session.keywords:
            session.keywords.remove(c)

    if req.board is not None:
        session.boards[req.modality.value] = req.board
    board_payload = req.board.model_dump(by_alias=True) if req.board is not None else None

    reply = await node4_respond(
        problem=session.problem,
        summary=session.summary,
        keywords=session.keywords,
        entities=session.selected_entities,
        modality=req.modality.value,
        confidence=req.confidence,
        conversation=session.conversation,
        user_message=req.user_message,
        lang=session.lang,
        board=board_payload,
    )
    intro = reply.get("intro") or ""
    cards = reply.get("cards") or []
    plain = intro
    if cards:
        plain = intro + "\n" + "\n".join(f"- {card['title']}: {card['body']}" for card in cards)

    session.conversation.append({"role": "user", "content": req.user_message})
    session.conversation.append({"role": "assistant", "content": plain})
    session.reply_cards.setdefault(req.modality.value, []).extend(cards)

    scores = None
    if req.modality.value in ("development", "feedback") and session.selected_entities:
        agent_scores = await score_concept_entity(
            concept=session.problem,
            entity=session.selected_entities[0],
            context=f"Latest discussion: {plain[:200]}",
            lang=session.lang,
        )
        scores = compute_scores(agent_scores)
        session.scores_history.append(scores)

    return SessionResponse(
        session_id=session.id,
        current_node=4,
        message=plain,
        data={
            "modality": req.modality.value,
            "confidence": req.confidence,
            "keywords": session.keywords,
            "entities": session.selected_entities,
            "conversation_length": len(session.conversation),
            "intro": intro,
            "cards": cards,
        },
        scores=scores,
    )


# --- Utility endpoints ---

@router.post("/session/{session_id}/finish")
async def finish_session(session_id: str):
    """Narrative summary plus the full session, for a local download."""
    session = _get_session(session_id)
    summary, bridges = await summarize_session(session)
    return {
        "summary": summary,
        "bridges": bridges,
        "session": session.model_dump(by_alias=True),
    }


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get full session state (for frontend graph rendering)."""
    session = _get_session(session_id)
    return session.model_dump()


@router.get("/session/{session_id}/graph")
async def get_graph(session_id: str):
    """Get just the graph data for visualization."""
    session = _get_session(session_id)
    return {
        "nodes": [n.model_dump() for n in session.graph_nodes],
        "edges": [e.model_dump() for e in session.graph_edges],
        "branches": {k: [n.model_dump() for n in v] for k, v in session.branches.items()},
    }


@router.get("/sessions")
async def list_sessions():
    """List all active sessions."""
    return {
        sid: {"current_node": s.current_node, "problem": s.problem[:80]}
        for sid, s in _sessions.items()
    }
