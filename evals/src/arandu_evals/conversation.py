"""Runs one conversation between a simulated kid and a tutor."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from .llm import LLM, Completion
from .personas import Persona
from .scenarios import Scenario
from .tutors import Turn, build_messages, event_user_message, scrub

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
    # Acting kids only: the kid turn whose «Comprobar» solved the exercise (None = never or not acting).
    solved_turn: int | None = None
    acting: bool = False

    def as_dict(self) -> dict:
        return asdict(self)


KID_ACT_SYSTEM = """Sos un chico o chica de 10 años de Paraguay usando una app de matemática en la tablet.
En este ejercicio NO hay dónde escribir: lo resolvés tocando y moviendo cosas en la pantalla, y apretás «Comprobar». Al lado tenés a un tutor que te habla con burbujas cortas.

El ejercicio:
{kid_view}

Tu forma de ser (seguila siempre):
{behavior}

Lo que de verdad entendés (no lo uses todo de golpe; usalo cuando el tutor te ayude a pensar o cuando veas algo raro en la pantalla):
{understanding}

Acciones posibles (escribilas EXACTAMENTE así):
{actions}

Cada vez que te toca, respondé solo con:
- de 1 a 3 líneas «HAGO: <acción>» (lo que tocás o movés antes de apretar «Comprobar» otra vez), y
- opcionalmente una línea «DIGO: <lo que decís en voz alta>», corto e informal, con voseo.
Si el tutor te dice exactamente qué hacer, podés hacerlo."""


async def run_acting_conversation(scenario: Scenario, persona: Persona, tutor: str, sim, *, kid_llm: LLM,
                                  tutor_llm: LLM, kid_turns: int, system_prompt: str | None = None) -> Conversation:
    """The kid acts on a manipulable exercise (see actions.py): every kid turn is a set of actions plus
    «Comprobar»; the tutor reacts to the new state like the API does (`event=submitted`). Ends when solved."""
    from .actions import live_scenario, parse_move

    history: list[Turn] = []
    kid_history: list[dict] = []
    kid_usage, tutor_usage = Usage(), Usage()
    record = Conversation(scenario.id, persona.id, tutor, acting=True)
    system = KID_ACT_SYSTEM.format(kid_view=scenario.kid_view, behavior=persona.behavior,
                                   understanding=persona.understanding, actions=sim.actions_help)

    def state_text() -> str:
        return f"[Apreté «Comprobar». Ahora: {sim.describe()}]"

    async def tutor_reply() -> str:
        live = live_scenario(scenario, sim)
        if tutor == "arandu":
            msgs = build_messages(tutor, live, history, system_prompt=system_prompt, event="submitted")
        else:  # baselines get the same state, as text
            msgs = build_messages(tutor, live, history, system_prompt=system_prompt, opener_message=state_text())
        c = await tutor_llm.complete(msgs, temperature=TUTOR_TEMPERATURE)
        tutor_usage.add(c)
        history.append(Turn("tutor", c.text))
        record.turns.append({"role": "tutor", "text": c.text})
        return c.text

    record.turns.append({"role": "state", "text": sim.describe(), "solved": sim.solved()})
    reply = await tutor_reply()
    for k in range(1, kid_turns + 1):
        kid_history.append({"role": "user", "content": (
            f"Pantalla:\n{sim.screen()}\nLa app dice: «{sim.feedback()}»\nTutor: {reply}")})
        c = await kid_llm.complete([{"role": "system", "content": system}, *kid_history], temperature=KID_TEMPERATURE)
        kid_usage.add(c)
        kid_history.append({"role": "assistant", "content": c.text})
        move = parse_move(c.text)
        errors = [f"{a}: {err}" for a in move.actions if (err := sim.apply(a))]
        turn = {"role": "kid", "text": move.said, "actions": list(move.actions), "invalid": errors, "raw": c.text,
                "state": sim.describe(), "solved": sim.solved()}
        if tutor == "arandu":
            # The product has no text field here; what the kid says aloud reaches Musi as the turn's message.
            sent = scrub(move.said) or event_user_message("submitted")
            turn["sent"] = sent
            history.append(Turn("kid", sent))
        else:
            history.append(Turn("kid", (state_text() + (f" {move.said}" if move.said else ""))))
        record.turns.append(turn)
        await tutor_reply()
        if sim.solved():
            record.solved_turn = k
            break
        reply = record.turns[-1]["text"]

    record.usage = {"kid": asdict(kid_usage), "tutor": asdict(tutor_usage)}
    return record


async def run_conversation(scenario: Scenario, persona: Persona, tutor: str, *, kid_llm: LLM, tutor_llm: LLM,
                           kid_turns: int, system_prompt: str | None = None, act: bool = True) -> Conversation:
    from .actions import simulator

    sim = simulator(scenario.id) if act else None
    if sim is not None:
        return await run_acting_conversation(scenario, persona, tutor, sim, kid_llm=kid_llm, tutor_llm=tutor_llm,
                                             kid_turns=kid_turns, system_prompt=system_prompt)
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
