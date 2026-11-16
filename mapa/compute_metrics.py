#!/usr/bin/env python3
"""Métricas de procedencia humana sobre graph.json -> metrics.json.

Etiqueta propia b: User = 1, AI = 0. Padres = nodos con arista hacia el nodo
(se ignora el tipo pro/con).

  m2  50% asegurado (propagada): sin padres b; si no 0.5*b + 0.5*prom(m2 padres).
  m3  promedio directo: sin padres None; si no prom(b de los padres).
  time_rank  posición temporal normalizada: (rango - 1) / (N - 1), rango 1..N por
             timestamp, desempate por orden de extracción; 0 si N = 1.

Concordancia entre m2 y m3 (si m3 es None: "sin entradas").

Uso: python compute_metrics.py [graph.json] [-o metrics.json]
"""
import argparse
import heapq
import json
import sys
from collections import defaultdict
from datetime import datetime

TOL = 1e-9


def label(node):
    return 1 if node["author"] == "User" else 0


def topo_order(nodes, edges):
    """Kahn estable respecto al orden de `nodes` (que ya va por timestamp)."""
    pos = {n["id"]: i for i, n in enumerate(nodes)}
    indeg = {n["id"]: 0 for n in nodes}
    children = defaultdict(list)
    for e in edges:
        children[e["source"]].append(e["target"])
        indeg[e["target"]] += 1
    heap = [pos[i] for i, d in indeg.items() if d == 0]
    heapq.heapify(heap)
    order = []
    while heap:
        nid = nodes[heapq.heappop(heap)]["id"]
        order.append(nid)
        for c in children[nid]:
            indeg[c] -= 1
            if indeg[c] == 0:
                heapq.heappush(heap, pos[c])
    if len(order) != len(nodes):
        raise ValueError("El grafo tiene ciclos")
    return order


def time_ranks(nodes):
    """{id: time_rank}; orden por timestamp y, si empatan, por orden de extracción."""
    order = sorted(range(len(nodes)),
                   key=lambda i: (datetime.fromisoformat(nodes[i]["timestamp"]), i))
    n = len(nodes)
    return {nodes[i]["id"]: (r / (n - 1) if n > 1 else 0.0) for r, i in enumerate(order)}


def concordance(a, b):
    if a is None or b is None:
        return "sin entradas"
    lo1, hi1 = a < 0.5 - TOL, a > 0.5 + TOL
    lo2, hi2 = b < 0.5 - TOL, b > 0.5 + TOL
    if (lo1 and hi2) or (hi1 and lo2):
        return "discordante"
    if not (lo1 or hi1) or not (lo2 or hi2):
        return "empate"
    return "concordante"


def compute(nodes, edges):
    by_id = {n["id"]: n for n in nodes}
    parents = defaultdict(list)
    for e in edges:
        parents[e["target"]].append(e["source"])
    m2, m3 = {}, {}
    for nid in topo_order(nodes, edges):
        b = label(by_id[nid])
        ps = parents[nid]
        if not ps:
            m2[nid], m3[nid] = float(b), None
            continue
        m2[nid] = 0.5 * b + 0.5 * sum(m2[p] for p in ps) / len(ps)
        m3[nid] = sum(label(by_id[p]) for p in ps) / len(ps)
    tr = time_ranks(nodes)
    return [
        {"id": n["id"], "m2": m2[n["id"]], "m3": m3[n["id"]], "time_rank": tr[n["id"]],
         "estado": concordance(m2[n["id"]], m3[n["id"]])}
        for n in nodes
    ]


def _mean(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def summarize(rows):
    count = lambda s: sum(r["estado"] == s for r in rows)
    by_time = sorted(rows, key=lambda r: r["time_rank"])
    half = len(by_time) // 2
    return {
        "mean_m2": _mean(r["m2"] for r in rows), "mean_m3": _mean(r["m3"] for r in rows),
        "m3_sin_entradas": sum(r["m3"] is None for r in rows),
        "discordante": count("discordante"), "empate": count("empate"),
        "concordante": count("concordante"), "sin_entradas": count("sin entradas"),
        "mean_m2_primera_mitad": _mean(r["m2"] for r in by_time[:half]),
        "mean_m2_segunda_mitad": _mean(r["m2"] for r in by_time[half:]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("graph", nargs="?", default="graph.json")
    ap.add_argument("-o", "--output", default="metrics.json")
    args = ap.parse_args()
    with open(args.graph, encoding="utf-8") as f:
        g = json.load(f)
    rows = compute(g["nodes"], g["edges"])
    summary = summarize(rows)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "nodes": rows}, f, ensure_ascii=False, indent=2)

    text = {n["id"]: n["text"] for n in g["nodes"]}
    half = len(rows) // 2
    print(f"{args.output}: {len(rows)} nodos", file=sys.stderr)
    for k in ("mean_m2", "mean_m3"):
        print(f"  {k} = {summary[k]:.4f}")
    print(f"  m2 primera mitad ({half} nodos) = {summary['mean_m2_primera_mitad']:.4f}, "
          f"segunda mitad ({len(rows) - half} nodos) = {summary['mean_m2_segunda_mitad']:.4f}")
    print(f"  m3 sin entradas: {summary['m3_sin_entradas']}")
    print(f"  discordantes {summary['discordante']}, empates {summary['empate']}, "
          f"concordantes {summary['concordante']}, sin entradas {summary['sin_entradas']}")
    print("  Mayor |m2 - m3|:")
    comparable = [r for r in rows if r["m3"] is not None]
    for r in sorted(comparable, key=lambda r: -abs(r["m2"] - r["m3"]))[:3]:
        print(f"    {r['id']}  m2={r['m2']:.4f} m3={r['m3']:.4f} |Δ|={abs(r['m2'] - r['m3']):.4f}"
              f"  [{r['estado']}]  {text[r['id']]}")


if __name__ == "__main__":
    main()
