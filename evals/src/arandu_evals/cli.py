"""`arandu-evals run`: local async fan-out."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

from . import personas as P
from . import scenarios as S
from .llm import PROVIDER_CHOICES, ROLES, make_clients, resolve_roles
from .runner import build_specs, new_run_dir, run_all, write_results
from .tutors import TUTORS


def _csv(value: str | None) -> list[str] | None:
    return [v.strip() for v in value.split(",") if v.strip()] if value else None


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="arandu-evals")
    sub = p.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run", help="run conversations, judge them and write results/<timestamp>/")
    run.add_argument("--repeats", type=int, default=1)
    run.add_argument("--kid-turns", type=int, default=int(os.environ.get("ARANDU_EVAL_KID_TURNS", 4)))
    run.add_argument("--concurrency", type=int, default=int(os.environ.get("ARANDU_EVAL_CONCURRENCY", 8)))
    run.add_argument("--scenarios", help=f"comma-separated subset of {[s.id for s in S.SCENARIOS]}")
    run.add_argument("--personas", help=f"comma-separated subset of {[x.id for x in P.PERSONAS]}")
    run.add_argument("--tutors", help=f"comma-separated subset of {list(TUTORS)}")
    defaults = {"kid": "auto", "tutor": "meta", "judge": "meta"}
    for role in ROLES:
        run.add_argument(f"--{role}-provider", choices=PROVIDER_CHOICES,
                         default=os.environ.get(f"ARANDU_EVAL_{role.upper()}_PROVIDER", defaults[role]),
                         help=f"provider for the {role} role (default: {defaults[role]}; auto = Fireworks if it answers)")
    return p


async def _run(args: argparse.Namespace) -> int:
    roles, notes = await resolve_roles({r: getattr(args, f"{r}_provider") for r in ROLES})
    for n in notes:
        print(f"note: {n}", file=sys.stderr)
    clients = make_clients(roles)
    specs = build_specs(repeats=args.repeats, kid_turns=args.kid_turns, scenarios=_csv(args.scenarios),
                        personas=_csv(args.personas), tutors=_csv(args.tutors))
    print(f"{len(specs)} conversations; " + ", ".join(f"{r}={c.provider}/{c.model}" for r, c in roles.items()),
          file=sys.stderr)
    done = 0

    def progress(rec: dict) -> None:
        nonlocal done
        done += 1
        status = "error: " + rec["error"] if rec["error"] else "ok"
        print(f"[{done}/{len(specs)}] {rec['scenario']} {rec['persona']} {rec['tutor']} "
              f"({rec['seconds']}s) {status}", file=sys.stderr)

    records = await run_all(specs, clients, concurrency=args.concurrency, on_done=progress)
    run_id, out_dir = new_run_dir()
    meta = write_results(records, out_dir, run_id=run_id, roles=roles, repeats=args.repeats,
                         kid_turns=args.kid_turns, notes=notes, runner="local")
    print((out_dir / "summary.md").read_text(encoding="utf-8"))
    print(f"results: {out_dir}", file=sys.stderr)
    return 1 if meta["errors"] == len(records) else 0


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.cmd == "run":
        return asyncio.run(_run(args))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
