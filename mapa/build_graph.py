#!/usr/bin/env python3
"""Convierte el log de sesión en un DAG de statements (graph.json).

Uso:  python build_graph.py [sesion.json] [-o graph.json]
Requiere ANTHROPIC_API_KEY (salvo que todas las respuestas estén en cache/).
"""
import argparse
import glob
import hashlib
import json
import os
import sys

MODEL = "claude-sonnet-4-5"
PROMPT_VERSION = "v1"
CACHE_DIR = "cache"

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


_client = None
_model = MODEL
BEDROCK_MODEL = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"


def read_dotenv(path=".env"):
    env = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def make_client(ev):
    """ANTHROPIC_API_KEY si existe; si no, AWS Bedrock con AWS_BEDROCK_TOKEN/AWS_REGION (entorno o .env)."""
    import anthropic
    if os.environ.get("ANTHROPIC_API_KEY"):
        return anthropic.Anthropic(max_retries=10), MODEL
    env = {**read_dotenv(), **os.environ}
    token = env.get("AWS_BEDROCK_TOKEN") or env.get("AWS_BEARER_TOKEN_BEDROCK")
    if token and env.get("AWS_REGION"):
        print("Usando AWS Bedrock", file=sys.stderr)
        return (anthropic.AnthropicBedrock(api_key=token, aws_region=env["AWS_REGION"], max_retries=10),
                env.get("BEDROCK_MODEL", BEDROCK_MODEL))
    sys.exit(f"Falta ANTHROPIC_API_KEY o AWS_BEDROCK_TOKEN+AWS_REGION (sin caché para seq={ev['seq']}).")


def call_llm(user_msg, ev):
    key = hashlib.sha256(
        json.dumps([PROMPT_VERSION, MODEL, SYSTEM_PROMPT, user_msg], ensure_ascii=False).encode()
    ).hexdigest()[:16]
    path = os.path.join(CACHE_DIR, f"{ev['seq']:05d}-{ev['idx']:02d}-{key}.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    global _client, _model
    if _client is None:
        _client, _model = make_client(ev)

    resp = _client.messages.create(
        model=_model,
        max_tokens=4096,
        temperature=0,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    )
    if resp.stop_reason not in ("end_turn", "stop_sequence"):
        sys.exit(f"Respuesta incompleta (stop_reason={resp.stop_reason}) en seq={ev['seq']}")
    out = json.loads("".join(b.text for b in resp.content if b.type == "text"))
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?")
    ap.add_argument("-o", "--output", default="graph.json")
    args = ap.parse_args()
    src = args.input or next(iter(sorted(glob.glob("vognis-sesion-*.json"))), None)
    if not src:
        sys.exit("No encontré el JSON de sesión.")
    with open(src, encoding="utf-8") as f:
        data = json.load(f)

    events = extract_events(data["entries"])
    print(f"{len(events)} eventos tras filtrar", file=sys.stderr)

    nodes, edges, seen_edges = [], [], set()
    node_ids = set()
    dropped = 0
    for n, ev in enumerate(events, 1):
        visible = [{"id": s["id"], "text": s["text"]} for s in nodes]
        out = call_llm(build_user_message(visible, ev["text"]), ev)

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
        print(f"[{n}/{len(events)}] seq={ev['seq']} {ev['kind']}: "
              f"+{len(ref_map)} nodos, {len(out.get('repeats', []))} repeticiones", file=sys.stderr)

    if has_cycle(nodes, edges):
        sys.exit("ERROR: el grafo tiene ciclos")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"nodes": nodes, "edges": edges}, f, ensure_ascii=False, indent=2)

    cnt = lambda key, val, items: sum(1 for x in items if x[key] == val)
    print(f"\n{args.output}: {len(nodes)} nodos "
          f"(User {cnt('author', 'User', nodes)}, AI {cnt('author', 'AI', nodes)}), "
          f"{len(edges)} aristas (pro {cnt('type', 'pro', edges)}, con {cnt('type', 'con', edges)}); "
          f"{dropped} aristas descartadas; sin ciclos.")


if __name__ == "__main__":
    main()
