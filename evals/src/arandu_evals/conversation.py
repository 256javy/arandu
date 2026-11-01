"""Runs one conversation between a simulated kid and a tutor."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from .llm import LLM, Completion
from .personas import Persona
from .scenarios import Scenario
from .tutors import Turn, build_messages, scrub

KID_TEMPERATURE = 0.9
TUTOR_TEMPERATURE = 0.4  # same as the product (OpenAiCompatibleTutorModel)

KID_SYSTEM = """Sos un chico o chica de 10 años de Paraguay que está usando una app de matemática con un tutor en un chat.
Escribís como un chico de verdad: mensajes cortos (una o dos oraciones), informales, con voseo, sin emojis exagerados y a veces sin tildes.

Lo que hiciste en el ejercicio:
{kid_view}

Tu forma de ser (seguila siempre):
{behavior}

Lo que de verdad entendés (no lo digas de golpe; usalo solo cuando el tutor te ayude a pensar):
{understanding}

Reglas:
- Respondé solo con tu próximo mensaje en el chat, sin comillas ni explicaciones.
- No resolvás todo de una: pensá paso a paso solo si el tutor te guía con preguntas.
- Si el tutor te da la respuesta, podés copiarla."""


def kid_messages(persona: Persona, scenario: Scenario, history: list[Turn]) -> list[dict]:
    """From the kid's point of view the tutor is the "user" and the kid is the "assistant"."""
    messages = [{"role": "system", "content": KID_SYSTEM.format(
        kid_view=scenario.kid_view, behavior=persona.behavior, understanding=persona.understanding)}]
    for t in history:
        messages.append({"role": "user" if t.role == "tutor" else "assistant", "content": t.text})
    return messages


@dataclass
class Usage:
    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0

    def add(self, c: Completion) -> None:
        self.calls += 1
        self.prompt_tokens += c.prompt_tokens
        self.completion_tokens += c.completion_tokens


@dataclass
class Conversation:
    scenario: str
    persona: str
    tutor: str
    turns: list[dict] = field(default_factory=list)
    usage: dict[str, dict] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


async def run_conversation(scenario: Scenario, persona: Persona, tutor: str, *, kid_llm: LLM, tutor_llm: LLM,
                           kid_turns: int, system_prompt: str | None = None) -> Conversation:
    history: list[Turn] = []
    kid_usage, tutor_usage = Usage(), Usage()
    record = Conversation(scenario.id, persona.id, tutor)

    async def tutor_reply() -> None:
        c = await tutor_llm.complete(build_messages(tutor, scenario, history, system_prompt=system_prompt),
                                     temperature=TUTOR_TEMPERATURE)
        tutor_usage.add(c)
        history.append(Turn("tutor", c.text))
        record.turns.append({"role": "tutor", "text": c.text})

    await tutor_reply()
    for _ in range(kid_turns):
        c = await kid_llm.complete(kid_messages(persona, scenario, history), temperature=KID_TEMPERATURE)
        kid_usage.add(c)
        history.append(Turn("kid", c.text))
        turn = {"role": "kid", "text": c.text}
        if tutor == "arandu":
            turn["sent"] = scrub(c.text)  # what the product would forward to the model
        record.turns.append(turn)
        await tutor_reply()

    record.usage = {"kid": asdict(kid_usage), "tutor": asdict(tutor_usage)}
    return record
