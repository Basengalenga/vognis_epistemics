"""
API endpoints for the Vognis node workflow.
Each endpoint corresponds to a node in the idea graph.
"""

from fastapi import APIRouter, HTTPException

from app.agents.core_agent import (
    branch_names,
    crux_block,
    extract_keywords,
    gamechanger_block,
    generate_concept_bank,
    generate_koan,
    idea_path_names,
    node4_respond,
    summarize_session,
    synthesize_summary,
)
import uuid

from app.agents.core_agent import MODEL
from app.agents.sub_agents import score_concept_entity
from app.engine import trace
from app.engine.record import (
    append_line,
    cards_text,
    has_log,
    label,
    note,
    record_document,
    reply_text,
    score_text,
    stamp,
    _ACTION,
    _EXPERTISE,
    _INTENT,
    _MODALITY,
    _SPREAD,
)
from app.engine.scoring import compute_scores
from app.models.schemas import (
    ConceptCard,
    EdgeType,
    GraphEdge,
    GraphNode,
    IdeaNode,
    BridgeRequest,
    EventsRequest,
    FinishRequest,
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
    session = _sessions[session_id]
    trace.bind(session)
    return session


def _source(input_source: dict[str, str], key: str) -> dict:
    value = (input_source or {}).get(key)
    return {"input_source": value} if value else {}


def _drop_descendants(session: Session, parent_id: str | None) -> list[dict]:
    doomed = {idea_id for idea_id, idea in session.ideas.items() if idea.parent_id == parent_id}
    growing = True
    while growing:
        growing = False
        for idea_id, idea in session.ideas.items():
            if idea_id not in doomed and idea.parent_id in doomed:
                doomed.add(idea_id)
                growing = True
    dropped = []
    for idea_id in doomed:
        idea = session.ideas[idea_id]
        dropped.append({"idea_id": idea_id, "name": idea.card.name, "parent_id": idea.parent_id})
        del session.ideas[idea_id]
    return dropped


def _clean_options(options: list[str]) -> list[str]:
    return [item.strip() for item in options if item and item.strip()]


def _aim_context(session: Session, text: str) -> str:
    if session.flow == "decide":
        return crux_block(text, session.options, session.stance)
    return gamechanger_block(text)


# --- Node 1: Initialization & Vector Priming ---

@router.post("/node1", response_model=SessionResponse)
async def node1_initialize(req: Node1Request):
    """Create a new session. Extract keywords and prime the vector space."""
    options = _clean_options(req.options)
    stance = (req.stance or "").strip()
    if req.flow == "decide":
        if len(options) < 2 or len(options) > 4:
            raise HTTPException(400, "A decision needs 2 to 4 options")
        if stance not in options:
            raise HTTPException(400, "Mark the option you lean toward")
        if req.confidence < 1:
            raise HTTPException(400, "Mark your confidence")

    asked = stamp()
    session = Session(
        lang=req.lang,
        flow=req.flow,
        started_at=asked,
        problem=req.problem,
        options=options,
        stance=stance,
        confidence_start=req.confidence if req.flow == "decide" else 0,
        intent=req.intent_hint,
    )
    trace.bind(session)
    note(session, "user", "problem", req.problem, at=asked, detail={"raw": req.problem, **_source(req.input_source, "problem")})
    if req.flow == "decide":
        note(session, "user", "options", "\n".join(f"- {item}" for item in options), at=asked, detail={"items": options})
        note(session, "user", "stance", stance, at=asked)
        note(session, "user", "confidence", str(req.confidence), at=asked)
    else:
        note(session, "user", "expertise", label(req.lang, _EXPERTISE, req.expertise_level), at=asked, detail={"value": req.expertise_level})
        if req.interest_themes:
            themes = [item.strip() for item in req.interest_themes if item and item.strip()]
            if themes:
                note(session, "user", "themes", ", ".join(themes), at=asked, detail={"items": themes, **_source(req.input_source, "themes")})
        note(session, "user", "intent", label(req.lang, _INTENT, req.intent_hint.value), at=asked, detail={"value": req.intent_hint.value})
    keywords = await extract_keywords(
        req.problem, req.expertise_level, req.interest_themes, req.lang
    )
    answered = stamp()
    session.keywords = keywords
    note(
        session, "model", "keywords", ", ".join(keywords), at=answered,
        detail={"items": keywords},
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
            "flow": session.flow,
            "options": session.options,
            "stance": session.stance,
        },
    )


# --- Node 2: Reaffirmation & Intent Bridge ---

@router.post("/node2", response_model=SessionResponse)
async def node2_reaffirm(req: Node2Request):
    """Confirm understanding and set creative intent."""
    session = _get_session(req.session_id)
    if session.current_node != 2:
        raise HTTPException(400, f"Session is at node {session.current_node}, expected 2")

    asked = stamp()
    note(session, "user", "description", req.detailed_description, at=asked, detail={"raw": req.detailed_description, **_source(req.input_source, "description")})
    if session.flow != "decide":
        note(session, "user", "intent", label(session.lang, _INTENT, req.intent.value), at=asked, detail={"value": req.intent.value})
    summary = await synthesize_summary(req.detailed_description, session.keywords, session.lang)
    answered = stamp()
    session.summary = summary
    session.intent = req.intent
    session.problem = req.detailed_description  # Update with richer description
    session.current_node = 3
    note(session, "model", "summary", summary, at=answered)

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
    input_source: str = "",
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

    asked = stamp()
    spread_id = uuid.uuid4().hex[:8]
    aim_kind = "crux" if session.flow == "decide" else "gamechanger"
    aim_text = label(session.lang, _SPREAD, mode) + "\n" + critical_attribute.strip()
    if parent_id and origin:
        parent_name = session.ideas[parent_id].card.name
        where = "From: " if session.lang == "en" else "Desde: "
        aim_text = f"{where}{parent_name}\n{aim_text}"
    note(
        session, "user", aim_kind, aim_text, at=asked,
        detail={
            "mode": mode,
            "spread": label(session.lang, _SPREAD, mode),
            "spread_id": spread_id,
            "parent_id": parent_id,
            "parent_name": session.ideas[parent_id].card.name if parent_id and parent_id in session.ideas else None,
            "raw": critical_attribute,
            "avoided": list(avoided),
            **({"input_source": input_source} if input_source else {}),
        },
    )
    session.critical_attribute = critical_attribute
    raw_cards = await generate_concept_bank(
        session.problem,
        session.keywords,
        critical_attribute,
        lang=session.lang,
        mode=mode,
        previous=avoided,
        origin=origin,
        flow=session.flow,
        options=session.options,
        stance=session.stance,
    )
    answered = stamp()
    cards = [ConceptCard(**card) for card in raw_cards]
    session.concept_cards = cards
    session.concept_bank_history.append([card.name for card in cards])
    dumped = [card.model_dump() for card in cards]
    logged = [{"card_id": f"{spread_id}-{index + 1}", **card} for index, card in enumerate(dumped)]
    note(
        session, "model", "cards", cards_text(session.lang, dumped), at=answered,
        detail={"cards": logged, "mode": mode, "spread_id": spread_id, "parent_id": parent_id},
    )

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
    dropped = []
    if req.action == "edit":
        dropped = _drop_descendants(session, req.parent_id)

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
    asked = stamp()
    choice_lines = [label(session.lang, _ACTION, req.action)]
    if parent is not None:
        choice_lines.append(("From: " if session.lang == "en" else "Desde: ") + parent.card.name)
    aim_name = "Crux" if session.flow == "decide" else "Gamechanger"
    if session.lang != "en" and session.flow == "decide":
        aim_name = "Supuesto"
    choice_lines.append(f"{aim_name}: {req.critical_attribute.strip()}")
    choice_lines.append("\n".join(f"- {name}" for name in req.selected_entities))
    note(
        session, "user", "choice", "\n".join(choice_lines), at=asked,
        detail={
            "action": req.action,
            "ideas": list(req.selected_entities),
            "attribute": req.critical_attribute,
            "raw": req.critical_attribute,
            "parent_id": req.parent_id,
            "parent_name": parent.card.name if parent else None,
            "depth": depth,
            **_source(req.input_source, "attribute"),
        },
    )
    if dropped:
        names = "\n".join(f"- {item['name']}" for item in dropped)
        note(session, "system", "dropped", names, at=asked, detail={"parent_id": req.parent_id, "ideas": dropped})
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
            context=f"Keywords: {', '.join(session.keywords)}.\n{_aim_context(session, req.critical_attribute)}",
            lang=session.lang,
            flow=session.flow,
        )
        agents = trace.take_agents()
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
        note(
            session, "model", "scores", score_text(session.lang, card.name, score_result),
            detail={
                "idea": card.name,
                "idea_id": node.id,
                "parent_id": node.parent_id,
                "depth": node.depth,
                "card": card.model_dump(),
                "edge": {"source": anchor_id, "target": entity_node.id, "type": edge_type.value},
                "scores": score_result.model_dump(),
                "agents": agents,
            },
        )

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

    asked = stamp()
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

    demand = "How demanding" if session.lang == "en" else "Qué tan exigente"
    mode_name = label(session.lang, _MODALITY, req.modality.value)
    note(
        session, "user", "message",
        f"{focus.card.name}\n{mode_name} · {demand}: {req.confidence}\n{req.user_message}",
        at=asked,
        detail={
            "raw": req.user_message,
            "idea_id": focus.id,
            "parent_id": focus.parent_id,
            "path": path,
            "turn": len(focus.developments),
            **_source(req.input_source, "message"),
            "idea": focus.card.name,
            "modality": req.modality.value,
            "confidence": req.confidence,
            "add_concepts": list(req.add_concepts),
            "remove_concepts": list(req.remove_concepts),
        },
    )
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
            "options": session.options,
            "stance": session.stance,
        },
        flow=session.flow,
    )
    answered = stamp()
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
    note(
        session, "model", "reply", reply_text(intro, cards), at=answered,
        detail={
            "idea": focus.card.name,
            "idea_id": focus.id,
            "turn": len(focus.developments) - 1,
            "modality": req.modality.value,
            "intro": intro,
            "cards": cards,
            "parsed": reply.get("parsed", True),
        },
    )

    scores = None
    if req.modality.value in ("development", "feedback"):
        agent_scores = await score_concept_entity(
            concept=session.problem,
            entity=f"{focus.card.name}: {focus.card.seed}",
            context=(
                f"Path: {' > '.join(path)}. Latest: {plain[:200]}\n"
                f"{_aim_context(session, focus.attribute)}"
            ),
            lang=session.lang,
            flow=session.flow,
        )
        agents = trace.take_agents()
        scores = compute_scores(agent_scores)
        focus.scores = scores
        session.scores_history.append(scores)
        note(
            session, "model", "scores", score_text(session.lang, focus.card.name, scores),
            detail={
                "idea": focus.card.name,
                "idea_id": focus.id,
                "parent_id": focus.parent_id,
                "turn": len(focus.developments) - 1,
                "scores": scores.model_dump(),
                "agents": agents,
            },
        )

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
        flow=session.flow,
        options=session.options,
        stance=session.stance,
    )
    note(
        session, "model", "question", question,
        detail={"step": req.step, "idea": idea.card.name if idea else "", "idea_id": idea.id if idea else None, "source": "api"},
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
    note(session, "user", "bridge", f"{idea.card.name}\n{idea.bridge}", detail={
        "idea": idea.card.name,
        "idea_id": idea.id,
        "parent_id": idea.parent_id,
        "raw": idea.bridge,
        **_source(req.input_source, "bridge"),
    })
    return {"id": idea.id, "name": idea.card.name, "bridge": idea.bridge}


@router.post("/session/{session_id}/events")
async def session_events(session_id: str, req: EventsRequest):
    """What happened only in the browser. Logged as it is, it changes nothing."""
    session = _sessions.get(session_id)
    count = 0
    for event in req.events[:500]:
        try:
            if session is not None:
                note(
                    session, event.author, event.kind, event.text,
                    detail=event.detail, client_at=event.client_at,
                )
            elif has_log(session_id):
                append_line(session_id, {
                    "seq": None,
                    "at": stamp(),
                    "client_at": event.client_at,
                    "author_key": event.author,
                    "kind_key": event.kind,
                    "text": event.text,
                    "detail": event.detail,
                    "late": True,
                })
            else:
                continue
            count += 1
        except Exception:
            pass
    return {"logged": count}


@router.post("/session/{session_id}/finish")
async def finish_session(session_id: str, req: FinishRequest | None = None):
    """Narrative summary plus the full session, for a local download."""
    session = _get_session(session_id)
    if session.flow == "decide" and req is None:
        raise HTTPException(400, "A decision close needs the stance, the confidence, and a date")
    if session.flow == "decide" and req is not None:
        final = (req.final_stance or "").strip()
        if final and final not in session.options:
            raise HTTPException(400, "The final stance has to be one of the options")
        if req.final_confidence < 1:
            raise HTTPException(400, "Mark your confidence")
        if len((req.abandonment or "").strip()) < 8:
            raise HTTPException(400, "Write what you would have to see to let the stance go")
        if not (req.review_date or "").strip():
            raise HTTPException(400, "Choose a date to look again")
        session.final_stance = final
        session.final_confidence = req.final_confidence
        session.abandonment = req.abandonment.strip()
        session.review_date = req.review_date.strip()
    asked = stamp()
    summary, bridges = await summarize_session(session)
    answered = stamp()
    if session.flow == "decide":
        if session.lang == "en":
            close = (
                f"Stance: {session.final_stance}\n"
                f"Confidence: {session.final_confidence}\n"
                f"What would make them let go: {session.abandonment}\n"
                f"Look again: {session.review_date}"
            )
        else:
            close = (
                f"Postura: {session.final_stance}\n"
                f"Confianza: {session.final_confidence}\n"
                f"Para soltarla: {session.abandonment}\n"
                f"Volver a mirarla: {session.review_date}"
            )
        note(session, "user", "close", close, at=asked, detail={
            "final_stance": session.final_stance,
            "final_confidence": session.final_confidence,
            "abandonment": session.abandonment,
            "review_date": session.review_date,
        })
    note(session, "model", "narrative", summary, at=answered, detail={"bridges": bridges})
    return {
        "summary": summary,
        "bridges": bridges,
        "record": record_document(session, stamp(), MODEL),
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
