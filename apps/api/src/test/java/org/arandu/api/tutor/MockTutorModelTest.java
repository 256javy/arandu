package org.arandu.api.tutor;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class MockTutorModelTest {

    private final MockTutorModel model = new MockTutorModel();

    private String judge(String rubric, String answer) {
        return model.complete(List.of(
                new TutorModel.Message("system", Assessor.SYSTEM),
                new TutorModel.Message("user", "Rúbrica:\n" + rubric + "\n\n" + Assessor.wrap(answer))));
    }

    @Test
    void ignoresReasonWordsInTheRubric() {
        assertThat(judge("a 3/4 le falta 1/4; es la mitad", "el de mamá")).contains("\"ok\": false");
    }

    @Test
    void acceptsAReasonInTheAnswer() {
        assertThat(judge("rúbrica", "el de mamá porque le falta menos")).contains("\"ok\": true");
    }
}
