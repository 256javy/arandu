package org.arandu.api.tutor;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class AssessorTest {

    private final Assessor assessor = new Assessor(messages -> "", JsonMapper.builder().build());

    @Test
    void parsesMissingHintIntoDetail() {
        var v = assessor.parse("```json\n{\"ok\": false, \"reason\": \"No da razón.\", \"missing\": \" decir por qué \"}\n```")
                .orElseThrow();
        assertThat(v.ok()).isFalse();
        assertThat(v.missing()).isEqualTo("decir por qué");
        assertThat(v.detail()).isEqualTo("No da razón. Falta: decir por qué");
    }

    @Test
    void missingIsOptional() {
        var v = assessor.parse("{\"ok\": true, \"reason\": \"Bien.\"}").orElseThrow();
        assertThat(v.missing()).isEmpty();
        assertThat(v.detail()).isEqualTo("Bien.");
        assertThat(assessor.parse("{\"ok\": true, \"reason\": \"Bien.\", \"missing\": null}").orElseThrow().detail())
                .isEqualTo("Bien.");
    }

    @Test
    void rejectsInvalidOutput() {
        assertThat(assessor.parse("no json")).isEmpty();
        assertThat(assessor.parse("{\"ok\": \"yes\"}")).isEmpty();
        assertThat(assessor.parse(null)).isEmpty();
    }
}
