"""
API endpoints for the Vognis node workflow.
Each endpoint corresponds to a node in the idea graph.
"""

from fastapi import APIRouter, HTTPException

from app.agents.core_agent import (
    branch_names,
    extract_keywords,
    gamechanger_block,
    generate_concept_bank,
    generate_koan,
    idea_path_names,
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
    IdeaNode,
    BridgeRequest,
    KoanRequest,
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


def _drop_descendants(session: Session, parent_id: str | None) -> None:
    doomed = {idea_id for idea_id, idea in session.ideas.items() if idea.parent_id == parent_id}
    growing = True
    while growing:
        growing = False
        for idea_id, idea in session.ideas.items():
            if idea_id not in doomed and idea.parent_id in doomed:
                doomed.add(idea_id)
                growing = True
    for idea_id in doomed:
        del session.ideas[idea_id]


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
async def node3_concept_bank(
    session_id: str,
    critical_attribute: str,
    mode: str = "new",
    parent_id: str | None = None,
):
    """Generate 12 epistemic cards. mode is 'new' or 'rotate'."""
    session = _get_session(session_id)
    if session.current_node < 3:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected at least 3")
    if mode not in ("new", "rotate"):
        raise HTTPException(400, "mode must be new or rotate")
    if parent_id == "":
        parent_id = None

    origin = ""
    avoided = [name for spread in session.concept_bank_history for name in spread]
    if parent_id:
        parent = session.ideas.get(parent_id)
        if parent is None:
            raise HTTPException(404, "Parent idea not found")
        origin = (
            "Grow this spread from the chosen idea, not from the problem alone.\n"
            f"Parent idea: {parent.card.name}\n"
            f"Parent seed: {parent.card.seed}"
        )
        for name in branch_names(session.ideas, parent_id):
            if name not in avoided:
                avoided.append(name)

    session.critical_attribute = critical_attribute
    raw_cards = await generate_concept_bank(
        session.problem,
        session.keywords,
        critical_attribute,
        lang=session.lang,
        mode=mode,
        previous=avoided,
        origin=origin,
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
    """User selects ideas. Each one becomes a node in the idea tree."""
    session = _get_session(req.session_id)
    if session.current_node < 3:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected at least 3")

    parent = None
    if req.parent_id:
        parent = session.ideas.get(req.parent_id)
        if parent is None:
            raise HTTPException(404, "Parent idea not found")
    if req.action == "edit":
        _drop_descendants(session, req.parent_id)

    session.critical_attribute = req.critical_attribute
    depth = (parent.depth + 1) if parent else 0
    concept = session.problem
    if parent:
        concept = f"{session.problem}\nFocused idea: {parent.card.name}. {parent.card.seed}"

    anchor_id = session.graph_nodes[0].id
    if parent:
        match = next((n for n in reversed(session.graph_nodes) if n.label == parent.card.name), None)
        if match:
            anchor_id = match.id

    ideas_out = []
    all_scores = []
    for entity in req.selected_entities:
        if entity not in session.selected_entities:
            session.selected_entities.append(entity)
        card = next((c for c in session.concept_cards if c.name == entity), None)
        if card is None:
            card = ConceptCard(name=entity)
        entity_text = f"{card.name}: {card.seed}" if card.seed else card.name
        agent_scores = await score_concept_entity(
            concept=concept,
            entity=entity_text,
            context=f"Keywords: {', '.join(session.keywords)}.\n{gamechanger_block(req.critical_attribute)}",
            lang=session.lang,
        )
        score_result = compute_scores(agent_scores)
        all_scores.append({"entity": entity, "scores": score_result.model_dump()})

        node = IdeaNode(
            parent_id=req.parent_id,
            depth=depth,
            card=card,
            attribute=req.critical_attribute,
            scores=score_result,
        )
        session.ideas[node.id] = node
        ideas_out.append({
            "id": node.id,
            "name": card.name,
            "seed": card.seed,
            "card": card.model_dump(),
            "scores": score_result.model_dump(),
            "attribute": req.critical_attribute,
            "parent_id": req.parent_id,
            "depth": depth,
            "bridge": node.bridge,
        })

        entity_node = GraphNode(
            node_type=NodeType.ENTITY,
            label=card.name,
            content=card.seed,
            scores=score_result,
        )
        session.graph_nodes.append(entity_node)
        if agent_scores.dc > 0.7:
            edge_type = EdgeType.SERENDIPITOUS
        elif agent_scores.pcf > 0.6:
            edge_type = EdgeType.ANCHORING
        else:
            edge_type = EdgeType.SEMANTIC
        session.graph_edges.append(GraphEdge(
            source=anchor_id,
            target=entity_node.id,
            edge_type=edge_type,
            weight=score_result.vi,
        ))
        session.scores_history.append(score_result)

    if req.action == "branch":
        branch_id = f"branch_{len(session.branches) + 1}"
        session.branches[branch_id] = session.graph_nodes[1:]

    session.current_node = max(session.current_node, 4)

    return SessionResponse(
        session_id=session.id,
        current_node=session.current_node,
        message=(
            f"Ideas scored and {'branched' if req.action == 'branch' else 'replaced'}."
        ),
        data={
            "ideas": ideas_out,
            "entity_scores": all_scores,
            "action": req.action,
            "graph_nodes": [n.model_dump() for n in session.graph_nodes],
            "graph_edges": [e.model_dump() for e in session.graph_edges],
        },
    )


# --- Node 4: Persistent Development Engine ---

@router.post("/node4", response_model=SessionResponse)
async def node4_develop(req: Node4Request):
    """Develop one idea already on the map."""
    session = _get_session(req.session_id)
    if session.current_node < 4:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected at least 4")

    focus = session.ideas.get(req.focus_id)
    if focus is None:
        raise HTTPException(404, "Idea not found")
    if not (focus.bridge or "").strip():
        raise HTTPException(409, "Primero escribe el puente")

    session.modality = req.modality
    session.confidence = req.confidence

    for c in req.add_concepts:
        if c not in session.keywords:
            session.keywords.append(c)
    for c in req.remove_concepts:
        if c in session.keywords:
            session.keywords.remove(c)

    path = idea_path_names(session.ideas, focus)
    history = []
    for dev in focus.developments:
        if dev.get("user_message"):
            history.append({"role": "user", "content": dev["user_message"]})
        prior_cards = dev.get("cards") or []
        prior = dev.get("intro") or ""
        if prior_cards:
            prior = (prior + "\n" + "\n".join(
                f"- {card.get('title')}: {card.get('body')}" for card in prior_cards
            )).strip()
        if prior:
            history.append({"role": "assistant", "content": prior})

    reply = await node4_respond(
        problem=session.problem,
        summary=session.summary,
        keywords=session.keywords,
        entities=session.selected_entities,
        modality=req.modality.value,
        confidence=req.confidence,
        conversation=history,
        user_message=req.user_message,
        lang=session.lang,
        focus={
            "name": focus.card.name,
            "seed": focus.card.seed,
            "attribute": focus.attribute,
            "path": path,
            "bridge": focus.bridge,
        },
    )
    intro = reply.get("intro") or ""
    cards = reply.get("cards") or []
    plain = intro
    if cards:
        plain = intro + "\n" + "\n".join(f"- {card['title']}: {card['body']}" for card in cards)

    focus.developments.append({
        "modality": req.modality.value,
        "confidence": req.confidence,
        "user_message": req.user_message,
        "intro": intro,
        "cards": cards,
    })
    session.conversation.append({"role": "user", "content": req.user_message})
    session.conversation.append({"role": "assistant", "content": plain})
    session.reply_cards.setdefault(req.modality.value, []).extend(cards)

    scores = None
    if req.modality.value in ("development", "feedback"):
        agent_scores = await score_concept_entity(
            concept=session.problem,
            entity=f"{focus.card.name}: {focus.card.seed}",
            context=f"Path: {' > '.join(path)}. Latest: {plain[:200]}",
            lang=session.lang,
        )
        scores = compute_scores(agent_scores)
        focus.scores = scores
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

@router.post("/session/{session_id}/koan")
async def session_koan(session_id: str, req: KoanRequest):
    """One paradoxical question for the step the user is paused on."""
    session = _get_session(session_id)
    idea = session.ideas.get(req.idea_id) if req.idea_id else None
    question = await generate_koan(
        lang=session.lang,
        step=req.step,
        problem=session.problem,
        idea_name=idea.card.name if idea else None,
        attribute=idea.attribute if idea else session.critical_attribute,
    )
    return {"question": question}


@router.post("/session/{session_id}/ideas/{idea_id}/bridge")
async def set_bridge(session_id: str, idea_id: str, req: BridgeRequest):
    """The user's own link between an idea and the problem. Required before developing it."""
    session = _get_session(session_id)
    idea = session.ideas.get(idea_id)
    if idea is None:
        raise HTTPException(404, "Idea not found")
    idea.bridge = req.text.strip()
    return {"id": idea.id, "name": idea.card.name, "bridge": idea.bridge}


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
