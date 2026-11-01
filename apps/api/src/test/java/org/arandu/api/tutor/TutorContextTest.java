package org.arandu.api.tutor;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.arandu.api.planner.ExerciseCatalog.Mode;
import org.junit.jupiter.api.Test;

class TutorContextTest {

    private static TutorController.TurnRequest req(String exercise) {
        return new TutorController.TurnRequest(UUID.randomUUID(), exercise, "goal", "La barra tiene 4 partes de 36%",
                List.of(), "submitted", null, List.of());
    }

    @Test
    void tellsMusiWhetherTheKidCanWrite() {
        assertThat(TutorController.context(req("fractions.share-bar"), Mode.MANIPULABLE, List.of()))
                .contains("Tipo: manipulable").contains("no puede escribir");
        assertThat(TutorController.context(req("fractions.number-line"), Mode.NUMBER_LINE, List.of()))
                .contains("Tipo: manipulable");
        assertThat(TutorController.context(req("fractions.explain-compare"), Mode.EXPLAIN, List.of()))
                .contains("Tipo: explicar");
    }

    @Test
    void cleansClientDetail() {
        assertThat(TutorController.cleanDetail(null)).isNull();
        assertThat(TutorController.cleanDetail("a<b>\r\nc a@b.com")).isEqualTo("a b c [dato oculto]");
        assertThat(TutorController.cleanDetail("x".repeat(500))).hasSize(TutorController.DETAIL_MAX);
    }

    @Test
    void scrubsEmailsAddressesAndLongNumbers() {
        assertThat(TutorController.scrub("escribime a juan arroba gmail punto com")).doesNotContain("gmail");
        assertThat(TutorController.scrub("vivo en la calle Mcal. López 1234")).doesNotContain("1234");
        assertThat(TutorController.scrub("mi cédula es 4.567.890")).doesNotContain("567");
        assertThat(TutorController.scrub("1, 2, 3, 4, 5, 6, 7")).doesNotContain("4");
        assertThat(TutorController.scrub("1/2 es igual a 2/4 y a 3/6")).isEqualTo("1/2 es igual a 2/4 y a 3/6");
    }

    @Test
    void quotesOnlyCleanText() {
        assertThat(TutorController.quotable("dos cuartos son la mitad, 2/4 = 1/2")).isEqualTo("dos cuartos son la mitad, 2/4 = 1/2");
        assertThat(TutorController.quotable("mi mail es a@b.com")).isNull();
        assertThat(TutorController.quotable("1/2 2/4 3/6 4/8")).isNull();
        assertThat(TutorController.quotable("  ")).isNull();
    }

    @Test
    void marksStateNumbersAsInternal() {
        assertThat(TutorController.context(req("fractions.share-bar"), Mode.MANIPULABLE, List.of()))
                .contains("Estado actual (números internos, no los digas): La barra");
    }
}
