"""Statement graph for the audit. Port of mapa/build_graph.py with the same logic.

The session JSON becomes a DAG of statements with author User/AI and pro/con edges.
A blind model call per event extracts statements; authorship and timestamps are set
here from the event, never by the model. Answers are cached per event, so a later
audit of the same session only calls the model for new events.

These calls go straight to invoke_model, never through trace.call, so they are never
written into the session record.
"""

import hashlib
import json
import os
from pathlib import Path
from typing import Callable

from app.agents.bedrock_client import invoke_model

MODEL = "claude-sonnet-4-5"  # part of the cache key, as in mapa
PROMPT_VERSION = "v1"

KEEP = {
    "user": {"problem", "description", "gamechanger", "bridge", "message", "choice"},
    "model": {"keywords", "summary", "cards", "question", "reply"},
}

SYSTEM_PROMPT = """Eres un extractor de afirmaciones (statements) para construir un grafo de razonamiento.

Recibes:
1. La lista de statements ya extraídos, cada uno con su id.
2. El texto de un evento nuevo de una conversación.

Tu tarea es devolver JSON con:
- "new_statements": afirmaciones atómicas NUEVAS que aparecen en el evento. Una sola idea por statement, texto corto en español (máximo ~20 palabras), autocontenido (que se entienda sin leer el evento). Cada uno con un "ref" local: "n1", "n2", ...
- "repeats": ids de statements EXISTENTES que el evento solo reafirma, acepta o parafrasea. Éstos no se vuelven a extraer como nuevos.
- "edges": de qué statements sale cada statement nuevo. Cada arista tiene "source" (id de un statement existente, o el ref de un statement nuevo que aparezca ANTES en tu lista), "target" (ref de un statement nuevo) y "type":
    - "pro": el statement de origen apoya, motiva o se desarrolla en el nuevo.
    - "con": el statement de origen refuta, limita, objeta o contradice al nuevo.

Reglas:
- Las preguntas NO son statements. Excepción: si una pregunta contiene propuestas ("¿harías A, B o C?", "¿qué pasaría si hicieras X?"), extrae cada propuesta (A, B, C, X) como statement.
- Si el evento elige, acepta o aprueba algo ya propuesto, eso es una repetición (va en "repeats"), no un statement nuevo.
- No dupliques: si una idea ya existe con otras palabras, va en "repeats".
- Las aristas solo pueden apuntar a statements que ya existen (o a nuevos anteriores del mismo evento). Nunca inventes ids.
- Conecta cada statement nuevo con su(s) origen(es) más directo(s) cuando exista relación clara; si no hay ninguna, puede quedar sin aristas.
- No incluyas saludos, relleno ni meta-comentarios sobre la conversación.
- Si el evento no aporta nada, devuelve listas vacías."""

SCHEMA = {
    "type": "object",
    "properties": {
        "new_statements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"ref": {"type": "string"}, "text": {"type": "string"}},
                "required": ["ref", "text"],
                "additionalProperties": False,
            },
        },
        "repeats": {"type": "array", "items": {"type": "string"}},
        "edges": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "target": {"type": "string"},
                    "type": {"type": "string", "enum": ["pro", "con"]},
                },
                "required": ["source", "target", "type"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["new_statements", "repeats", "edges"],
    "additionalProperties": False,
}


class AuditError(RuntimeError):
    """The model did not give a usable answer for one event."""


# ---------------------------------------------------------------- Paso 1
def raw_or_text(e):
    d = e.get("detail") or {}
    return (d.get("raw") or e.get("text") or "").strip()


def extract_events(entries):
    """Devuelve la lista de eventos atómicos (author, at, seq, text)."""
    events = []
    for e in sorted(entries, key=lambda x: x["seq"]):
        a, k = e.get("author_key"), e.get("kind_key")
        if k not in KEEP.get(a, ()):
            continue
        d = e.get("detail") or {}
        base = {"author": a, "at": e["at"], "seq": e["seq"], "kind": k}
        texts = []
        if a == "model" and k == "cards":
            for c in d.get("cards", []):
                parts = [c.get("name", ""), c.get("seed", ""), c.get("description", "")]
                texts.append("\n".join(p for p in parts if p))
        elif a == "model" and k == "reply":
            if d.get("intro"):
                texts.append(d["intro"])
            for c in d.get("cards", []):
                parts = [c.get("title", ""), c.get("body", "")]
                texts.append("\n".join(p for p in parts if p))
        elif a == "user" and k in ("message", "bridge", "problem", "description", "gamechanger"):
            texts.append(raw_or_text(e))
        else:  # keywords, summary, question, choice
            texts.append((e.get("text") or "").strip())
        for i, t in enumerate(texts):
            if t:
                events.append({**base, "idx": i, "text": t})
    return events


# ---------------------------------------------------------------- Paso 2
def build_user_message(statements, text):
    existing = "\n".join(f"{s['id']}: {s['text']}" for s in statements) or "(ninguno)"
    return (
        f"<statements_existentes>\n{existing}\n</statements_existentes>\n\n"
        f"<evento>\n{text}\n</evento>"
    )


def cache_path(cache_dir: Path, user_msg: str, ev: dict) -> Path:
    key = hashlib.sha256(
        json.dumps([PROMPT_VERSION, MODEL, SYSTEM_PROMPT, user_msg], ensure_ascii=False).encode()
    ).hexdigest()[:16]
    return Path(cache_dir) / f"{ev['seq']:05d}-{ev['idx']:02d}-{key}.json"


class CachedExtractor:
    """call(user_msg, ev) -> extraction. Reads the cache first; asks the model only on a miss."""

    def __init__(self, cache_dir: Path, bedrock_model: str):
        self.cache_dir = Path(cache_dir)
        self.bedrock_model = bedrock_model
        self.fresh = 0

    def __call__(self, user_msg: str, ev: dict) -> dict:
        path = cache_path(self.cache_dir, user_msg, ev)
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return json.load(f)

        resp = invoke_model(
            model=self.bedrock_model,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            temperature=0,
            extra={"output_config": {"format": {"type": "json_schema", "schema": SCHEMA}}},
        )
        if resp.get("stop_reason") not in ("end_turn", "stop_sequence"):
            raise AuditError(f"Respuesta incompleta (stop_reason={resp.get('stop_reason')}) en seq={ev['seq']}")
        out = json.loads("".join(b.get("text", "") for b in resp.get("content", []) if b.get("type") == "text"))
        self.fresh += 1
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
        return out


# ---------------------------------------------------------------- Paso 3
def has_cycle(nodes, edges):
    adj = {n["id"]: [] for n in nodes}
    for e in edges:
        adj[e["source"]].append(e["target"])
    state = {}

    def dfs(u):
        state[u] = 1
        for v in adj[u]:
            if state.get(v) == 1 or (v not in state and dfs(v)):
                return True
        state[u] = 2
        return False

    return any(n not in state and dfs(n) for n in adj)


def build_graph(
    events: list[dict],
    call: Callable[[str, dict], dict],
    progress: Callable[[int, int], None] | None = None,
) -> dict:
    """Same loop as mapa/build_graph.py main(). Returns {nodes, edges, dropped}."""
    nodes, edges, seen_edges = [], [], set()
    node_ids = set()
    dropped = 0
    for n, ev in enumerate(events, 1):
        visible = [{"id": s["id"], "text": s["text"]} for s in nodes]
        out = call(build_user_message(visible, ev["text"]), ev)

        ref_map = {}
        for st in out.get("new_statements", []):
            text = (st.get("text") or "").strip()
            if not text:
                continue
            nid = f"s{len(nodes) + 1}"
            ref_map[st["ref"]] = nid
            nodes.append({
                "id": nid,
                "text": text,
                "author": "User" if ev["author"] == "user" else "AI",
                "timestamp": ev["at"],
            })
            node_ids.add(nid)

        order = {nid: i for i, nid in enumerate(n["id"] for n in nodes)}
        for e in out.get("edges", []):
            s = ref_map.get(e["source"], e["source"])
            t = ref_map.get(e["target"])
            if (s not in node_ids or t is None or e["type"] not in ("pro", "con")
                    or s == t or order[s] >= order[t]):  # solo de anterior a nuevo
                dropped += 1
                continue
            if (s, t) in seen_edges:
                continue
            seen_edges.add((s, t))
            edges.append({"source": s, "target": t, "type": e["type"]})
        if progress:
            progress(n, len(events))

    if has_cycle(nodes, edges):
        raise AuditError("El grafo tiene ciclos")
    return {"nodes": nodes, "edges": edges, "dropped": dropped}
