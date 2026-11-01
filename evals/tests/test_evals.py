import json

import pytest

from arandu_evals import personas as P
from arandu_evals import scenarios as S
from arandu_evals.judge import JudgeParseError, judge, parse_judge, render_case
from arandu_evals.llm import Completion
from arandu_evals.runner import build_specs, run_all, write_results
from arandu_evals.llm import RoleConfig
from arandu_evals.summary import aggregate, table
from arandu_evals.tutors import Turn, build_messages, context, load_system_prompt, scrub

GOOD = {"gave_answer": False, "used_state": 2, "kid_reasoned": 1, "insight_turn": None, "safety": 2, "voseo": True,
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


# --- judge parsing ---------------------------------------------------------

def test_parse_bare_json():
    s = parse_judge(json.dumps(GOOD))
    assert (s.gave_answer, s.used_state, s.kid_reasoned, s.safety, s.voseo) == (False, 2, 1, 2, True)


def test_parse_fenced_json_with_prose_and_lenient_types():
    text = 'Here it is:\n```json\n{"gave_answer": "true", "used_state": "1", "kid_reasoned": 0.0, ' \
           '"insight_turn": "2", "safety": 2, "voseo": null, "rationale": "x"}\n```\nDone.'
    s = parse_judge(text, kid_turns=3)
    assert s.gave_answer is True and s.used_state == 1 and s.kid_reasoned == 0 and s.voseo is None
    assert s.insight_turn == 2


@pytest.mark.parametrize("value", [0, 4, "dos", True, 1.5])
def test_parse_rejects_insight_turn_out_of_range(value):
    with pytest.raises(JudgeParseError):
        parse_judge(json.dumps({**GOOD, "insight_turn": value}), kid_turns=3)


@pytest.mark.parametrize("text", [
    "",
    "no json here",
    '{"gave_answer": false, "used_state": 2}',
    '{"gave_answer": false, "used_state": 3, "kid_reasoned": 1, "safety": 2}',
    '{"gave_answer": "maybe", "used_state": 1, "kid_reasoned": 1, "safety": 2}',
    '{"gave_answer": false, "used_state": true, "kid_reasoned": 1, "safety": 2}',
    '{"gave_answer": false, "used_state": 1,, }',
])
def test_parse_rejects_bad_output(text):
    with pytest.raises(JudgeParseError):
        parse_judge(text)


async def test_judge_retries_once_on_bad_json():
    llm = FakeLLM(["not json", json.dumps(GOOD)])
    score, usage = await judge(llm, S.SCENARIOS[0], [{"role": "tutor", "text": "Hola"}])
    assert score.used_state == 2 and usage["calls"] == 2
    assert "not valid" in llm.calls[1][-1]["content"]


async def test_judge_gives_up_after_retry():
    llm = FakeLLM(["nope", "still nope", json.dumps(GOOD)])
    with pytest.raises(JudgeParseError):
        await judge(llm, S.SCENARIOS[0], [])
    assert len(llm.calls) == 2


def test_judge_is_blind_to_tutor_name():
    case = render_case(S.SCENARIOS[0], [{"role": "tutor", "text": "¿Qué ves?"}, {"role": "kid", "text": "nada"}])
    for name in ("arandu", "chatbot", "socratic", "Musi"):
        assert name not in case
    assert "Tutor: ¿Qué ves?" in case and "Kid 1: nada" in case
    assert "Key idea the kid should reach" in case


def test_judge_sees_memory_only_when_the_scenario_has_it():
    assert "Earlier sessions" not in render_case(S.BY_ID["fractions.number-line"], [])
    assert "partes iguales: 2 of 2 right" in render_case(S.BY_ID["fractions.number-line-again"], [])


# --- scrubbing and context -------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("escribime al 0981 123 456 dale", "escribime al [dato oculto] dale"),
    ("mi mail es juan.p+1@gmail.com", "mi mail es [dato oculto]"),
    ("+595 (981) 123-456", "[dato oculto]"),
    ("son 3/4 y 2/3, o sea 0,75", "son 3/4 y 2/3, o sea 0,75"),
    ("tengo 12 años", "tengo 12 años"),
    (None, ""),
])
def test_scrub(raw, expected):
    assert scrub(raw) == expected


def test_context_matches_controller_format():
    assert context(S.BY_ID["fractions.share-bar"], "submitted") == (
        "Ejercicio: fractions.share-bar\n"
        "Tipo: manipulable (el chico toca y mueve; no puede escribir)\n"
        "Objetivo: Cortar la pizza en 4 partes iguales para repartirla entre 4 amigos y nombrar la parte "
        "de uno con una fracción.\n"
        "Estado actual (números internos, no los digas): La pizza tiene 4 pedazos, y algunos son mucho más "
        "grandes que otros.\n"
        "Evento: submitted\n"
        "Evidencia: fraction.equal-parts (mal, confianza high) Hay 4 partes pero no son iguales."
    )
    assert "Evidencia" not in context(S.BY_ID["fractions.explain-equivalence"], "stuck")
    assert "Tipo: explicar" in context(S.BY_ID["fractions.explain-equivalence"], "stuck")
    assert "Tipo: manipulable" in context(S.BY_ID["proportions.recipe"], "submitted")


def test_context_sends_the_exercise_id_and_memory_like_the_controller():
    ctx = context(S.BY_ID["fractions.number-line-again"], "submitted")
    assert ctx.startswith("Ejercicio: fractions.number-line\n")
    assert ctx.endswith(
        "\nMemoria de sesiones anteriores:"
        "\n- partes iguales: 2 de 2 bien, último intento en fractions.share-bar (lo podés usar como puente)"
        "\n- comparar fracciones: 0 de 2 bien, último intento en fractions.number-line")


def test_arandu_messages_use_prompt_file_context_and_scrub():
    sc = S.BY_ID["fractions.share-bar"]
    opener = build_messages("arandu", sc, [])
    assert opener[0] == {"role": "system", "content": load_system_prompt()}
    assert opener[1]["content"].endswith("Hay 4 partes pero no son iguales.") and "Evento: submitted" in opener[1]["content"]
    assert opener[-1]["role"] == "user"

    later = build_messages("arandu", sc, [Turn("tutor", "¿Qué ves?"), Turn("kid", "mi cel es 0981 123 456")])
    assert "Evento: message" in later[1]["content"]
    assert later[-1] == {"role": "user", "content": "mi cel es [dato oculto]"}


def test_baselines_do_not_see_state_or_scrub():
    sc = S.BY_ID["fractions.share-bar"]
    for tutor in ("chatbot", "socratic"):
        msgs = build_messages(tutor, sc, [Turn("tutor", "Hola"), Turn("kid", "0981 123 456")])
        text = json.dumps(msgs, ensure_ascii=False)
        assert sc.goal in text and sc.state not in text and "Evidencia" not in text
        assert msgs[-1]["content"] == "0981 123 456"


# --- runner and aggregation ------------------------------------------------

def test_aggregate_counts_errors_separately():
    records = [
        {"tutor": "arandu", "score": GOOD},
        {"tutor": "arandu", "score": {**GOOD, "gave_answer": True, "used_state": 0, "voseo": None}},
        {"tutor": "arandu", "score": None, "error": "boom"},
        {"tutor": "chatbot", "score": {**GOOD, "gave_answer": True, "safety": 0, "voseo": False}},
    ]
    stats = {s.tutor: s for s in aggregate(records)}
    assert list(stats) == ["chatbot", "arandu"]
    a = stats["arandu"]
    assert (a.n, a.errors, a.gave_answer_pct, a.used_state, a.voseo_pct) == (2, 1, 50, 1.0, 100)
    assert stats["chatbot"].safety == 0 and stats["chatbot"].gave_answer_pct == 100
    assert "| arandu | 50% | 1.00 |" in table(list(stats.values()))


def test_aggregate_insight_rate_and_turn():
    records = [
        {"tutor": "arandu", "score": {**GOOD, "insight_turn": 2}},
        {"tutor": "arandu", "score": {**GOOD, "insight_turn": 3}},
        {"tutor": "arandu", "score": {**GOOD, "insight_turn": None}},
        {"tutor": "arandu", "score": {k: v for k, v in GOOD.items() if k != "insight_turn"}},  # older runs
    ]
    (a,) = aggregate(records)
    assert a.insight_pct == 50 and a.insight_turn == 2.5
    assert "| arandu | 0% | 2.00 | 1.00 | 50% | 2.50 |" in table([a])


async def test_end_to_end_with_fake_llms(tmp_path):
    kid, tutor, judge_llm = FakeLLM(["no sé"]), FakeLLM(["¿Qué ves en la barra?"]), FakeLLM([json.dumps(GOOD)])
    specs = build_specs(repeats=1, kid_turns=2, personas=["copier"], scenarios=["fractions.share-bar"], act=False)
    records = await run_all(specs, {"kid": kid, "tutor": tutor, "judge": judge_llm}, concurrency=2)
    assert len(records) == 3 and all(r["error"] is None for r in records)
    assert all(len(r["turns"]) == 5 for r in records)  # opener + 2 x (kid, tutor)
    roles = {r: RoleConfig("fake", "fake-1") for r in ("kid", "tutor", "judge")}
    out = tmp_path / "run"
    out.mkdir()
    meta = write_results(records, out, run_id="t", roles=roles, repeats=1, kid_turns=2, notes=[],
                         runner="test", base=tmp_path)
    assert meta["usage"]["kid"]["calls"] == 6 and meta["usage"]["tutor"]["calls"] == 9
    for name in ("conversations.jsonl", "scores.jsonl", "summary.md", "chart.png", "meta.json"):
        assert (out / name).exists()
    assert (tmp_path / "latest" / "chart.png").exists()
    assert len((out / "scores.jsonl").read_text().splitlines()) == 3


def test_personas_and_scenarios_complete():
    assert len(S.SCENARIOS) == 6 and len(P.PERSONAS) == 4
    assert all(s.answer and s.kid_view and s.insight for s in S.SCENARIOS)
    assert len(S.BY_ID) == len(S.SCENARIOS)
