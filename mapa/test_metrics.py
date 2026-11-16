import unittest

from compute_metrics import compute, concordance, time_ranks


def run(nodes, edges):
    ns = [{"id": i, "author": a, "text": i, "timestamp": f"2026-01-01T00:00:{k:02d}+00:00"}
          for k, (i, a) in enumerate(nodes)]
    es = [{"source": s, "target": t, "type": "pro"} for s, t in edges]
    return {r["id"]: r for r in compute(ns, es)}


class TestMetrics(unittest.TestCase):
    def test_ai_child_of_user_seed(self):
        r = run([("u", "User"), ("a", "AI")], [("u", "a")])["a"]
        self.assertAlmostEqual(r["m2"], 0.5)
        self.assertAlmostEqual(r["m3"], 1.0)
        self.assertEqual(r["estado"], "empate")

    def test_user_child_of_ai_seed(self):
        r = run([("a", "AI"), ("u", "User")], [("a", "u")])["u"]
        self.assertAlmostEqual(r["m2"], 0.5)
        self.assertAlmostEqual(r["m3"], 0.0)
        self.assertEqual(r["estado"], "empate")

    def test_chain_user_ai_ai_ai(self):
        r = run([("n1", "User"), ("n2", "AI"), ("n3", "AI"), ("n4", "AI")],
                [("n1", "n2"), ("n2", "n3"), ("n3", "n4")])
        for nid, m2 in zip(["n1", "n2", "n3", "n4"], [1, 0.5, 0.25, 0.125]):
            self.assertAlmostEqual(r[nid]["m2"], m2)

    def test_user_with_user_and_ai_parents(self):
        r = run([("u", "User"), ("a", "AI"), ("x", "User")], [("u", "x"), ("a", "x")])["x"]
        self.assertAlmostEqual(r["m2"], 0.75)
        self.assertAlmostEqual(r["m3"], 0.5)

    def test_seeds(self):
        r = run([("u", "User"), ("a", "AI")], [])
        self.assertEqual((r["u"]["m2"], r["u"]["m3"]), (1.0, None))
        self.assertEqual((r["a"]["m2"], r["a"]["m3"]), (0.0, None))
        self.assertEqual(r["u"]["estado"], "sin entradas")

    def test_concordance(self):
        self.assertEqual(concordance(0.2, 0.8), "discordante")
        self.assertEqual(concordance(0.5 + 1e-12, 0.9), "empate")
        self.assertEqual(concordance(0.1, 0.3), "concordante")
        self.assertEqual(concordance(1.0, 1.0), "concordante")
        self.assertEqual(concordance(0.7, None), "sin entradas")

    def test_concordance_is_m2_vs_m3(self):
        # n2 (AI, padre User semilla): m2=0.5, m3=1 -> empate por m2
        # n3 (AI, padre n2 AI): m2=0.25, m3=0 -> concordante
        r = run([("n1", "User"), ("n2", "AI"), ("n3", "AI")], [("n1", "n2"), ("n2", "n3")])
        self.assertEqual(r["n2"]["estado"], "empate")
        self.assertEqual(r["n3"]["estado"], "concordante")

    def test_time_rank_three_nodes(self):
        ns = [{"id": i, "author": "User", "text": i, "timestamp": ts} for i, ts in
              [("a", "2026-01-01T10:00:00+00:00"), ("b", "2026-01-01T10:05:00+00:00"),
               ("c", "2026-01-01T10:09:00+00:00")]]
        r = {x["id"]: x["time_rank"] for x in compute(ns, [])}
        self.assertEqual((r["a"], r["b"], r["c"]), (0.0, 0.5, 1.0))

    def test_time_rank_ties_and_single(self):
        ns = [{"id": i, "timestamp": ts} for i, ts in
              [("x", "2026-01-01T10:05:00+00:00"), ("y", "2026-01-01T10:00:00+00:00"),
               ("z", "2026-01-01T10:05:00+00:00")]]
        self.assertEqual(time_ranks(ns), {"y": 0.0, "x": 0.5, "z": 1.0})
        self.assertEqual(time_ranks([{"id": "s", "timestamp": "2026-01-01T10:00:00+00:00"}]), {"s": 0.0})


if __name__ == "__main__":
    unittest.main()
