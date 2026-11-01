"""Exercise states the tutors react to. They mirror what the web app sends to POST /api/tutor/turn
(`describe(state)` and `check(state)` in apps/web/src/exercises/*)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Evidence:
    skill: str
    ok: bool
    confidence: str  # high | medium | low
    detail: str | None = None


@dataclass(frozen=True)
class Memory:
    """One line of TutorController.memory(): what the kid showed in earlier sessions."""
    label: str          # Planner.label(skill)
    successes: int
    attempts: int
    last_exercise: str


@dataclass(frozen=True)
class Scenario:
    id: str                     # unique scenario id (several scenarios may share an exercise)
    goal: str
    state: str                  # describe(state): what the tutor sees
    event: str                  # submitted | stuck
    evidence: tuple[Evidence, ...] = field(default_factory=tuple)
    kid_view: str = ""          # what the simulated kid did and sees on screen
    answer: str = ""            # the final answer the tutor must not give away (judge only)
    insight: str = ""           # the key idea the kid should reach in their own words (judge only)
    exercise: str = ""          # exercise id sent to the API; defaults to `id`
    memory: tuple[Memory, ...] = field(default_factory=tuple)

    @property
    def exercise_id(self) -> str:
        return self.exercise or self.id


SCENARIOS: tuple[Scenario, ...] = (
    Scenario(
        id="fractions.share-bar",
        goal=(
            "Cortar la pizza en 4 partes iguales para repartirla entre 4 amigos y nombrar la parte "
            "de uno con una fracción."
        ),
        state="La pizza tiene 4 pedazos, y algunos son mucho más grandes que otros.",
        event="submitted",
        evidence=(Evidence("fraction.equal-parts", False, "high", "Hay 4 partes pero no son iguales."),),
        kid_view=(
            "Tenías que cortar una pizza de molde larga en 4 partes iguales para vos y 3 amigos. "
            "Hiciste 3 cortes y apretaste «Comprobar». El primer pedazo te quedó bastante más grande "
            "que los otros tres."
        ),
        answer="Each of the 4 parts must be the same size (1/4 of the pizza); the first cut must move.",
        insight="All four pieces must be the same size for the split to be fair, so the big piece has to shrink.",
    ),
    Scenario(
        id="fractions.number-line",
        goal="Ubicar 3/4 y 2/3 en la recta de 0 a 1 y decidir cuál es mayor.",
        state=(
            "Recta de 0 a 1 (batería vacía a llena). Ubicó 3/4 (Mamá) en su lugar; 2/3 (Hermano) más "
            "cerca del 1 de lo que va. Eligió que dura más el de Hermano (2/3)."
        ),
        event="submitted",
        evidence=(Evidence("fraction.compare", False, "high", "2/3 quedó en 0,80 (error 0,13)."),),
        kid_view=(
            "El celular de tu mamá tiene 3/4 de batería y el de tu hermano 2/3. En una recta de 0 a 1 "
            "arrastraste los dos celulares: el de tu hermano lo pusiste más cerca del 1 que el de tu "
            "mamá, así que tocaste el de tu hermano como el que dura más. Apretaste «Comprobar»."
        ),
        answer="3/4 > 2/3 (mom's phone has more battery); 2/3 goes left of 3/4.",
        insight="3/4 is more than 2/3 because a quarter missing is less than a third missing (or an equivalent valid reason).",
    ),
    Scenario(
        id="fractions.explain-compare",
        goal="El celular de tu mamá tiene 3/4 de batería y el de tu hermano, 2/3. ¿Cuál tiene más batería? ¿Por qué?",
        state="Todavía no escribió nada.",
        event="stuck",
        kid_view=(
            "Te preguntan: «El celular de tu mamá tiene tres cuartos de batería y el de tu hermano, dos "
            "tercios. ¿Cuál tiene más batería? ¿Por qué?». Ves dos celulares dibujados: Mamá con la batería "
            "en 4 rayitas y 3 llenas, Tu hermano en 3 rayitas y 2 llenas. No sabés qué escribir y "
            "apretaste «Me trabé»."
        ),
        answer="Mom's phone (3/4) has more battery than the brother's (2/3).",
        insight="Mom's 3/4 is more, with a reason in their own words (missing piece is smaller, common denominator, or similar).",
    ),
    Scenario(
        id="fractions.explain-equivalence",
        goal=(
            "Tu primo dice que 2/4 de una barra de chocolate es más que 1/2 porque tiene números más "
            "grandes. ¿Tiene razón?"
        ),
        state="Todavía no escribió nada.",
        event="stuck",
        kid_view=(
            "Te preguntan: «Tu primo dice que 2/4 de un chocolate es más que 1/2 porque tiene "
            "números más grandes. ¿Tiene razón?». Ves dos chocolates dibujados: el de Tu primo en 4 partes "
            "con 2 pintadas y el tuyo (Vos) en 2 partes con 1 pintada. No sabés qué escribir y apretaste «Me trabé»."
        ),
        answer="The cousin is wrong: 2/4 and 1/2 are equivalent (the same amount).",
        insight="2/4 and 1/2 are the same amount (pieces are smaller but there are more of them, or two quarters make a half).",
    ),
    Scenario(
        id="proportions.recipe",
        goal="Ajustar una receta para 4 personas a 8 (duplicar) y después a 6 (pasando por cuánto va para 2).",
        state=(
            "Receta de panqueques para 4 personas: 2 tazas de harina, 4 huevos, 2 tazas de leche. Para 8 "
            "personas puso 4 tazas de harina, 6 huevos, 4 tazas de leche, que alcanza solo para 6."
        ),
        event="submitted",
        evidence=(Evidence("proportion.scale", False, "high", "Para 8: huevos 6 (va 8)."),),
        kid_view=(
            "La receta de panqueques es para 4 personas: 2 tazas de harina, 4 huevos y 2 tazas de leche. "
            "Vienen 8 amigos. Con los botones + y − pusiste 4 tazas de harina, 6 huevos y 4 tazas de leche "
            "y apretaste «Comprobar». Pensaste que con sumar 2 a los huevos alcanzaba."
        ),
        answer="For 8 people everything doubles: 4 cups flour, 8 eggs, 4 cups milk.",
        insight="For twice the people every ingredient must double (multiply, not add the same amount), so eggs go to 8.",
    ),
    # Persistent error: second try on the number line, same mistake, and the learner model remembers that the
    # kid already showed equal parts with the pizza. Only a tutor that sees state and memory can build on it.
    Scenario(
        id="fractions.number-line-again",
        exercise="fractions.number-line",
        goal="Ubicar 3/4 y 2/3 en la recta de 0 a 1 y decidir cuál es mayor.",
        state=(
            "Recta de 0 a 1 (batería vacía a llena). Ubicó 3/4 (Mamá) más cerca del 0 de lo que va; 2/3 "
            "(Hermano) más cerca del 1 de lo que va. Eligió que dura más el de Hermano (2/3)."
        ),
        event="submitted",
        evidence=(Evidence("fraction.compare", False, "high",
                           "3/4 quedó en 0,62 (error 0,13); 2/3 quedó en 0,78 (error 0,11)."),),
        memory=(
            Memory("partes iguales", 2, 2, "fractions.share-bar"),
            Memory("comparar fracciones", 0, 2, "fractions.number-line"),
        ),
        kid_view=(
            "Es la tercera vez que hacés el ejercicio de las baterías (3/4 el celular de tu mamá, 2/3 el de tu "
            "hermano) y otra vez pusiste el de tu hermano más cerca del 1, porque pensás que a los dos les falta "
            "una sola rayita, así que da casi lo mismo. Ayer repartiste bien una pizza en 4 partes iguales. Apretaste «Comprobar»."
        ),
        answer="3/4 > 2/3 (mom's phone has more battery); 2/3 goes left of 3/4.",
        insight="3/4 is more than 2/3, reasoned from piece sizes (thirds are bigger pieces, but a quarter missing is less than a third missing) or another valid reason.",
    ),
)

BY_ID = {s.id: s for s in SCENARIOS}
