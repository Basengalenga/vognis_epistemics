import unittest

import importlib.util, pathlib
_spec = importlib.util.spec_from_file_location("cm_m1_m2", pathlib.Path(__file__).with_name("compute_metrics-m1-m2.py"))
_cm = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_cm)
compute, concordance = _cm.compute, _cm.concordance


def run(nodes, edges):
    ns = [{"id": i, "author": a, "text": i, "timestamp": ""} for i, a in nodes]
    es = [{"source": s, "target": t, "type": "pro"} for s, t in edges]
    return {r["id"]: r for r in compute(ns, es)}


class TestMetrics(unittest.TestCase):
    def test_ai_child_of_user_seed(self):
        r = run([("u", "User"), ("a", "AI")], [("u", "a")])["a"]
        self.assertAlmostEqual(r["m1"], 1.0)
        self.assertAlmostEqual(r["m2"], 0.5)
        self.assertAlmostEqual(r["m3"], 1.0)
        self.assertEqual(r["estado"], "empate")

    def test_user_child_of_ai_seed(self):
        r = run([("a", "AI"), ("u", "User")], [("a", "u")])["u"]
        self.assertAlmostEqual(r["m1"], 0.0)
        self.assertAlmostEqual(r["m2"], 0.5)
        self.assertAlmostEqual(r["m3"], 0.0)
        self.assertEqual(r["estado"], "empate")

    def test_chain_user_ai_ai_ai(self):
        r = run([("n1", "User"), ("n2", "AI"), ("n3", "AI"), ("n4", "AI")],
                [("n1", "n2"), ("n2", "n3"), ("n3", "n4")])
        for nid, m2 in zip(["n1", "n2", "n3", "n4"], [1, 0.5, 0.25, 0.125]):
            self.assertAlmostEqual(r[nid]["m2"], m2)
            self.assertAlmostEqual(r[nid]["m1"], 1.0)

    def test_user_with_user_and_ai_parents(self):
        r = run([("u", "User"), ("a", "AI"), ("x", "User")], [("u", "x"), ("a", "x")])["x"]
        self.assertAlmostEqual(r["m1"], 0.5)
        self.assertAlmostEqual(r["m2"], 0.75)
        self.assertAlmostEqual(r["m3"], 0.5)

    def test_seeds(self):
        r = run([("u", "User"), ("a", "AI")], [])
        self.assertEqual((r["u"]["m1"], r["u"]["m2"], r["u"]["m3"]), (1.0, 1.0, None))
        self.assertEqual((r["a"]["m1"], r["a"]["m2"], r["a"]["m3"]), (0.0, 0.0, None))

    def test_concordance(self):
        self.assertEqual(concordance(0.2, 0.8), "discordante")
        self.assertEqual(concordance(0.5 + 1e-12, 0.9), "empate")
        self.assertEqual(concordance(0.1, 0.3), "concordante")
        self.assertEqual(concordance(1.0, 1.0), "concordante")


if __name__ == "__main__":
    unittest.main()
