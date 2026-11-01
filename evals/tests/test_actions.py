"""Acting kids: the state machines mirror apps/web/src/exercises/*.tsx (cases from the vitest files)."""

import json

from arandu_evals import scenarios as S
from arandu_evals.actions import NumberLine, Pizza, Recipe, feeds, parse_move, simulator
from arandu_evals.judge import render_case
from arandu_evals.llm import Completion
from arandu_evals.runner import build_specs, run_all
from arandu_evals.summary import aggregate, table

# --- mirrors of share-bar.test.ts -------------------------------------------------------------------------


def test_pizza_check_mirrors_web():
    assert Pizza([0.25, 0.5, 0.75]).check()[0].ok
    assert Pizza([0.27, 0.5, 0.75]).check()[0].ok
    assert not Pizza([0.36, 0.57, 0.79]).check()[0].ok
    assert not Pizza([0.5]).check()[0].ok
    assert Pizza([0.5]).check()[0].detail == "Hay 2 partes en lugar de 4."


def test_pizza_describe_mirrors_web():
    assert Pizza([0.36, 0.57, 0.79]).describe() == (
        "La pizza tiene 4 pedazos, y no son todos iguales: algunos son un poco más grandes. "
        "De izquierda a derecha, el 1.º pedazo es el más grande y el 2.º el más chico.")
    assert Pizza([0.2, 0.3, 0.75]).describe() == (
        "La pizza tiene 4 pedazos, y algunos son mucho más grandes que otros. "
        "De izquierda a derecha, el 3.º pedazo es el más grande y el 2.º el más chico.")
    assert Pizza([0.25, 0.5, 0.75]).describe() == "La pizza tiene 4 pedazos, todos iguales."
    assert Pizza([0.45, 0.65, 0.82]).describe() == S.BY_ID["fractions.share-bar"].state


def test_pizza_actions():
    p = Pizza([0.45, 0.65, 0.82])
    assert p.apply("mover corte 1 izquierda mucho") is None and abs(sorted(p.cuts)[0] - 0.35) < 1e-9
    assert p.apply("mover corte 9 izquierda poco") == "no hay corte 9"
    assert p.apply("sacar corte 3") is None and len(p.cuts) == 2
    assert p.apply("agregar corte") is None and len(p.cuts) == 3
    assert p.apply("bailar") == "acción desconocida"
    assert "%" not in p.screen() and "iguales" not in p.screen()


# --- mirrors of number-line.test.ts -----------------------------------------------------------------------


def nl(mom, brother, choice=None):
    return NumberLine({"mom": mom, "brother": brother}, {"mom": True, "brother": True}, choice)


def test_number_line_check_mirrors_web():
    assert nl(0.75, 0.67, "mom").check()[0].ok
    e = nl(0.75, 0.8, "mom").check()[0]
    assert not e.ok and e.detail == "2/3 quedó en 0,80 (error 0,13)."
    assert not nl(0.75, 0.67, "brother").check()[0].ok
    untouched = NumberLine().check()[0]
    assert not untouched.ok and "sin ubicar" in untouched.detail


def test_number_line_describe_matches_scenarios():
    assert nl(0.75, 0.8, "brother").describe() == S.BY_ID["fractions.number-line"].state
    assert nl(0.62, 0.78, "brother").describe() == S.BY_ID["fractions.number-line-again"].state
    assert nl(0.62, 0.78, "brother").check()[0].detail == S.BY_ID["fractions.number-line-again"].evidence[0].detail


def test_number_line_actions_and_screen_without_verdict():
    s = nl(0.75, 0.8, "brother")
    assert s.apply("mover hermano izquierda mucho") is None and abs(s.pos["brother"] - 0.65) < 1e-9
    assert s.apply("mover hermano derecha poco") is None and abs(s.pos["brother"] - 0.7) < 1e-9
    assert s.apply("elegir mamá") is None and s.solved() and s.feedback() == "¡Eso es!"
    assert not any(w in s.screen() for w in ("lugar", "cerca", "bien", "mal"))
    assert NumberLine().apply("elegir mama") == "ese celular no está en la recta"


# --- mirrors of recipe.test.ts ----------------------------------------------------------------------------


def test_recipe_mirrors_web():
    assert feeds({"flour": 4, "eggs": 8, "milk": 4}) == 8
    assert feeds({"flour": 4, "eggs": 5, "milk": 4}) == 5
    r = Recipe({"flour": 4, "eggs": 6, "milk": 4})
    assert r.check()[0].detail == "Para 8: huevos 6 (va 8)."
    assert "alcanza solo para 6" in r.describe() and r.describe() == S.BY_ID["proportions.recipe"].state
    assert r.feedback() == "Mirá: ¿es la misma receta para todos?"
    assert r.apply("+ huevos") is None and r.apply("mas huevo") is None
    assert r.solved() and r.feedback() == "¡Alcanza para 8!" and r.describe().endswith("justo para 8.")


def test_memory_counts_earlier_checks_like_the_api():
    from arandu_evals.actions import live_scenario
    from arandu_evals.tutors import context

    sc = S.BY_ID["fractions.number-line-again"]
    sim = NumberLine({"mom": 0.62, "brother": 0.78}, {"mom": True, "brother": True}, "brother")
    first = live_scenario(sc, sim, [])
    assert first.memory == sc.memory
    later = live_scenario(sc, sim, [*sim.check(), *sim.check()])
    ctx = context(later, "submitted")
    assert ctx.endswith(
        "\n- partes iguales: 2 de 2 bien, último intento en fractions.share-bar (lo podés usar como puente)"
        "\n- comparar fracciones: 0 de 4 bien, último intento en fractions.number-line")
    fresh = live_scenario(S.BY_ID["proportions.recipe"], Recipe({"flour": 4, "eggs": 6, "milk": 4}),
                          [Recipe({"flour": 4, "eggs": 6, "milk": 4}).check()[0]])
    assert "agrandar una receta: 0 de 1 bien, último intento en proportions.recipe" in context(fresh, "submitted")


def test_parse_move():
    m = parse_move("HAGO: mover corte 1 izquierda mucho\nhago: agregar corte\nDIGO: el primero era re grande\n"
                   "HAGO: a\nHAGO: b")
    assert m.actions == ("mover corte 1 izquierda mucho", "agregar corte", "a")
    assert m.said == "el primero era re grande"
    assert parse_move("no sé").actions == ()


def test_only_manipulables_have_a_simulator():
    assert simulator("fractions.explain-compare") is None
    assert isinstance(simulator("fractions.number-line-again"), NumberLine)


# --- conversation, judge and summary ----------------------------------------------------------------------

GOOD = {"gave_answer": False, "used_state": 2, "kid_reasoned": 2, "insight_turn": None, "safety": 2, "voseo": True,
        "rationale": "ok"}


class FakeLLM:
    provider, model = "fake", "fake-1"

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls: list[list[dict]] = []

    async def complete(self, messages, *, temperature):
        self.calls.append(messages)
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        return Completion(reply, 10, 5)


async def test_acting_kid_solves_and_conversation_stops():
    kid = FakeLLM(["HAGO: mover hermano izquierda mucho\nDIGO: mi 0981 123 456",
                   "HAGO: mover hermano derecha poco\nHAGO: elegir mama"] * 2)  # one pair per tutor
    tutor, judge_llm = FakeLLM(["¿Cuál batería se ve más llena?"]), FakeLLM([json.dumps(GOOD)])
    specs = build_specs(repeats=1, kid_turns=4, personas=["copier"], scenarios=["fractions.number-line"],
                        tutors=["arandu", "socratic"])
    records = await run_all(specs, {"kid": kid, "tutor": tutor, "judge": judge_llm}, concurrency=1)
    by = {r["tutor"]: r for r in records}
    assert all(r["error"] is None and r["solved_turn"] == 2 for r in records)

    kid_turns = [t for t in by["arandu"]["turns"] if t["role"] == "kid"]
    assert kid_turns[0]["sent"] == "mi [dato oculto]" and kid_turns[1]["sent"] == "[Apreté «Listo»]"
    assert kid_turns[1]["solved"]

    # Arandu sees the new state as event=submitted in its context; the baseline sees it as text.
    arandu_calls = [c for c in tutor.calls if c[0]["role"] == "system" and "Musi" in c[0]["content"]]
    assert "Evento: submitted" in arandu_calls[-1][1]["content"]
    assert "2/3 (Hermano) en su lugar" in arandu_calls[-1][1]["content"]
    socratic_calls = [c for c in tutor.calls if c not in arandu_calls]
    assert "[Apreté «Comprobar». Ahora: Recta de 0 a 1" in socratic_calls[0][-1]["content"]

    case = render_case(S.BY_ID["fractions.number-line"], by["arandu"]["turns"])
    assert "Kid 2: [did: mover hermano derecha poco; elegir mama] -> exercise now:" in case
    assert "(SOLVED)" in case and "Outcome: solved at kid turn 2." in case

    stats = {s.tutor: s for s in aggregate(records)}
    assert stats["arandu"].solved_pct == 100 and stats["arandu"].solve_turn == 2
    assert "| 100% | 2.00 |" in table([stats["arandu"]])


async def test_acting_kid_that_never_solves():
    kid, tutor, judge_llm = FakeLLM(["HAGO: bailar"]), FakeLLM(["Mirá la receta."]), FakeLLM([json.dumps(GOOD)])
    specs = build_specs(repeats=1, kid_turns=2, personas=["copier"], scenarios=["proportions.recipe"],
                        tutors=["arandu"])
    (r,) = await run_all(specs, {"kid": kid, "tutor": tutor, "judge": judge_llm}, concurrency=1)
    assert r["solved_turn"] is None and r["turns"][2]["invalid"] == ["bailar: acción desconocida"]
    (s,) = aggregate([r])
    assert s.solved_pct == 0 and s.solve_turn is None
