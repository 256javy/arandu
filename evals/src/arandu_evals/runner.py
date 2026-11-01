"""Fan-out of conversations + judging, and writing of results. Shared by the CLI and the Modal app."""

from __future__ import annotations

import asyncio
import json
import shutil
import time
import traceback
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from . import personas as P
from . import scenarios as S
from .conversation import run_conversation
from .judge import JudgeParseError, judge
from .llm import LLM, RoleConfig
from .summary import aggregate, render_chart, render_markdown
from .tutors import TUTORS, load_system_prompt

RESULTS_DIR = Path(__file__).resolve().parents[2] / "results"


def build_specs(*, repeats: int, kid_turns: int, scenarios: list[str] | None = None,
                personas: list[str] | None = None, tutors: list[str] | None = None, act: bool = True) -> list[dict]:
    """`act`: in manipulable scenarios the simulated kid acts on the exercise (actions.py) instead of chatting."""
    specs = []
    for r in range(repeats):
        for s in scenarios or [x.id for x in S.SCENARIOS]:
            for p in personas or [x.id for x in P.PERSONAS]:
                for t in tutors or list(TUTORS):
                    specs.append({"scenario": s, "persona": p, "tutor": t, "repeat": r, "kid_turns": kid_turns,
                                  "act": act})
    return specs


async def run_spec(spec: dict, clients: dict[str, LLM], system_prompt: str | None = None) -> dict:
    """One conversation and its blind score. Failures are recorded, never raised."""
    scenario, persona = S.BY_ID[spec["scenario"]], P.BY_ID[spec["persona"]]
    record = {**spec, "turns": [], "score": None, "error": None, "usage": {}}
    started = time.monotonic()
    try:
        conv = await run_conversation(scenario, persona, spec["tutor"], kid_llm=clients["kid"],
                                      tutor_llm=clients["tutor"], kid_turns=spec["kid_turns"],
                                      system_prompt=system_prompt, act=spec.get("act", True))
        record["turns"], record["usage"] = conv.turns, conv.usage
        if conv.acting:  # deterministic outcome from the exercise check, not from the judge
            record["solved_turn"] = conv.solved_turn
        try:
            score, usage = await judge(clients["judge"], scenario, conv.turns)
            record["score"] = score.as_dict()
            record["usage"]["judge"] = usage
        except JudgeParseError as e:
            record["error"] = f"judge: {e}"
            record["usage"]["judge"] = getattr(e, "usage", {})
    except Exception as e:  # noqa: BLE001 - one failed conversation must not sink the run
        record["error"] = f"{type(e).__name__}: {e}"
        record["traceback"] = traceback.format_exc(limit=3)
    record["seconds"] = round(time.monotonic() - started, 1)
    return record


async def run_all(specs: list[dict], clients: dict[str, LLM], *, concurrency: int,
                  on_done=None) -> list[dict]:
    system_prompt = load_system_prompt()  # read once so every arandu conversation uses the same prompt
    sem = asyncio.Semaphore(concurrency)

    async def one(spec: dict) -> dict:
        async with sem:
            rec = await run_spec(spec, clients, system_prompt)
        if on_done:
            on_done(rec)
        return rec

    return await asyncio.gather(*(one(s) for s in specs))


def total_usage(records: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in records:
        for role, u in (r.get("usage") or {}).items():
            acc = out.setdefault(role, {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0})
            for k in acc:
                acc[k] += u.get(k, 0)
    return out


def new_run_dir(base: Path = RESULTS_DIR) -> tuple[str, Path]:
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = base / run_id
    path.mkdir(parents=True, exist_ok=False)
    return run_id, path


def write_results(records: list[dict], out_dir: Path, *, run_id: str, roles: dict[str, RoleConfig],
                  repeats: int, kid_turns: int, notes: list[str], runner: str, base: Path = RESULTS_DIR) -> dict:
    """Writes conversations.jsonl, scores.jsonl, meta.json, summary.md, chart.png and refreshes latest/."""
    records = sorted(records, key=lambda r: (r["repeat"], r["scenario"], r["persona"], r["tutor"]))
    keys = ("scenario", "persona", "tutor", "repeat")
    with (out_dir / "conversations.jsonl").open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps({**{k: r[k] for k in keys}, "turns": r["turns"], "error": r["error"],
                                "usage": r["usage"], "seconds": r.get("seconds"),
                                **({"solved_turn": r["solved_turn"]} if "solved_turn" in r else {})},
                               ensure_ascii=False) + "\n")
    with (out_dir / "scores.jsonl").open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps({**{k: r[k] for k in keys}, "score": r["score"], "error": r["error"],
                                **({"solved_turn": r["solved_turn"]} if "solved_turn" in r else {})},
                               ensure_ascii=False) + "\n")

    meta = {
        "run_id": run_id,
        "runner": runner,
        "roles": {k: asdict(v) for k, v in roles.items()},
        "repeats": repeats,
        "kid_turns": kid_turns,
        "scenarios": len({r["scenario"] for r in records}),
        "personas": len({r["persona"] for r in records}),
        "tutors": len({r["tutor"] for r in records}),
        "conversations": len(records),
        "errors": sum(1 for r in records if r["error"]),
        "usage": total_usage(records),
        "notes": notes,
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out_dir / "summary.md").write_text(render_markdown(records, meta), encoding="utf-8")
    stats = aggregate(records)
    if any(s.n for s in stats):
        subtitle = (f"{meta['conversations']} conversations, {kid_turns} kid turns each; "
                    f"tutor {roles['tutor'].model}, kid {roles['kid'].model}, judge {roles['judge'].model}")
        render_chart(stats, out_dir / "chart.png", subtitle)

    latest = base / "latest"
    latest.mkdir(parents=True, exist_ok=True)
    for name in ("summary.md", "chart.png"):
        if (out_dir / name).exists():
            shutil.copyfile(out_dir / name, latest / name)
    return meta
