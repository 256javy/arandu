"""Simulated kids that ACT on manipulable exercises.

In the product a manipulable exercise has no text field: the kid cuts, drags or taps and presses «Comprobar»;
the web recomputes `describe(state)` and `check(state)` and the tutor reacts to `event=submitted`. Each class
here is a small state machine that mirrors the web exercise (apps/web/src/exercises/*.tsx) for one scenario:
a closed list of actions, the same `describe`/`check` text the API receives, the `localFeedback` the kid sees,
and a kid-facing screen without verdicts. Mirrored cases come from the vitest files next to each exercise.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field, replace

from .scenarios import Evidence


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn").strip()


def _fmt(n: float) -> str:
    return f"{n:.2f}".replace(".", ",")


def _bar(fraction: float, width: int = 20, full: str = "█", empty: str = "░") -> str:
    n = max(0, min(width, round(fraction * width)))
    return full * n + empty * (width - n)


class Sim:
    """Base: subclasses keep their own state and implement the hooks."""

    actions_help: str = ""

    def apply(self, action: str) -> str | None:
        """Applies one action; returns None if it worked, else a short reason (the action is ignored)."""
        raise NotImplementedError

    def describe(self) -> str:
        raise NotImplementedError

    def check(self) -> tuple[Evidence, ...]:
        raise NotImplementedError

    def feedback(self) -> str:
        raise NotImplementedError

    def screen(self) -> str:
        """What the kid sees, without any verdict."""
        raise NotImplementedError

    def solved(self) -> bool:
        return all(e.ok for e in self.check())


# --- pizza (fractions.share-bar, cut step) ----------------------------------------------------------------

PIZZA_TOLERANCE = 0.03  # share-bar.tsx TOLERANCE


def parts_of(cuts: list[float]) -> list[float]:
    points = [0.0, *sorted(cuts), 1.0]
    return [points[i + 1] - points[i] for i in range(len(points) - 1)]


def is_equal_split(cuts: list[float]) -> bool:
    parts = parts_of(cuts)
    return len(parts) == 4 and all(abs(p - 0.25) <= PIZZA_TOLERANCE for p in parts)


@dataclass
class Pizza(Sim):
    cuts: list[float] = field(default_factory=list)

    actions_help = (
        "- mover corte <número> <izquierda|derecha> <poco|mucho>   (los cortes se cuentan de izquierda a derecha)\n"
        "- agregar corte   (corta en el medio del pedazo más grande)\n"
        "- sacar corte <número>"
    )
    STEP = {"poco": 0.03, "mucho": 0.1}

    def _sorted(self) -> list[float]:
        return sorted(self.cuts)

    def apply(self, action: str) -> str | None:
        a = _norm(action)
        if m := re.fullmatch(r"mover (?:el )?corte (\d+) (?:a la |hacia la )?(izquierda|derecha) (poco|mucho)", a):
            i, side, size = int(m[1]) - 1, m[2], m[3]
            cuts = self._sorted()
            if not 0 <= i < len(cuts):
                return f"no hay corte {i + 1}"
            delta = self.STEP[size] * (-1 if side == "izquierda" else 1)
            cuts[i] = min(0.99, max(0.01, cuts[i] + delta))
            self.cuts = cuts
            return None
        if a in ("agregar corte", "agregar un corte"):
            pts = [0.0, *self._sorted(), 1.0]
            parts = parts_of(self.cuts)
            i = parts.index(max(parts))
            self.cuts = sorted([*self.cuts, min(0.99, max(0.01, (pts[i] + pts[i + 1]) / 2))])
            return None
        if m := re.fullmatch(r"sacar (?:el )?corte (\d+)", a):
            i = int(m[1]) - 1
            cuts = self._sorted()
            if not 0 <= i < len(cuts):
                return f"no hay corte {i + 1}"
            del cuts[i]
            self.cuts = cuts
            return None
        return "acción desconocida"

    def describe(self) -> str:  # share-bar.tsx describe(), cut step (no notation)
        parts = parts_of(self.cuts)
        text = f"La pizza tiene {len(parts)} {'pedazo' if len(parts) == 1 else 'pedazos'}"
        if len(parts) == 1:
            return text + " (sin cortar)."
        if all(abs(p - 1 / len(parts)) <= PIZZA_TOLERANCE for p in parts):
            return text + ", todos iguales."
        if max(parts) > 2 * min(parts):
            return text + ", y algunos son mucho más grandes que otros."
        return text + ", y no son todos iguales: algunos son un poco más grandes."

    def check(self) -> tuple[Evidence, ...]:  # share-bar.tsx check(), cut step
        parts = parts_of(self.cuts)
        ok = is_equal_split(self.cuts)
        if len(parts) != 4:
            detail = f"Hay {len(parts)} partes en lugar de 4."
        elif ok:
            detail = "Cortó 4 partes casi iguales."
        else:
            detail = "Hay 4 partes pero no son iguales."
        return (Evidence("fraction.equal-parts", ok, "high", detail),)

    def feedback(self) -> str:  # share-bar.tsx localFeedback()
        (e,) = self.check()
        if e.ok:
            return "¡Cuatro partes iguales!"
        return "Mmm, contá los pedazos." if "en lugar de 4" in (e.detail or "") else "Fijate: ¿son todos del mismo tamaño?"

    def screen(self) -> str:
        parts = parts_of(self.cuts)
        rows = [f"  pedazo {i + 1}: {'▇' * max(1, round(p * 40))}" for i, p in enumerate(parts)]
        return (f"La pizza larga, cortada en {len(parts)} pedazos (de izquierda a derecha; cada barra muestra "
                f"lo largo de cada pedazo):\n" + "\n".join(rows))


# --- number line (fractions.number-line) ------------------------------------------------------------------

LINE_TOLERANCE = 0.04  # number-line.tsx TOLERANCE
PHONES = {"mom": ("Mamá", "3/4", 3 / 4), "brother": ("Hermano", "2/3", 2 / 3)}
WHO = ("mom", "brother")
ALIASES = {"mama": "mom", "mamá": "mom", "hermano": "brother"}


@dataclass
class NumberLine(Sim):
    pos: dict[str, float] = field(default_factory=lambda: {"mom": 0.0, "brother": 0.0})
    moved: dict[str, bool] = field(default_factory=lambda: {"mom": False, "brother": False})
    choice: str | None = None

    actions_help = (
        "- mover <mama|hermano> <izquierda|derecha> <poco|mucho>   (izquierda = hacia el 0, batería más vacía)\n"
        "- elegir <mama|hermano>   (tocar el celular que dura más)"
    )
    STEP = {"poco": 0.05, "mucho": 0.15}  # a realistic drag on a phone screen

    def apply(self, action: str) -> str | None:
        a = _norm(action)
        if m := re.fullmatch(r"mover (?:el (?:celular )?de )?(mama|hermano) (?:a la |hacia la )?(izquierda|derecha) (poco|mucho)", a):
            w = ALIASES[m[1]]
            delta = self.STEP[m[3]] * (-1 if m[2] == "izquierda" else 1)
            self.pos[w] = min(1.0, max(0.0, self.pos[w] + delta))
            self.moved[w] = True
            return None
        if m := re.fullmatch(r"elegir (?:el (?:celular )?de )?(mama|hermano)", a):
            w = ALIASES[m[1]]
            if not self.moved[w]:
                return "ese celular no está en la recta"
            self.choice = w
            return None
        return "acción desconocida"

    def _where(self, w: str) -> str:  # number-line.tsx where()
        label, fraction, value = PHONES[w]
        name = f"{fraction} ({label})"
        if not self.moved[w]:
            return f"{name} sin mover"
        diff = self.pos[w] - value
        if abs(diff) <= LINE_TOLERANCE:
            return f"{name} en su lugar"
        return f"{name} {'más cerca del 1' if diff > 0 else 'más cerca del 0'} de lo que va"

    def describe(self) -> str:  # number-line.tsx describe()
        placed = "; ".join(self._where(w) for w in WHO)
        choice = (f" Eligió que dura más el de {PHONES[self.choice][0]} ({PHONES[self.choice][1]})."
                  if self.choice else " Todavía no eligió cuál dura más.")
        return f"Recta de 0 a 1 (batería vacía a llena). Ubicó {placed}.{choice}"

    def check(self) -> tuple[Evidence, ...]:  # number-line.tsx check()
        errors = [(w, abs(self.pos[w] - PHONES[w][2])) for w in WHO]
        misplaced = [(w, err) for w, err in errors if not self.moved[w] or err > LINE_TOLERANCE]
        ok = not misplaced and self.choice == "mom"
        if ok:
            detail = "Ubicó 3/4 y 2/3 bien en la recta y eligió 3/4 como mayor."
        elif misplaced:
            detail = "; ".join(
                f"{PHONES[w][1]} quedó en {_fmt(self.pos[w])} (error {_fmt(err)})" if self.moved[w]
                else f"{PHONES[w][1]} sin ubicar" for w, err in misplaced) + "."
        elif not self.choice:
            detail = "Ubicó bien las dos, pero no eligió cuál dura más."
        else:
            detail = "Ubicó bien las dos, pero eligió 2/3 como mayor."
        return (Evidence("fraction.compare", ok, "high", detail),)

    def feedback(self) -> str:  # number-line.tsx localFeedback()
        return "¡Eso es!" if self.solved() else "Mirá dónde quedó cada uno."

    def screen(self) -> str:
        cells = ["─"] * 21
        for mark in (0, 5, 10, 15, 20):
            cells[mark] = "┼"
        for w, ch in (("mom", "M"), ("brother", "H")):
            if self.moved[w]:
                cells[round(self.pos[w] * 20)] = ch
        lines = ["Recta: 0 " + "".join(cells) + " 1   (M = celular de Mamá con 3/4, H = de tu hermano con 2/3)"]
        for w in WHO:
            label = PHONES[w][0]
            lines.append(f"  batería de {label}: " + (_bar(self.pos[w], 12) if self.moved[w] else "en la bandeja"))
        lines.append(f"  elegiste: {PHONES[self.choice][0]}" if self.choice else "  todavía no elegiste")
        return "\n".join(lines)


# --- recipe (proportions.recipe, 8-people step) -----------------------------------------------------------

BASE = {"flour": 2, "eggs": 4, "milk": 2}
BASE_PEOPLE = 4
INGREDIENTS = ("flour", "eggs", "milk")
INFO = {"flour": ("Harina", "taza de harina", "tazas de harina"), "eggs": ("Huevos", "huevo", "huevos"),
        "milk": ("Leche", "taza de leche", "tazas de leche")}
ING_ALIASES = {"harina": "flour", "huevo": "eggs", "huevos": "eggs", "leche": "milk"}


def scaled(people: int) -> dict[str, float]:
    return {k: BASE[k] * people / BASE_PEOPLE for k in INGREDIENTS}


def feeds(a: dict[str, int]) -> int:
    return math.floor(min(a[k] / BASE[k] * BASE_PEOPLE for k in INGREDIENTS))


def _list(a: dict[str, int]) -> str:
    return ", ".join(f"{a[k]} {INFO[k][1] if a[k] == 1 else INFO[k][2]}" for k in INGREDIENTS)


@dataclass
class Recipe(Sim):
    eight: dict[str, int] = field(default_factory=lambda: dict(BASE))

    actions_help = "- mas <harina|huevos|leche>\n- menos <harina|huevos|leche>"

    def apply(self, action: str) -> str | None:
        a = _norm(action).replace("+", "mas ").replace("-", "menos ")
        if m := re.fullmatch(r"(mas|menos)\s+(?:un |una )?(harina|huevos?|leche)", " ".join(a.split())):
            k = ING_ALIASES[m[2]]
            self.eight[k] = min(12, max(0, self.eight[k] + (1 if m[1] == "mas" else -1)))
            return None
        return "acción desconocida"

    def describe(self) -> str:  # recipe.tsx describe(), 8-people step
        text = f"Receta de panqueques para 4 personas: {_list(BASE)}. Para 8 personas puso {_list(self.eight)}"
        f8 = feeds(self.eight)
        if self.solved():
            return text + ", justo para 8."
        if f8 >= 8:
            return text + ", que alcanza para 8 pero no es la misma receta (algo sobra)."
        return text + f", que alcanza solo para {f8}."

    def check(self) -> tuple[Evidence, ...]:  # recipe.tsx check() / detailFor()
        want = scaled(8)
        wrong = [k for k in INGREDIENTS if self.eight[k] != want[k]]
        if not wrong:
            return (Evidence("proportion.scale", True, "high", "Ajustó bien los tres ingredientes para 8 personas."),)
        detail = "Para 8: " + "; ".join(f"{INFO[k][0].lower()} {self.eight[k]} (va {want[k]:g})" for k in wrong) + "."
        return (Evidence("proportion.scale", False, "high", detail),)

    def solved(self) -> bool:
        return self.eight == {k: int(v) for k, v in scaled(8).items()}

    def feedback(self) -> str:  # recipe.tsx localFeedback()
        return "¡Alcanza para 8!" if self.solved() else "Mirá: ¿es la misma receta para todos?"

    def screen(self) -> str:  # recipe.tsx describeAmounts(), what the kid reads under the bowls
        return (f"Receta para 4: {_list(BASE)}. Para 8 personas tenés {_list(self.eight)}; "
                f"alcanza para {min(8, feeds(self.eight))} de 8.")


# --- scenarios -> initial simulators ----------------------------------------------------------------------

INITIAL: dict[str, callable] = {
    "fractions.share-bar": lambda: Pizza(cuts=[0.45, 0.65, 0.82]),
    "fractions.number-line": lambda: NumberLine(pos={"mom": 0.75, "brother": 0.8}, moved={"mom": True, "brother": True},
                                                choice="brother"),
    "fractions.number-line-again": lambda: NumberLine(pos={"mom": 0.62, "brother": 0.78},
                                                      moved={"mom": True, "brother": True}, choice="brother"),
    "proportions.recipe": lambda: Recipe(eight={"flour": 4, "eggs": 6, "milk": 4}),
}


def simulator(scenario_id: str) -> Sim | None:
    make = INITIAL.get(scenario_id)
    return make() if make else None


@dataclass(frozen=True)
class KidMove:
    actions: tuple[str, ...]
    said: str


_HAGO = re.compile(r"^\s*hago\s*:\s*(.+)$", re.I | re.M)
_DIGO = re.compile(r"^\s*digo\s*:\s*(.+)$", re.I | re.M)


def parse_move(text: str, max_actions: int = 3) -> KidMove:
    """Kid output: up to three `HAGO: <acción>` lines and an optional `DIGO: <mensaje>`."""
    actions = tuple(a.strip().strip(".") for a in _HAGO.findall(text or ""))[:max_actions]
    said = " ".join(s.strip() for s in _DIGO.findall(text or "")).strip()
    return KidMove(actions, said)


# Planner.label() in skill order (ExerciseCatalog.SKILLS): the order TutorController.memory() lists them in.
SKILL_LABELS = {
    "fraction.equal-parts": "partes iguales",
    "fraction.notation": "notación a/b",
    "fraction.compare": "comparar fracciones",
    "fraction.equivalence": "fracciones equivalentes",
    "proportion.scale": "agrandar una receta",
    "proportion.unit-rate": "cuánto va para cada uno",
}


def with_attempts(memory, earlier: list[Evidence], exercise_id: str):
    """The learner model the API would read before this turn: the scenario's earlier sessions plus every check
    already saved in this conversation (TutorController stores evidence after reading `memory(before)`)."""
    from .scenarios import Memory

    acc = {m.label: [m.successes, m.attempts, m.last_exercise] for m in memory}
    for e in earlier:
        s = acc.setdefault(SKILL_LABELS.get(e.skill, e.skill), [0, 0, exercise_id])
        s[0] += 1 if e.ok else 0
        s[1] += 1
        s[2] = exercise_id
    order = list(SKILL_LABELS.values())
    labels = sorted(acc, key=lambda label: order.index(label) if label in order else len(order))
    return tuple(Memory(label, *acc[label]) for label in labels)


def live_scenario(scenario, sim: Sim, earlier: list[Evidence] | None = None):
    """The scenario as the API would see it right after «Comprobar»: new state and evidence, and the memory
    including the checks of earlier turns."""
    return replace(scenario, state=sim.describe(), evidence=sim.check(), event="submitted",
                   memory=with_attempts(scenario.memory, earlier or [], scenario.exercise_id))
