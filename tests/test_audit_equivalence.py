"""The product pipeline gives the same graph and metrics as mapa/ on the same session.

Uses mapa's own cache, so it never calls the model. Skipped when mapa/ is not there.
"""
import json
import unittest
from pathlib import Path

from app.audit.graph import build_graph, cache_path, extract_events
from app.audit.metrics import metrics_document

MAPA = Path(__file__).resolve().parent.parent / "mapa"
SESSION = MAPA / "vognis-sesion-2026-11-15-reactiva.json"


def cached_only(user_msg, ev):
    path = cache_path(MAPA / "cache", user_msg, ev)
    if not path.exists():
        raise AssertionError(f"cache miss for seq={ev['seq']} idx={ev['idx']}")
    return json.loads(path.read_text(encoding="utf-8"))


@unittest.skipUnless(SESSION.exists() and (MAPA / "graph.json").exists(), "mapa/ not present")
class TestSameAsMapa(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data = json.loads(SESSION.read_text(encoding="utf-8"))
        cls.graph = build_graph(extract_events(data["entries"]), cached_only)
        cls.metrics = metrics_document(cls.graph)

    def test_graph(self):
        expected = json.loads((MAPA / "graph.json").read_text(encoding="utf-8"))
        self.assertEqual(self.graph["nodes"], expected["nodes"])
        self.assertEqual(self.graph["edges"], expected["edges"])

    def test_metrics(self):
        expected = json.loads((MAPA / "metrics.json").read_text(encoding="utf-8"))
        self.assertEqual(self.metrics, expected)


if __name__ == "__main__":
    unittest.main()
