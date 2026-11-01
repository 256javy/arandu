package org.arandu.api.planner;

import java.util.List;
import java.util.Optional;

/**
 * Server-side view of the exercises: which skills each one can evidence, in which mode, and, for
 * open-ended ones, the rubric the LLM uses to judge the kid's explanation.
 */
public final class ExerciseCatalog {

    public enum Mode { MANIPULABLE, NUMBER_LINE, EXPLAIN }

    public record Exercise(String id, Mode mode, List<String> skills, String rubric) {

        public boolean llmJudged() {
            return rubric != null;
        }
    }

    /** Skills in teaching order. */
    public static final List<String> SKILLS = List.of(
            "fraction.equal-parts", "fraction.notation", "fraction.compare", "fraction.equivalence");

    public static final List<Exercise> EXERCISES = List.of(
            new Exercise("fractions.share-bar", Mode.MANIPULABLE,
                    List.of("fraction.equal-parts", "fraction.notation"), null),
            new Exercise("fractions.number-line", Mode.NUMBER_LINE, List.of("fraction.compare"), null),
            new Exercise("fractions.explain-compare", Mode.EXPLAIN, List.of("fraction.compare"), """
                    Pregunta: el celular de la mamá tiene 3/4 de batería y el del hermano, 2/3. ¿Cuál tiene \
                    más y por qué? Decir "el de mamá" es lo mismo que decir 3/4, y "el de mi hermano", 2/3.
                    Correcto: dice que 3/4 (el de mamá) es más y lo justifica con una razón \
                    válida en sus palabras, por ejemplo que a 3/4 le falta 1/4 y a 2/3 le falta 1/3, que es \
                    más; que los cuartos son más chicos que los tercios pero tiene más; o comparando con \
                    denominador común (9/12 contra 8/12). Una respuesta sin razón o con razón inválida \
                    ("porque 4 es más grande que 3") no alcanza."""),
            new Exercise("fractions.explain-equivalence", Mode.EXPLAIN, List.of("fraction.equivalence"), """
                    Pregunta: el primo dice que 2/4 de un chocolate es más que 1/2 porque tiene números más \
                    grandes. ¿Tiene razón? Decir "no" o "no tiene razón" ya responde la pregunta.
                    Correcto: dice que NO, que son iguales (la misma cantidad, la mitad), y lo justifica con \
                    una razón válida en sus palabras: los pedazos son más chicos pero tiene más; dos cuartos \
                    forman una mitad; multiplicar arriba y abajo por 2. Decir solo "son iguales" sin razón \
                    no alcanza."""));

    private ExerciseCatalog() {
    }

    public static Optional<Exercise> find(String id) {
        return EXERCISES.stream().filter(e -> e.id().equals(id)).findFirst();
    }

    public static List<Exercise> forSkill(String skill) {
        return EXERCISES.stream().filter(e -> e.skills().contains(skill)).toList();
    }
}
