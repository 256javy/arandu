"""Fans out the Arandu evals as Modal function calls.

Reuses the `arandu_evals` package from evals/src (shipped with add_local_python_source) and the real
tutor prompt from apps/api. API keys come from the Modal Secret `arandu-llm`.

    uv --directory evals run --extra modal modal run ../infra/modal/evals_app.py --repeats 3

Simulated kids on Muse Glimmer (see infra/modal/README.md):

    GLIMMER_BASE_URL=https://<workspace>--arandu-glimmer-server.modal.run/v1 \
    uv --directory evals run --extra modal modal run ../infra/modal/evals_app.py --repeats 3 --kid-provider glimmer
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import modal

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "evals" / "src"))  # so the local entrypoint and add_local_python_source find it

from arandu_evals.tutors import DEFAULT_PROMPT_PATH  # noqa: E402

REMOTE_PROMPT = "/root/prompts/musi-system.md"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install("openai>=1.60", "matplotlib>=3.9")
    .env({"ARANDU_PROMPT_PATH": REMOTE_PROMPT})
    .add_local_file(DEFAULT_PROMPT_PATH, REMOTE_PROMPT)
    .add_local_python_source("arandu_evals")
)

app = modal.App("arandu-evals", image=image)
secrets = [modal.Secret.from_name("arandu-llm")]
# Opt-in Muse Glimmer (infra/modal/glimmer_app.py): export GLIMMER_BASE_URL locally before `modal run` and
# its URL/model travel to the containers; the key comes from the same Secret the server validates against.
if os.environ.get("GLIMMER_BASE_URL"):
    secrets += [
        modal.Secret.from_dict({"GLIMMER_BASE_URL": os.environ["GLIMMER_BASE_URL"],
                                "GLIMMER_MODEL": os.environ.get("GLIMMER_MODEL", "muse-glimmer")}),
        modal.Secret.from_name("arandu-glimmer"),
    ]


@app.function(secrets=secrets, timeout=60 * 15, retries=0)
async def resolve(requested: dict[str, str]) -> dict:
    """Probes providers from inside Modal, where the keys live."""
    from dataclasses import asdict

    from arandu_evals.llm import resolve_roles, warm_up_roles

    roles, notes = await resolve_roles(requested)
    await warm_up_roles(roles)  # wakes the Glimmer server once instead of in every fanned-out call
    return {"roles": {k: asdict(v) for k, v in roles.items()}, "notes": notes}


@app.function(secrets=secrets, timeout=60 * 15, max_containers=16)
async def run_one(spec: dict, roles: dict[str, dict], tutor_effort: str = "minimal") -> dict:
    from arandu_evals.llm import RoleConfig, make_clients
    from arandu_evals.runner import run_spec
    from arandu_evals.tutors import load_system_prompt

    clients = make_clients({k: RoleConfig(**v) for k, v in roles.items()}, {"tutor": tutor_effort})
    return await run_spec(spec, clients, load_system_prompt())


@app.local_entrypoint()
def main(repeats: int = 1, kid_turns: int = 4, kid_provider: str = "auto", tutor_provider: str = "meta",
         judge_provider: str = "meta", scenarios: str = "", personas: str = "", tutors: str = "",
         tutor_effort: str = "minimal"):
    from arandu_evals.llm import RoleConfig, check_glimmer_config
    from arandu_evals.runner import build_specs, new_run_dir, write_results

    def csv(v: str) -> list[str] | None:
        return [x for x in v.split(",") if x] or None

    requested = {"kid": kid_provider, "tutor": tutor_provider, "judge": judge_provider}
    check_glimmer_config(requested, required=("GLIMMER_BASE_URL",))  # the key comes from the Modal Secret
    resolved = resolve.remote(requested)
    for n in resolved["notes"]:
        print(f"note: {n}")
    specs = build_specs(repeats=repeats, kid_turns=kid_turns, scenarios=csv(scenarios),
                        personas=csv(personas), tutors=csv(tutors))
    print(f"{len(specs)} conversations on Modal")
    records = list(run_one.starmap([(s, resolved["roles"], tutor_effort) for s in specs]))

    run_id, out_dir = new_run_dir()
    roles = {k: RoleConfig(**v) for k, v in resolved["roles"].items()}
    notes = resolved["notes"] + [f"tutor reasoning_effort={tutor_effort} (kid and judge: low)"]
    write_results(records, out_dir, run_id=run_id, roles=roles, repeats=repeats, kid_turns=kid_turns,
                  notes=notes, runner="modal")
    print((out_dir / "summary.md").read_text(encoding="utf-8"))
    print(f"results: {out_dir}")
