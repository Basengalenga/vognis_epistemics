"""
Vognis Scoring Engine v2 - The Mathematical Core.

PS = (DC * NC * T) ^ (1/3)                              # Serendipity Points (geometric mean)
CI = (VS + MP) / 2                                       # Idea Quality
Penalty = min(1 + max(0, (DC - threshold) / max(PCF, 0.1)), 5)  # Sterile Abstraction Filter
VI = PS * (log(1 + CI) / log(2)) * (1 / Penalty)        # Innovation Value
"""

import math

from app.models.schemas import AgentScores, ScoreResult

CRITICAL_THRESHOLD = 0.7  # DC threshold before penalty kicks in
PCF_FLOOR = 0.1           # Numerical stability floor for PCF
PENALTY_CAP = 5           # Maximum penalty to avoid annihilating ideas

LOG2 = math.log(2)


def compute_scores(scores: AgentScores) -> ScoreResult:
    # Geometric mean avoids distribution crushing (3 × 0.7 → 0.7, not 0.343)
    ps = (scores.dc * scores.nc * scores.t) ** (1 / 3)

    ci = (scores.vs + scores.mp) / 2
    ci = max(ci, 0.01)  # floor to avoid log(0)

    pcf_safe = max(scores.pcf, PCF_FLOOR)
    gap = scores.dc - CRITICAL_THRESHOLD
    penalty = min(1 + max(0, gap / pcf_safe), PENALTY_CAP)

    # log(1+CI)/log(2) normalizes viability to [0, 1] with diminishing returns
    vi = ps * (math.log(1 + ci) / LOG2) * (1 / penalty)

    return ScoreResult(
        ps=round(ps, 4),
        ci=round(ci, 4),
        penalty=round(penalty, 4),
        vi=round(vi, 4),
        agent_scores=scores,
    )
