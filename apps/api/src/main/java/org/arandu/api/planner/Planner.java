package org.arandu.api.planner;

import java.util.Comparator;
import java.util.List;
import org.arandu.api.planner.ExerciseCatalog.Exercise;
import org.arandu.api.planner.LearnerModel.SkillState;

/**
 * Picks the next mission from the learner model: the first skill (in teaching order) that is not yet
 * demonstrated. It switches mode when the kid is stuck, and confirms LLM-judged evidence (medium
 * confidence) with a deterministic exercise when one exists.
 */
public final class Planner {

    /** {@code reason} is shown to the kid's family, in Spanish. */
    public record Plan(String exerciseId, String skill, String reason) {
    }

    private Planner() {
    }

    public static Plan next(LearnerModel model) {
        for (String skill : ExerciseCatalog.SKILLS) {
            SkillState st = model.skill(skill);
            List<Exercise> options = ExerciseCatalog.forSkill(skill);
            switch (st.status()) {
                case MASTERED -> {
                    continue;
                }
                case LIKELY -> {
                    Exercise other = deterministicOther(options, st.lastExercise());
                    if (other != null) {
                        return new Plan(other.id(), skill, "Lo explicó bien, pero lo juzgó el modelo (confianza "
                                + "media): lo confirmamos con un ejercicio que se corrige solo.");
                    }
                    continue;
                }
                case STUCK -> {
                    Exercise other = options.stream().filter(e -> !e.id().equals(st.lastExercise()))
                            .findFirst().orElse(null);
                    if (other != null) {
                        return new Plan(other.id(), skill, "Se trabó dos veces seguidas en " + label(skill)
                                + ": probamos otro modo (" + modeLabel(other) + ").");
                    }
                    return new Plan(options.getFirst().id(), skill, "Sigue practicando " + label(skill)
                            + " con más pistas de Musi.");
                }
                case PRACTICING -> {
                    String id = st.lastExercise() != null ? st.lastExercise() : options.getFirst().id();
                    return new Plan(id, skill, "Sigue con " + label(skill) + ": todavía no lo demostró.");
                }
                case NEW -> {
                    return new Plan(options.getFirst().id(), skill, "Próxima habilidad: " + label(skill) + ".");
                }
            }
        }
        // Everything demonstrated: review the weakest skill in a mode different from the last one.
        SkillState weakest = model.skills().stream().min(Comparator.comparingDouble(SkillState::mastery))
                .orElseThrow();
        Exercise pick = ExerciseCatalog.forSkill(weakest.skill()).stream()
                .filter(e -> !e.id().equals(model.lastExercise()))
                .findFirst()
                .orElse(ExerciseCatalog.forSkill(weakest.skill()).getFirst());
        return new Plan(pick.id(), weakest.skill(), "Demostró todas las habilidades; repasamos la más floja ("
                + label(weakest.skill()) + ").");
    }

    private static Exercise deterministicOther(List<Exercise> options, String last) {
        return options.stream().filter(e -> !e.llmJudged() && !e.id().equals(last)).findFirst().orElse(null);
    }

    public static String label(String skill) {
        return switch (skill) {
            case "fraction.equal-parts" -> "partes iguales";
            case "fraction.notation" -> "notación a/b";
            case "fraction.compare" -> "comparar fracciones";
            case "fraction.equivalence" -> "fracciones equivalentes";
            case "proportion.scale" -> "agrandar una receta";
            case "proportion.unit-rate" -> "cuánto va para cada uno";
            default -> skill;
        };
    }

    private static String modeLabel(Exercise e) {
        return switch (e.mode()) {
            case MANIPULABLE -> "manipulable";
            case NUMBER_LINE -> "recta numérica";
            case EXPLAIN -> "explicar con palabras";
            case PHOTO -> "foto del mundo real";
        };
    }
}
