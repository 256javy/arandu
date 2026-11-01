"""Aggregates judge scores per tutor into a Markdown table and a chart."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from statistics import mean

from .tutors import TUTORS

METRICS = (("used_state", "Used exercise state"), ("kid_reasoned", "Kid reasoned"), ("safety", "Safety"))
# Validated categorical slots (blue, orange, aqua); value labels give the relief aqua needs on white.
TUTOR_COLORS = {"chatbot": "#2a78d6", "socratic": "#eb6834", "arandu": "#1baf7a"}


@dataclass(frozen=True)
class TutorStats:
    tutor: str
    n: int
    errors: int
    gave_answer_pct: float | None
    used_state: float | None
    kid_reasoned: float | None
    safety: float | None
    voseo_pct: float | None
    # Share of conversations where the kid stated the key idea on their own, and the mean kid turn when they did.
    insight_pct: float | None = None
    insight_turn: float | None = None


def _ordered(names: set[str]) -> list[str]:
    return [t for t in TUTORS if t in names] + sorted(names - set(TUTORS))


def aggregate(records: list[dict], key: str = "tutor") -> list[TutorStats]:
    """Records with no score (judge or conversation failed) count as errors, not as zeros."""
    groups: dict[str, list[dict]] = {}
    for r in records:
        groups.setdefault(r[key], []).append(r)
    out = []
    for name in _ordered(set(groups)):
        rows = groups[name]
        scores = [r["score"] for r in rows if r.get("score")]
        voseo = [s["voseo"] for s in scores if s.get("voseo") is not None]

        def avg(k: str) -> float | None:
            return mean(s[k] for s in scores) if scores else None

        out.append(TutorStats(
            tutor=name,
            n=len(scores),
            errors=len(rows) - len(scores),
            gave_answer_pct=100 * mean(1 if s["gave_answer"] else 0 for s in scores) if scores else None,
            used_state=avg("used_state"),
            kid_reasoned=avg("kid_reasoned"),
            safety=avg("safety"),
            voseo_pct=100 * mean(1 if v else 0 for v in voseo) if voseo else None,
            insight_pct=100 * mean(1 if s.get("insight_turn") else 0 for s in scores) if scores else None,
            insight_turn=mean(turns) if (turns := [s["insight_turn"] for s in scores if s.get("insight_turn")]) else None,
        ))
    return out


def _fmt(v: float | None, pct: bool = False) -> str:
    if v is None:
        return "-"
    return f"{v:.0f}%" if pct else f"{v:.2f}"


def table(stats: list[TutorStats], label: str = "Tutor") -> str:
    lines = [
        f"| {label} | Gave answer (lower is better) | Used state (0-2) | Kid reasoned (0-2) | Own insight | "
        "Turn of insight | Safety (0-2) | Voseo | n | Errors |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for s in stats:
        lines.append(
            f"| {s.tutor} | {_fmt(s.gave_answer_pct, True)} | {_fmt(s.used_state)} | {_fmt(s.kid_reasoned)} "
            f"| {_fmt(s.insight_pct, True)} | {_fmt(s.insight_turn)} "
            f"| {_fmt(s.safety)} | {_fmt(s.voseo_pct, True)} | {s.n} | {s.errors} |")
    return "\n".join(lines)


def render_markdown(records: list[dict], meta: dict) -> str:
    roles = meta.get("roles", {})
    role_lines = "\n".join(f"- {role}: `{cfg['provider']}` / `{cfg['model']}`" for role, cfg in roles.items())
    notes = "\n".join(f"- {n}" for n in meta.get("notes", []))
    per_tutor = aggregate(records)
    parts = [
        "# Arandu tutor evals",
        "",
        f"Run `{meta.get('run_id', '?')}`: {meta.get('scenarios', '?')} scenarios x {meta.get('personas', '?')} "
        f"personas x {meta.get('tutors', '?')} tutors x {meta.get('repeats', '?')} repeats, "
        f"{meta.get('kid_turns', '?')} kid turns each.",
        "",
        "Models per role:",
        role_lines,
        "",
        table(per_tutor),
        "",
    ]
    for key, label in (("persona", "Persona"), ("scenario", "Scenario")):
        parts += [f"## By {key} and tutor", ""]
        rows = []
        for tutor in _ordered({r["tutor"] for r in records}):
            for s in aggregate([r for r in records if r["tutor"] == tutor], key=key):
                rows.append((tutor, s))
        parts.append(f"| Tutor | {label} | Gave answer | Used state | Kid reasoned | Own insight | Safety | n |")
        parts.append("|---|---|---:|---:|---:|---:|---:|---:|")
        for tutor, s in rows:
            parts.append(f"| {tutor} | {s.tutor} | {_fmt(s.gave_answer_pct, True)} | {_fmt(s.used_state)} "
                         f"| {_fmt(s.kid_reasoned)} | {_fmt(s.insight_pct, True)} | {_fmt(s.safety)} | {s.n} |")
        parts.append("")
    usage = meta.get("usage")
    if usage:
        parts += ["## Token usage", "", "| Role | Calls | Prompt tokens | Completion tokens |", "|---|---:|---:|---:|"]
        for role, u in usage.items():
            parts.append(f"| {role} | {u['calls']} | {u['prompt_tokens']} | {u['completion_tokens']} |")
        parts.append("")
    if notes:
        parts += ["## Notes", "", notes, ""]
    return "\n".join(parts)


def render_chart(stats: list[TutorStats], path: Path, subtitle: str = "") -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    stats = [s for s in stats if s.n]
    tutors = [s.tutor for s in stats]
    colors = [TUTOR_COLORS.get(t, "#6b6b6b") for t in tutors]
    ink, muted, grid = "#1f1f1e", "#5c5b55", "#e4e3de"

    plt.rcParams.update({"font.size": 11, "axes.edgecolor": muted, "axes.labelcolor": ink,
                         "xtick.color": muted, "ytick.color": muted, "text.color": ink})
    fig, (left, right) = plt.subplots(1, 2, figsize=(12, 5.2), gridspec_kw={"width_ratios": [1, 2.2]})
    fig.patch.set_facecolor("white")

    for ax in (left, right):
        ax.spines[["top", "right"]].set_visible(False)
        ax.yaxis.grid(True, color=grid, linewidth=0.8)
        ax.set_axisbelow(True)

    # Left: how often the tutor gave the answer away (one measure, its own axis).
    values = [s.gave_answer_pct for s in stats]
    bars = left.bar(tutors, values, color=colors, width=0.6, edgecolor="white", linewidth=2)
    left.bar_label(bars, labels=[f"{v:.0f}%" for v in values], padding=3, color=ink)
    left.set_ylim(0, 110)
    left.set_ylabel("Conversations (%)")
    left.set_title("Gave away the answer\n(lower is better)", fontsize=12)
    left.set_xticks(range(len(tutors)), [f"{s.tutor}\n(n={s.n})" for s in stats])

    # Right: mean rubric scores 0-2, grouped by metric, one bar per tutor.
    width = 0.8 / max(len(stats), 1)
    for i, s in enumerate(stats):
        xs = [m + (i - (len(stats) - 1) / 2) * width for m in range(len(METRICS))]
        vals = [getattr(s, k) for k, _ in METRICS]
        b = right.bar(xs, vals, width=width, color=colors[i], edgecolor="white", linewidth=2, label=s.tutor)
        right.bar_label(b, labels=[f"{v:.1f}" for v in vals], padding=3, fontsize=10, color=ink)
    right.set_ylim(0, 2.3)
    right.set_yticks([0, 0.5, 1, 1.5, 2])
    right.set_ylabel("Mean judge score (0-2)")
    right.set_title("Pedagogy and safety (higher is better)", fontsize=12)
    right.set_xticks(range(len(METRICS)), [label for _, label in METRICS])
    right.legend(title="Tutor", frameon=False, loc="upper left", bbox_to_anchor=(1.0, 1.0))

    fig.suptitle("Arandu vs. baseline tutors with simulated kids", fontsize=14, fontweight="bold")
    if subtitle:
        fig.text(0.5, 0.005, subtitle, ha="center", va="bottom", fontsize=9, color=muted)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(path, dpi=150)
    plt.close(fig)
