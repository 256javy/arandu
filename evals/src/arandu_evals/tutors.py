"""Tutors under test. `arandu` mirrors apps/api TutorController: same prompt file, context block and scrubbing."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from .scenarios import Scenario

_HERE = Path(__file__).resolve()
# evals/src/arandu_evals/tutors.py -> repo root; shallower when shipped alone (Modal sets ARANDU_PROMPT_PATH).
REPO_ROOT = _HERE.parents[3] if len(_HERE.parents) > 3 else _HERE.parent
DEFAULT_PROMPT_PATH = REPO_ROOT / "apps/api/src/main/resources/prompts/musi-system.md"

# Same patterns as TutorController (Java regex classes are ASCII-only by default).
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", re.ASCII)
PHONE = re.compile(r"\+?\d[\d\s().-]{6,}\d", re.ASCII)

TUTORS = ("chatbot", "socratic", "arandu")

# ExerciseCatalog.Mode.EXPLAIN; every other exercise is manipulable (no text field).
EXPLAIN_EXERCISES = frozenset({"fractions.explain-compare", "fractions.explain-equivalence"})

CHATBOT_PROMPT = (
    "Sos un asistente útil y amable. Ayudá al usuario con lo que necesite.\n\n"
    "El usuario está trabajando en este problema: {goal}"
)

SOCRATIC_PROMPT = (
    "Sos un tutor de matemática socrático para chicos. No des las respuestas: hacé preguntas "
    "que ayuden al chico a descubrirlas por sí mismo.\n\n"
    "El chico está trabajando en este problema: {goal}"
)

EVENT_MESSAGES = {
    "submitted": "[Apreté «Listo»]",
    "stuck": "[Apreté «Me trabé»]",
}


def scrub(text: str | None) -> str:
    if text is None:
        return ""
    return PHONE.sub("[dato oculto]", EMAIL.sub("[dato oculto]", text))


def prompt_path() -> Path:
    return Path(os.environ.get("ARANDU_PROMPT_PATH") or DEFAULT_PROMPT_PATH)


def load_system_prompt() -> str:
    return prompt_path().read_text(encoding="utf-8")


def context(scenario: Scenario, event: str) -> str:
    """Same format as TutorController.context() followed by memory() of earlier sessions."""
    sb = f"Ejercicio: {scenario.exercise_id}"
    sb += "\nTipo: " + ("explicar (el chico escribe su respuesta)" if scenario.exercise_id in EXPLAIN_EXERCISES
                        else "manipulable (el chico toca y mueve; no puede escribir)")
    if scenario.goal is not None:
        sb += f"\nObjetivo: {scenario.goal}"
    if scenario.state is not None:
        sb += f"\nEstado actual (números internos, no los digas): {scenario.state}"
    sb += f"\nEvento: {event}"
    for e in scenario.evidence:
        sb += f"\nEvidencia: {e.skill}{' (bien' if e.ok else ' (mal'}, confianza {e.confidence})"
        if e.detail is not None:
            sb += f" {e.detail}"
    return sb + memory(scenario)


def memory(scenario: Scenario) -> str:
    """Same format as TutorController.memory(); empty when the scenario has no earlier sessions."""
    sb = ""
    for m in scenario.memory:
        if m.attempts == 0:
            continue
        sb += ("\nMemoria de sesiones anteriores:" if not sb else "") + (
            f"\n- {m.label}: {m.successes} de {m.attempts} bien, último intento en {m.last_exercise}"
            + (" (lo podés usar como puente)" if m.successes > 0 else ""))
    return sb


def event_user_message(event: str) -> str:
    """Muse Spark rejects requests without a user message; same placeholder as TutorController."""
    return EVENT_MESSAGES.get(event, f"[Evento: {event}]")


@dataclass(frozen=True)
class Turn:
    role: str  # "tutor" | "kid"
    text: str


def build_messages(tutor: str, scenario: Scenario, history: list[Turn], *,
                   system_prompt: str | None = None) -> list[dict]:
    """Messages for the tutor's next reply. An empty history means the opener (reacting to the event)."""
    opener = not history
    if tutor == "arandu":
        event = scenario.event if opener else "message"
        messages = [
            {"role": "system", "content": system_prompt if system_prompt is not None else load_system_prompt()},
            {"role": "system", "content": context(scenario, event)},
        ]
        clean = scrub
    elif tutor in ("chatbot", "socratic"):
        template = CHATBOT_PROMPT if tutor == "chatbot" else SOCRATIC_PROMPT
        messages = [{"role": "system", "content": template.format(goal=scenario.goal)}]
        clean = lambda t: t  # noqa: E731 - baselines have no privacy guardrails
    else:
        raise ValueError(f"unknown tutor {tutor!r}")

    for t in history:
        if t.role == "tutor":
            messages.append({"role": "assistant", "content": t.text})
        else:
            messages.append({"role": "user", "content": clean(t.text)})
    if opener:
        messages.append({"role": "user", "content": event_user_message(scenario.event)})
    return messages
