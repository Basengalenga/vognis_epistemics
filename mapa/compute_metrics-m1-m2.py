#!/usr/bin/env python3
"""Métricas de procedencia humana sobre graph.json -> metrics.json.

Etiqueta propia b: User = 1, AI = 0. Padres = nodos con arista hacia el nodo
(se ignora el tipo pro/con).

  m1  penalización al cuadrado (propagada): sin padres b; si no p = prom(m1 padres),
      AI -> p**2, User -> p.
  m2  50% asegurado (propagada): sin padres b; si no 0.5*b + 0.5*prom(m2 padres).
  m3  promedio directo: sin padres None; si no prom(b de los padres).

Uso: python compute_metrics.py [graph.json] [-o metrics.json]
"""
import argparse
import json
import sys
from collections import defaultdict, deque

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
    import heapq
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


def concordance(m1, m2):
    lo1, hi1 = m1 < 0.5 - TOL, m1 > 0.5 + TOL
    lo2, hi2 = m2 < 0.5 - TOL, m2 > 0.5 + TOL
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
    m1, m2, m3 = {}, {}, {}
    for nid in topo_order(nodes, edges):
        b = label(by_id[nid])
        ps = parents[nid]
        if not ps:
            m1[nid], m2[nid], m3[nid] = float(b), float(b), None
            continue
        p1 = sum(m1[p] for p in ps) / len(ps)
        m1[nid] = p1 ** 2 if b == 0 else p1
        m2[nid] = 0.5 * b + 0.5 * sum(m2[p] for p in ps) / len(ps)
        m3[nid] = sum(label(by_id[p]) for p in ps) / len(ps)
    return [
        {"id": n["id"], "m1": m1[n["id"]], "m2": m2[n["id"]], "m3": m3[n["id"]],
         "estado": concordance(m1[n["id"]], m2[n["id"]])}
        for n in nodes
    ]


def summarize(rows):
    mean = lambda k: (lambda v: sum(v) / len(v) if v else None)([r[k] for r in rows if r[k] is not None])
    count = lambda s: sum(r["estado"] == s for r in rows)
    return {
        "mean_m1": mean("m1"), "mean_m2": mean("m2"), "mean_m3": mean("m3"),
        "m3_sin_entradas": sum(r["m3"] is None for r in rows),
        "discordante": count("discordante"), "empate": count("empate"),
        "concordante": count("concordante"),
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
    print(f"{args.output}: {len(rows)} nodos", file=sys.stderr)
    for k in ("mean_m1", "mean_m2", "mean_m3"):
        print(f"  {k} = {summary[k]:.4f}")
    print(f"  m3 sin entradas: {summary['m3_sin_entradas']}")
    print(f"  discordantes {summary['discordante']}, empates {summary['empate']}, "
          f"concordantes {summary['concordante']}")
    print("  Mayor |m1 - m2|:")
    for r in sorted(rows, key=lambda r: -abs(r["m1"] - r["m2"]))[:3]:
        print(f"    {r['id']}  m1={r['m1']:.4f} m2={r['m2']:.4f} |Δ|={abs(r['m1'] - r['m2']):.4f}"
              f"  [{r['estado']}]  {text[r['id']]}")


if __name__ == "__main__":
    main()
