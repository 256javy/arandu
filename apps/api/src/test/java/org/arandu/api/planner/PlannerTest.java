package org.arandu.api.planner;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.arandu.api.planner.LearnerModel.Observation;
import org.arandu.api.planner.LearnerModel.Status;
import org.junit.jupiter.api.Test;

class PlannerTest {

    private static Observation obs(String skill, boolean ok, String confidence, String exercise) {
        return new Observation(skill, ok, confidence, exercise, null, Instant.now());
    }

    @Test
    void startsWithEqualParts() {
        assertThat(Planner.next(LearnerModel.of(List.of())).exerciseId()).isEqualTo("fractions.share-bar");
    }

    @Test
    void movesToNumberLineAfterBarSkills() {
        LearnerModel m = LearnerModel.of(List.of(
                obs("fraction.equal-parts", true, "high", "fractions.share-bar"),
                obs("fraction.notation", true, "high", "fractions.share-bar")));
        assertThat(m.skill("fraction.equal-parts").status()).isEqualTo(Status.MASTERED);
        assertThat(Planner.next(m).exerciseId()).isEqualTo("fractions.number-line");
    }

    @Test
    void switchesModeWhenStuck() {
        LearnerModel m = LearnerModel.of(List.of(
                obs("fraction.equal-parts", true, "high", "fractions.share-bar"),
                obs("fraction.notation", true, "high", "fractions.share-bar"),
                obs("fraction.compare", false, "high", "fractions.number-line"),
                obs("fraction.compare", false, "high", "fractions.number-line")));
        assertThat(m.skill("fraction.compare").status()).isEqualTo(Status.STUCK);
        Planner.Plan p = Planner.next(m);
        assertThat(p.exerciseId()).isEqualTo("fractions.explain-compare");
        assertThat(p.reason()).contains("otro modo");
    }

    @Test
    void confirmsLlmJudgedEvidenceWithDeterministicExercise() {
        LearnerModel m = LearnerModel.of(List.of(
                obs("fraction.equal-parts", true, "high", "fractions.share-bar"),
                obs("fraction.notation", true, "high", "fractions.share-bar"),
                obs("fraction.compare", true, "medium", "fractions.explain-compare")));
        assertThat(m.skill("fraction.compare").status()).isEqualTo(Status.LIKELY);
        assertThat(Planner.next(m).exerciseId()).isEqualTo("fractions.number-line");
    }

    @Test
    void reviewsWeakestSkillWhenEverythingIsDemonstrated() {
        LearnerModel m = LearnerModel.of(List.of(
                obs("fraction.equal-parts", true, "high", "fractions.share-bar"),
                obs("fraction.notation", true, "high", "fractions.share-bar"),
                obs("fraction.compare", true, "high", "fractions.number-line"),
                obs("fraction.equivalence", true, "medium", "fractions.explain-equivalence")));
        Planner.Plan p = Planner.next(m);
        assertThat(p.skill()).isEqualTo("fraction.equivalence");
        assertThat(p.reason()).contains("repasamos");
    }
}
