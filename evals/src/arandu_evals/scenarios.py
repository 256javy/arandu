"""Exercise states the tutors react to. They mirror what the web app sends to POST /api/tutor/turn."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Evidence:
    skill: str
    ok: bool
    confidence: str  # high | medium | low
    detail: str | None = None


@dataclass(frozen=True)
class Scenario:
    id: str
    goal: str
    state: str                  # describe(state): what the tutor sees
    event: str                  # submitted | stuck
    evidence: tuple[Evidence, ...] = field(default_factory=tuple)
    kid_view: str = ""          # what the simulated kid did and sees on screen
    answer: str = ""            # the final answer the tutor must not give away (judge only)


SCENARIOS: tuple[Scenario, ...] = (
    Scenario(
        id="fractions.share-bar",
        goal=(
            "Cortar la barra en 4 partes iguales para repartirla entre 4 amigos y nombrar la parte "
            "de uno con una fracción."
        ),
        state="La barra tiene 4 partes de tamaños 36%, 21%, 22%, 21%.",
        event="submitted",
        evidence=(Evidence("fraction.equal-parts", False, "high", "Hay 4 partes pero no son iguales."),),
        kid_view=(
            "Tenías que cortar una barra de chocolate en 4 partes iguales para 4 amigos. "
            "Hiciste 3 cortes y apretaste «Listo». La primera parte te quedó bastante más grande "
            "que las otras tres (36%, 21%, 22% y 21% de la barra)."
        ),
        answer="Each part must be 1/4 of the bar (25%); the first part must shrink and the others grow.",
    ),
    Scenario(
        id="fractions.number-line",
        goal="Ubicar 3/4 y 2/3 en la recta de 0 a 1 y decidir cuál es mayor.",
        state=(
            "Recta de 0 a 1 (batería vacía a llena). Ubicó 3/4 (Mamá) en 0,75; 2/3 (Hermano) en 0,80. "
            "Eligió que dura más el de Hermano (2/3)."
        ),
        event="submitted",
        evidence=(Evidence("fraction.compare", False, "high", "2/3 quedó en 0,80 (error 0,13)."),),
        kid_view=(
            "El celular de tu mamá tiene 3/4 de batería y el de tu hermano 2/3. En una recta de 0 a 1 "
            "pusiste 3/4 en 0,75 y 2/3 en 0,80, así que dijiste que el de tu hermano tiene más. "
            "Apretaste «Listo»."
        ),
        answer="3/4 > 2/3 (mom's phone has more battery); 2/3 is about 0.67 and goes left of 0.75.",
    ),
    Scenario(
        id="fractions.explain-equivalence",
        goal=(
            "Tu primo dice que 2/4 de una barra de chocolate es más que 1/2 porque tiene números más "
            "grandes. ¿Tiene razón?"
        ),
        state="Todavía no escribió nada.",
        event="stuck",
        evidence=(),
        kid_view=(
            "Te preguntan: «Tu primo dice que 2/4 de una barra de chocolate es más que 1/2 porque tiene "
            "números más grandes. ¿Tiene razón?». Ves dos barras dibujadas: una en 4 partes con 2 pintadas "
            "y otra en 2 partes con 1 pintada. No sabés qué escribir y apretaste «Me trabé»."
        ),
        answer="The cousin is wrong: 2/4 and 1/2 are equivalent (the same amount).",
    ),
)

BY_ID = {s.id: s for s in SCENARIOS}
